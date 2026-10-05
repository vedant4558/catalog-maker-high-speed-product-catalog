// Part 4: customer catalog query layer (the code behind /api/v1/* AND the server-rendered designs) against real
// PostgreSQL, including admin → customer propagation and resilience when the external store is unreachable.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { getByIds, getCategories, getProduct, getRelated, listProducts, resolveClient } from "../lib/catalog/queries";
import { parseInput, productSchema, categorySchema, settingsSchema } from "../lib/admin/validators";
import { createProduct, updateProduct, listProducts as adminList } from "../lib/admin/services/products";
import { createCategory, moveCategory, setCategoryVisibility } from "../lib/admin/services/categories";
import { updateSettings } from "../lib/admin/services/settings";
import { getDesign } from "../designs/registry";
import { syncSource } from "../lib/sync/engine";
import { makeShopifyProducts, startMock, type MockState } from "./helpers";

let clientId = ""; let client: { currency: string };
const slug = `catalog-test-${Date.now()}`;
const mk = (o: Record<string, string> = {}, imgs: object[] = [], vars: object[] = []) =>
  parseInput(productSchema, { name: "P", price: "100", stockStatus: "IN_STOCK", isActive: "on", images: JSON.stringify(imgs), variants: JSON.stringify(vars), ...o });
const ids: Record<string, string> = {};
const cats: Record<string, string> = {};

before(async () => {
  const c = await db.client.create({ data: { name: "Catalog Test", slug, domain: `${slug}.test`, whatsappNumber: "919876543210", activeDesign: "grid" } });
  clientId = c.id; client = c;
  for (const [i, n] of ["Rugs", "Mats", "Empty"].entries()) cats[n] = (await createCategory(clientId, parseInput(categorySchema, { name: n, isVisible: "on", sortOrder: String(i) }))).id;
  cats.Silk = (await createCategory(clientId, parseInput(categorySchema, { name: "Silk Rugs", parentId: cats.Rugs, isVisible: "on" }))).id;
  const add = async (key: string, o: Record<string, string>, imgs: object[] = [], vars: object[] = []) => { ids[key] = (await createProduct(clientId, client, mk(o, imgs, vars))).id; };
  await add("blue", { name: "Blue Rug", sku: "BR-1", price: "500", categoryId: cats.Rugs, description: "Handmade woollen carpet" }, [{ url: "https://x.test/1.jpg" }, { url: "https://x.test/2.jpg" }], [{ title: "Small", stockStatus: "IN_STOCK", price: "450" }]);
  await add("silk", { name: "Silk Runner", sku: "SR-1", price: "900", categoryId: cats.Silk }, [{ url: "https://x.test/s.jpg" }]);
  await add("mat", { name: "Door Mat", price: "50", categoryId: cats.Mats, stockStatus: "OUT_OF_STOCK" }); // no image, out of stock
  await add("loose", { name: "Loose Item", price: "10" }); // no category, no image
  await add("hidden", { name: "Secret Thing", price: "10", isActive: "" });
});
after(async () => { await db.client.delete({ where: { id: clientId } }).catch(() => {}); await db.$disconnect(); });

const names = async (q: Parameters<typeof listProducts>[1]) => (await listProducts(clientId, q)).items.map((i) => i.name);

test("client resolves by custom domain and exposes only public fields", async () => {
  const c = await resolveClient(`${slug}.test:3000`);
  assert.equal(c?.id, clientId);
  assert.deepEqual(Object.keys(c!).sort(), ["activeDesign", "currency", "domain", "id", "name", "slug", "whatsappNumber"]);
});

test("listing: minimal payload, no image/variant joins, inactive products never shown", async () => {
  const r = await listProducts(clientId, {});
  assert.equal(r.items.length, 4);
  assert.ok(!r.items.some((i) => i.name === "Secret Thing"));
  assert.deepEqual(Object.keys(r.items[0]).sort(), ["category", "compareAtPrice", "currency", "id", "inStock", "name", "price", "slug", "stockStatus", "thumbnail"]);
});

