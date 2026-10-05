// Part 3 tests: session/auth guard (pure) + admin services against real PostgreSQL (DATABASE_URL),
// including the interaction between admin edits and the Part 2 sync engine. Uses a throwaway Client.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { createSessionToken, verifySessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../lib/session";
import { requireAdmin } from "../lib/auth";
import { productSchema, categorySchema, settingsSchema, parseInput } from "../lib/admin/validators";
import { ValidationError } from "../lib/admin/results";
import { createProduct, updateProduct, deleteProduct, listProducts, getProductForEdit } from "../lib/admin/services/products";
import { createCategory, updateCategory, moveCategory, deleteCategory, listCategoryTree, setCategoryVisibility } from "../lib/admin/services/categories";
import { updateSettings } from "../lib/admin/services/settings";
import { listSourcesWithStatus, createSource } from "../lib/admin/services/sources";
import { credentialStatus } from "../lib/sync/adapters";
import { syncSource } from "../lib/sync/engine";
import { makeShopifyProducts, startMock, type MockState } from "./helpers";

const PW = "correct-horse-battery-staple-123";
process.env.ADMIN_PASSWORD = PW;

// ---------------------------------------------------------------- auth (no database needed)
test("session token: valid, tampered, expired, wrong key, garbage", async () => {
  const t = (await createSessionToken()) as string;
  assert.ok(t && !t.includes(PW), "token never contains the password");
  assert.equal(await verifySessionToken(t), true);
  assert.equal(await verifySessionToken(t.slice(0, -2) + "xx"), false, "tampered signature");
  const parts = t.split("."); parts[1] = String(Date.now() + 10 ** 9);
  assert.equal(await verifySessionToken(parts.join(".")), false, "tampered expiry");
  assert.equal(await verifySessionToken(t, Date.now() + (SESSION_TTL_SECONDS + 5) * 1000), false, "expired");
  for (const g of ["", "abc", "v1.1.2.3", undefined, null, "v1." + "x".repeat(500)]) assert.equal(await verifySessionToken(g as string), false);
  process.env.ADMIN_PASSWORD = "a-different-password-entirely";
  assert.equal(await verifySessionToken(t), false, "changing the password ends every session");
  process.env.ADMIN_PASSWORD = PW;
});