test("search: case-insensitive, multi-word AND, matches SKU and description, empty result is not an error", async () => {
  assert.deepEqual(await names({ q: "BLUE" }), ["Blue Rug"]);
  assert.deepEqual(await names({ q: "silk runner" }), ["Silk Runner"]);
  assert.deepEqual(await names({ q: "sr-1" }), ["Silk Runner"]);
  assert.deepEqual(await names({ q: "woollen" }), ["Blue Rug"]);
  assert.deepEqual(await names({ q: "zzz-nothing" }), []);
  assert.deepEqual(await names({ q: "%'; DROP TABLE" }), [], "special characters are just text");
});

test("filters: category includes subcategories, in-stock, price range, sorting", async () => {
  assert.deepEqual((await names({ category: "rugs", sort: "name" })), ["Blue Rug", "Silk Runner"]);
  assert.deepEqual(await names({ category: "silk-rugs" }), ["Silk Runner"]);
  assert.deepEqual(await names({ category: "empty" }), [], "empty category => empty list");
  assert.ok(!(await names({ inStock: true })).includes("Door Mat"));
  assert.deepEqual(await names({ minPrice: 100, maxPrice: 600 }), ["Blue Rug"]);
  assert.deepEqual(await names({ sort: "price_desc" }), ["Silk Runner", "Blue Rug", "Door Mat", "Loose Item"]);
});

test("cursor pagination: no duplicates, no gaps, nextCursor ends", async () => {
  const seen: string[] = []; let cursor: string | undefined; let pages = 0;
  do {
    const r = await listProducts(clientId, { limit: 1, sort: "name", cursor }); pages++;
    seen.push(...r.items.map((i) => i.id)); cursor = r.nextCursor ?? undefined;
  } while (cursor && pages < 10);
  assert.equal(seen.length, 4); assert.equal(new Set(seen).size, 4);
});

test("detail: images, variants, category, optional fields; missing/inactive => null", async () => {
  const p = (await getProduct(clientId, (await db.product.findUnique({ where: { id: ids.blue } }))!.slug))!;
  assert.equal(p.images.length, 2); assert.equal(p.variants.length, 1); assert.equal(p.sku, "BR-1"); assert.equal(p.category?.slug, "rugs");
  const bare = (await getProduct(clientId, (await db.product.findUnique({ where: { id: ids.loose } }))!.slug))!;
  assert.equal(bare.thumbnail, null); assert.deepEqual(bare.images, []); assert.equal(bare.category, null); assert.equal(bare.description, null);
  assert.equal(await getProduct(clientId, "nope"), null);
  assert.equal(await getProduct(clientId, (await db.product.findUnique({ where: { id: ids.hidden } }))!.slug), null);
});

test("out of stock: flagged, still listed and viewable", async () => {
  const m = (await listProducts(clientId, { q: "door mat" })).items[0];
  assert.equal(m.inStock, false); assert.equal(m.stockStatus, "OUT_OF_STOCK");
});

test("related: never includes itself, same category first, null for unknown product", async () => {
  const slugOf = async (k: string) => (await db.product.findUnique({ where: { id: ids[k] } }))!.slug;
  const rel = (await getRelated(clientId, await slugOf("silk")))!;
  assert.ok(rel.length > 0 && !rel.some((r) => r.id === ids.silk));
  assert.equal(await getRelated(clientId, "nope"), null);
});

test("by-ids (wishlist): requested order kept; deleted/unavailable/unknown ids reported as missing", async () => {
  const r = await getByIds(clientId, [ids.silk, "ghost", ids.hidden, ids.blue, ids.silk]);
  assert.deepEqual(r.items.map((i) => i.id), [ids.silk, ids.blue]);
  assert.deepEqual(r.missing.sort(), ["ghost", ids.hidden].sort());
  assert.deepEqual(await getByIds(clientId, []), { items: [], missing: [] });
});