const req = (method: string, headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/admin/sources", { method, headers });
const status = async (r: Request) => { try { await requireAdmin(r); return 200; } catch (e: any) { return e.status as number; } };

test("requireAdmin: bearer, cookie, CSRF origin check, fail-closed", async () => {
  const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
  assert.equal(await status(req("GET")), 401);
  assert.equal(await status(req("GET", { authorization: `Bearer ${PW}` })), 200);
  assert.equal(await status(req("GET", { authorization: "Bearer wrong" })), 401);
  assert.equal(await status(req("GET", { cookie: `${SESSION_COOKIE}=forged.token.value.here` })), 401);
  assert.equal(await status(req("GET", { cookie })), 200);
  assert.equal(await status(req("POST", { cookie })), 403, "cookie POST without Origin");
  assert.equal(await status(req("POST", { cookie, origin: "https://evil.example", host: "localhost:3000" })), 403, "cross-site origin");
  assert.equal(await status(req("POST", { cookie, origin: "http://localhost:3000", host: "localhost:3000" })), 200);
  assert.equal(await status(req("POST", { authorization: `Bearer ${PW}` })), 200, "bearer needs no origin");
  delete process.env.ADMIN_PASSWORD;
  assert.equal(await status(req("GET", { authorization: `Bearer ${PW}` })), 503, "no password configured => closed");
  process.env.ADMIN_PASSWORD = PW;
});

// ---------------------------------------------------------------- validation (no database needed)
const base = { name: "Test", price: "100", stockStatus: "IN_STOCK", isActive: "on" };
const bad = (raw: object) => { try { parseInput(productSchema, raw); return null; } catch (e) { return e instanceof ValidationError ? e.fieldErrors : "other"; } };

test("product validation", () => {
  assert.ok(parseInput(productSchema, base));
  assert.ok((bad({ ...base, name: "  " }) as any).name);
  assert.ok((bad({ ...base, price: "abc" }) as any).price);
  assert.ok((bad({ ...base, price: "-5" }) as any).price);
  assert.ok((bad({ ...base, price: "" }) as any).price);
  assert.ok((bad({ ...base, stockStatus: "BOGUS" }) as any).stockStatus);
  assert.ok((bad({ ...base, compareAtPrice: "50" }) as any).compareAtPrice);
  assert.ok((bad({ ...base, stockQty: "1.5" }) as any).stockQty);
  assert.ok((bad({ ...base, sourceUrl: "javascript:alert(1)" }) as any).sourceUrl);
  assert.ok((bad({ ...base, metadata: "[1,2]" }) as any).metadata);
  assert.ok((bad({ ...base, images: JSON.stringify([{ url: "ftp://x" }]) }) as any).images);
  assert.ok((bad({ ...base, variants: JSON.stringify([{ title: "", stockStatus: "IN_STOCK" }]) }) as any).variants);
  const ok = parseInput(productSchema, { ...base, price: "1,299.5", images: JSON.stringify([{ url: "https://a.com/1.jpg" }]), variants: JSON.stringify([{ title: "L", stockStatus: "IN_STOCK", price: "" }]) });
  assert.equal(ok.price, 1299.5); assert.equal(ok.images.length, 1); assert.equal(ok.variants[0].price, null);
});

test("settings & category validation", () => {
  const s = (o: object) => { try { return parseInput(settingsSchema, { name: "X", activeDesign: "grid", ...o }); } catch (e) { return (e as ValidationError).fieldErrors; } };
  assert.equal((s({ whatsappNumber: "+91 98765-43210" }) as any).whatsappNumber, "919876543210");
  assert.equal((s({ whatsappNumber: "" }) as any).whatsappNumber, null);
  assert.ok((s({ whatsappNumber: "12" }) as any).whatsappNumber);
  assert.ok((s({ activeDesign: "nope" }) as any).activeDesign);
  assert.equal((s({ domain: "https://Catalog.Example.com/path" }) as any).domain, "catalog.example.com");
  assert.ok((s({ domain: "not a domain" }) as any).domain);
  assert.throws(() => parseInput(categorySchema, { name: "A", slug: "Bad Slug!" }));
});

// ---------------------------------------------------------------- database-backed
const state: MockState = { shopify: [], woo: [], wooVariations: {}, wooCategories: [], mode: "ok", hits: 0 };
let mock: Awaited<ReturnType<typeof startMock>>;
let clientId: string; let client: { currency: string };
const mk = (o: Record<string, string> = {}, imgs: object[] = [], vars: object[] = []) =>
  parseInput(productSchema, { ...base, images: JSON.stringify(imgs), variants: JSON.stringify(vars), ...o });

before(async () => {
  mock = await startMock(state);
  const c = await db.client.create({ data: { name: "Admin Test", slug: `admin-test-${Date.now()}` } });
  clientId = c.id; client = c;
});
after(async () => { await db.client.delete({ where: { id: clientId } }).catch(() => {}); await mock?.close(); await db.$disconnect(); });

test("manual product: create, thumbnail, slug uniqueness, update, list/search, delete", async () => {
  const cat = await createCategory(clientId, parseInput(categorySchema, { name: "Rugs", isVisible: "on" }));
  const a = await createProduct(clientId, client, mk({ name: "Blue Rug", sku: "BR-1", categoryId: cat.id }, [{ url: "https://x.com/1.jpg" }, { url: "https://x.com/2.jpg" }], [{ title: "Small", stockStatus: "IN_STOCK", price: "90", options: "Size=S; Color=Blue" }]));
  const b = await createProduct(clientId, client, mk({ name: "Blue Rug" }));
  const pa = (await getProductForEdit(clientId, a.id))!, pb = (await getProductForEdit(clientId, b.id))!;
  assert.equal(pa.thumbnailUrl, "https://x.com/1.jpg");
  assert.equal(pb.thumbnailUrl, null, "no images => null thumbnail");
  assert.notEqual(pa.slug, pb.slug, "auto slug made unique");
  assert.deepEqual(pa.variants[0].options, { Size: "S", Color: "Blue" });
  await assert.rejects(() => createProduct(clientId, client, mk({ name: "Other", slug: pa.slug })), ValidationError);
  await assert.rejects(() => createProduct(clientId, client, mk({ name: "Bad cat", categoryId: "does-not-exist" })), ValidationError);

  await updateProduct(clientId, a.id, mk({ name: "Blue Rug v2", sku: "BR-1", price: "250", stockStatus: "OUT_OF_STOCK", description: "New text", categoryId: cat.id }, [{ url: "https://x.com/9.jpg" }]));
  const u = (await getProductForEdit(clientId, a.id))!;
  assert.equal(Number(u.price), 250); assert.equal(u.stockStatus, "OUT_OF_STOCK"); assert.equal(u.thumbnailUrl, "https://x.com/9.jpg");
  assert.equal(u.images.length, 1); assert.equal(u.variants.length, 0); assert.equal(u.manualOverrides, null, "manual products carry no sync locks");

  assert.equal((await listProducts(clientId, { q: "BR-1" })).total, 1);
  assert.equal((await listProducts(clientId, { stock: "OUT_OF_STOCK" })).total, 1);
  assert.equal((await listProducts(clientId, { categoryId: cat.id })).total, 2 - 1);
  assert.equal((await listProducts(clientId, { categoryId: "none" })).total, 1);
  assert.equal((await listProducts(clientId, { pageSize: 1 })).pages, 2);

  await deleteProduct(clientId, b.id);
  assert.equal(await getProductForEdit(clientId, b.id), null);
  await assert.rejects(() => deleteProduct(clientId, b.id), ValidationError);
  // other clients' data is untouchable
  const other = await db.client.create({ data: { name: "Other", slug: `other-${Date.now()}` } });
  await assert.rejects(() => updateProduct(other.id, a.id, mk({})), ValidationError);
  await assert.rejects(() => deleteProduct(other.id, a.id), ValidationError);
  await db.client.delete({ where: { id: other.id } });
});

test("admin edits of a synced product survive the next sync (locks), and can be unlocked", async () => {
  state.shopify = makeShopifyProducts(6);
  const src = await db.source.create({ data: { clientId, type: "SHOPIFY", name: "S", credentials: { shopDomain: mock.base } } });
  await syncSource(src.id, { trigger: "import" });
  const p = (await db.product.findFirstOrThrow({ where: { sourceId: src.id, externalId: "1001" } }));
  const ex = (await getProductForEdit(clientId, p.id))!;

  // admin changes price + description + availability; sync lock is on
  // like the real edit form, always send every field with its current value
  const metaText = ex.metadata ? JSON.stringify(ex.metadata) : "";
  const input = (o: Record<string, string>, lock = true) => mk({ name: ex.name, sku: ex.sku ?? "", categoryId: ex.categoryId ?? "", metadata: metaText, price: String(Number(ex.price)), stockStatus: ex.stockStatus, description: ex.description ?? "", ...(lock ? { lock: "on" } : {}), ...o },
    ex.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })));
  const r = await updateProduct(clientId, p.id, input({ price: "5", description: "My copy", stockStatus: "OUT_OF_STOCK" }));
  assert.deepEqual(r.locked.sort(), ["description", "price", "stockStatus"]);

  // the source changes all three, plus the name
  state.shopify[1].variants[0].price = "888.00"; state.shopify[1].body_html = "<p>source copy</p>"; state.shopify[1].title = "Renamed At Source";
  const run = await syncSource(src.id);
  assert.equal(run.status, "SUCCESS");
  let after = (await getProductForEdit(clientId, p.id))!;
  assert.equal(Number(after.price), 5, "price lock held");
  assert.equal(after.description, "My copy", "description lock held");
  assert.equal(after.stockStatus, "OUT_OF_STOCK", "availability lock held");
  assert.equal(after.name, "Renamed At Source", "unlocked field follows the source");

  // unlock price: the following sync takes the source value again
  await updateProduct(clientId, p.id, mk({ name: after.name, sku: after.sku ?? "", categoryId: after.categoryId ?? "", metadata: metaText, price: "5", stockStatus: "OUT_OF_STOCK", description: "My copy", lock: "on", unlock: "price" }, after.images.map((i) => ({ url: i.url, alt: i.alt ?? "" }))));
  state.shopify[1].variants[0].price = "999.00";
  await syncSource(src.id);
  after = (await getProductForEdit(clientId, p.id))!;
  assert.equal(Number(after.price), 999);
  assert.equal(after.description, "My copy");

  // locking variants + metadata (engine support added for Part 3)
  await updateProduct(clientId, p.id, mk({ name: after.name, sku: after.sku ?? "", categoryId: after.categoryId ?? "", price: "999", stockStatus: "OUT_OF_STOCK", description: "My copy", lock: "on", metadata: '{"note":"mine"}' }, after.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })), [{ title: "Custom", stockStatus: "IN_STOCK", price: "", options: "" }]));
  state.shopify[1].variants[0].title = "Default Title X"; state.shopify[1].tags = "changed";
  await syncSource(src.id);
  after = (await getProductForEdit(clientId, p.id))!;
  assert.deepEqual(after.variants.map((v) => v.title), ["Custom"]);
  assert.deepEqual(after.metadata, { note: "mine" });
});

test("categories: tree, cycles, ordering, visibility, safe delete", async () => {
  const mkc = (name: string, parentId = "") => createCategory(clientId, parseInput(categorySchema, { name, parentId, isVisible: "on" }));
  const A = await mkc("Zeta A"), B = await mkc("Zeta B"), C = await mkc("Zeta C");
  const A1 = await mkc("Zeta A1", A.id), A2 = await mkc("Zeta A2", A.id);
  const tree = (await listCategoryTree(clientId)).filter((c) => c.name.startsWith("Zeta"));
  assert.deepEqual(tree.map((c) => `${c.depth}:${c.name}`), ["0:Zeta A", "1:Zeta A1", "1:Zeta A2", "0:Zeta B", "0:Zeta C"]);

  // cycles are refused
  await assert.rejects(() => updateCategory(clientId, A.id, parseInput(categorySchema, { name: "Zeta A", parentId: A1.id })), ValidationError);
  await assert.rejects(() => updateCategory(clientId, A.id, parseInput(categorySchema, { name: "Zeta A", parentId: A.id })), ValidationError);

  // ordering
  await moveCategory(clientId, C.id, "up");
  let names = (await listCategoryTree(clientId)).filter((c) => c.name.startsWith("Zeta") && c.depth === 0).map((c) => c.name);
  assert.deepEqual(names, ["Zeta A", "Zeta C", "Zeta B"]);
  await moveCategory(clientId, A.id, "up"); // already first: no-op, no error
  await moveCategory(clientId, A2.id, "up");
  assert.deepEqual((await listCategoryTree(clientId)).filter((c) => c.depth === 1 && c.parentId === A.id).map((c) => c.name), ["Zeta A2", "Zeta A1"]);

  // visibility
  await setCategoryVisibility(clientId, B.id, false);
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: B.id } })).isVisible, false);

  // products survive category deletion, moved or uncategorised
  const p1 = await createProduct(clientId, client, mk({ name: "In A", categoryId: A.id }));
  const p2 = await createProduct(clientId, client, mk({ name: "In A1", categoryId: A1.id }));
  const res = await deleteCategory(clientId, A.id, B.id);
  assert.equal(res.productsMoved, 1); assert.equal(res.subcategoriesMoved, 2);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p1.id } })).categoryId, B.id);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p2.id } })).categoryId, A1.id, "subcategory kept its products");
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: A1.id } })).parentId, B.id);

  await assert.rejects(() => deleteCategory(clientId, B.id, A1.id), ValidationError, "can't move into own descendant");
  const r2 = await deleteCategory(clientId, B.id, null); // no target: products uncategorised, children promoted
  assert.equal(r2.subcategoriesMoved, 2);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p1.id } })).categoryId, null);
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: A1.id } })).parentId, null);
  assert.ok(await db.product.findUnique({ where: { id: p1.id } }), "product still exists");
  await assert.rejects(() => deleteCategory(clientId, B.id, null), ValidationError);
});