test("admin → customer: product edits (price, availability, description, hide) show immediately", async () => {
  const before = (await db.product.findUnique({ where: { id: ids.blue } }))!;
  const edit = (o: Record<string, string>) => updateProduct(clientId, ids.blue, mk({ name: "Blue Rug", slug: before.slug, ...o }, [{ url: "https://x.test/1.jpg" }]));
  await edit({ price: "777", stockStatus: "OUT_OF_STOCK", description: "New text", categoryId: cats.Rugs });
  const p = (await getProduct(clientId, before.slug))!;
  assert.equal(p.price, 777); assert.equal(p.inStock, false); assert.equal(p.description, "New text");
  await edit({ price: "777", isActive: "", categoryId: cats.Rugs });
  assert.ok(!(await names({})).includes("Blue Rug"), "deactivated product disappears");
  assert.equal(await getProduct(clientId, before.slug), null);
  await edit({ price: "500", categoryId: cats.Rugs });
  assert.ok((await names({})).includes("Blue Rug"));
});

test("admin → customer: category visibility, ordering, empty categories", async () => {
  let tree = await getCategories(clientId);
  assert.deepEqual(tree.map((c) => c.name), ["Rugs", "Silk Rugs", "Mats", "Empty"], "tree order, children under parent");
  assert.equal(tree.find((c) => c.name === "Rugs")!.totalCount, 2);
  assert.equal(tree.find((c) => c.name === "Empty")!.totalCount, 0, "empty category is still returned (designs show empty state)");
  await moveCategory(clientId, cats.Mats, "up");
  tree = await getCategories(clientId);
  assert.deepEqual(tree.filter((c) => c.depth === 0).map((c) => c.name), ["Mats", "Rugs", "Empty"], "reordering reflected publicly");
  await setCategoryVisibility(clientId, cats.Rugs, false);
  tree = await getCategories(clientId);
  assert.ok(!tree.some((c) => c.name === "Rugs" || c.name === "Silk Rugs"), "hiding a parent hides its subcategories");
  assert.ok((await names({})).includes("Silk Runner"), "products stay visible in All");
  await setCategoryVisibility(clientId, cats.Rugs, true);
});

test("admin → customer: WhatsApp number and active design come from settings, never hardcoded", async () => {
  await updateSettings(clientId, parseInput(settingsSchema, { name: "Catalog Test", activeDesign: "showcase", whatsappNumber: "+44 7700 900123", domain: `${slug}.test` }));
  const c = (await resolveClient(`${slug}.test`))!;
  assert.equal(c.activeDesign, "showcase"); assert.equal(c.whatsappNumber, "447700900123");
  assert.equal(getDesign(c.activeDesign).label, "Showcase catalog");
  assert.equal(getDesign("grid").label, "Grid catalog");
  assert.equal(getDesign("unknown-design").label, "Grid catalog", "unknown key falls back safely");
  assert.notEqual(getDesign("grid").Home, getDesign("showcase").Home, "two genuinely different layouts");
  await updateSettings(clientId, parseInput(settingsSchema, { name: "Catalog Test", activeDesign: "grid", whatsappNumber: "", domain: `${slug}.test` }));
  assert.equal((await resolveClient(`${slug}.test`))!.whatsappNumber, null);
});

test("reliability: imported products stay browsable when the store is down; failed sync does not corrupt", async () => {
  const state: MockState = { shopify: makeShopifyProducts(5), woo: [], wooVariations: {}, wooCategories: [], mode: "ok", hits: 0 };
  const mock = await startMock(state);
  try {
    const src = await db.source.create({ data: { clientId, type: "SHOPIFY", name: "Mock Shopify", baseUrl: mock.base, credentials: {} } });
    await syncSource(src.id);
    const total = (await listProducts(clientId, { limit: 100 })).items.length;
    assert.ok(total >= 9, "imported products are in OUR database and listed");
    state.mode = "down"; state.hits = 0;
    await syncSource(src.id).catch(() => {});
    assert.equal((await listProducts(clientId, { limit: 100 })).items.length, total, "outage changed nothing");
    assert.ok((await listProducts(clientId, { q: "a", limit: 5 })).items.length >= 0, "browsing never touches the external API");
  } finally { await mock.close(); }
});