test("settings: save, normalise, reject duplicate domain", async () => {
  await updateSettings(clientId, parseInput(settingsSchema, { name: "New Name", whatsappNumber: "+91 91234 56789", activeDesign: "showcase", domain: "shop.example.org" }));
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(c.whatsappNumber, "919123456789"); assert.equal(c.activeDesign, "showcase"); assert.equal(c.domain, "shop.example.org");
  const other = await db.client.create({ data: { name: "O2", slug: `o2-${Date.now()}` } });
  await assert.rejects(() => updateSettings(other.id, parseInput(settingsSchema, { name: "O2", activeDesign: "grid", domain: "shop.example.org" })), ValidationError);
  await db.client.delete({ where: { id: other.id } });
});

test("sources: credential status never exposes secrets; placeholders count as missing", async () => {
  const keep = { ...process.env };
  for (const k of ["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ACCESS_TOKEN", "WOOCOMMERCE_SITE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"]) delete process.env[k];
  const woo = { type: "WOOCOMMERCE" as const, baseUrl: "https://your-wordpress-site.com", credentials: { consumerKey: "ck_placeholder", consumerSecret: "cs_placeholder" } };
  const st = credentialStatus(woo);
  assert.equal(st.ok, false); assert.deepEqual(st.missing, ["WooCommerce site URL", "consumer key", "consumer secret"]);
  process.env.WOOCOMMERCE_CONSUMER_KEY = "ck_REALKEY123"; process.env.WOOCOMMERCE_CONSUMER_SECRET = "cs_REALSECRET456";
  assert.equal(credentialStatus({ ...woo, baseUrl: "https://shop.example.com" }).ok, true);
  assert.equal(credentialStatus({ type: "SHOPIFY", baseUrl: "your-store.myshopify.com", credentials: {} }).ok, false);
  assert.equal(credentialStatus({ type: "SHOPIFY", baseUrl: "my-store.myshopify.com", credentials: {} }).ok, true);

  const s = await createSource(clientId, { type: "WOOCOMMERCE", name: "Woo UI", baseUrl: "https://shop.example.com/" });
  await db.source.update({ where: { id: s.id }, data: { credentials: { consumerKey: "ck_STOREDKEY999", consumerSecret: "cs_STOREDSECRET888" } } });
  const listed = JSON.stringify(await listSourcesWithStatus(clientId));
  for (const secret of ["REALKEY123", "REALSECRET456", "STOREDKEY999", "STOREDSECRET888"]) assert.ok(!listed.includes(secret), `${secret} must never appear in admin data`);
  Object.assign(process.env, keep);
});
