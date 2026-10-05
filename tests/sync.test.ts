// Integration tests for the import/sync engine against a real PostgreSQL (DATABASE_URL) and
// local mock Shopify/WooCommerce servers. Data lives under a throwaway Client and is removed afterwards.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { syncSource, SyncBusyError } from "../lib/sync/engine";
import { htmlToText, cleanUrl, slugify } from "../lib/sync/text";
import { makeShopifyProducts, makeWoo, startMock, type MockState } from "./helpers";

const state: MockState = { shopify: [], woo: [], wooVariations: {}, wooCategories: [], mode: "ok", hits: 0 };
let mock: Awaited<ReturnType<typeof startMock>>;
let clientId: string, shopifyId: string, wooId: string;

before(async () => {
  mock = await startMock(state);
  const c = await db.client.create({ data: { name: "Sync Test", slug: `sync-test-${Date.now()}` } });
  clientId = c.id;
  state.shopify = makeShopifyProducts(55);
  state.shopify[3].variants[0].price = "oops"; // un-importable: must be recorded, not imported
  const woo = makeWoo(55);
  state.woo = woo.products; state.wooVariations = woo.variations; state.wooCategories = woo.cats;
  shopifyId = (await db.source.create({ data: { clientId, type: "SHOPIFY", name: "S", credentials: { shopDomain: mock.base, pageSize: "20" } } })).id; // 20/page => multi-page
  wooId = (await db.source.create({ data: { clientId, type: "WOOCOMMERCE", name: "W", baseUrl: mock.base, credentials: { siteUrl: mock.base, consumerKey: "ck_test", consumerSecret: "cs_test" } } })).id;
});
after(async () => {
  await db.client.delete({ where: { id: clientId } }).catch(() => {});
  await mock?.close();
  await db.$disconnect();
});

const count = (sourceId: string, extra: object = {}) => db.product.count({ where: { sourceId, ...extra } });

test("text helpers", () => {
  assert.equal(htmlToText("<p>A &amp; B</p><ul><li>x</li></ul>"), "A & B\n• x");
  assert.equal(htmlToText("  "), null);
  assert.equal(cleanUrl("//cdn.x.com/a.jpg"), "https://cdn.x.com/a.jpg");
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(slugify("Ünïcode Rug & Co."), "unicode-rug-co");
});

test("Shopify import: 54 products created across pages, bad product recorded not imported", async () => {
  const r = await syncSource(shopifyId, { trigger: "import" });
  assert.equal(r.created, 54);
  assert.equal(r.failed, 1);
  assert.equal(r.status, "PARTIAL");
  assert.equal(await count(shopifyId), 54);
  const errs = await db.syncError.findMany({ where: { runId: r.runId } });
  assert.equal(errs.length, 1);
  assert.equal(errs[0].externalId, "1003");
  const src = await db.source.findUniqueOrThrow({ where: { id: shopifyId } });
  assert.ok(src.lastSyncAt, "lastSyncAt recorded");
  // variants + images + stock + missing image
  const multi = await db.product.findFirstOrThrow({ where: { sourceId: shopifyId, externalId: "1000" }, include: { variants: true, images: true } });
  assert.equal(multi.variants.length, 2);
  assert.equal(Number(multi.price), 100); // cheapest variant
  assert.equal(multi.stockStatus, "IN_STOCK");
  assert.equal(multi.images.length, 0);
  assert.equal(multi.thumbnailUrl, null); // missing image handled
  const withImg = await db.product.findFirstOrThrow({ where: { sourceId: shopifyId, externalId: "1001" }, include: { images: { orderBy: { position: "asc" } } } });
  assert.equal(withImg.images[1].url, "https://cdn.example.com/s1-2.jpg"); // protocol-relative fixed
  assert.equal(withImg.description, "Description 1 & more");
  assert.ok(withImg.sourceUrl?.endsWith("/products/shopify-item-1"));
  const cats = await db.category.findMany({ where: { clientId } });
  assert.equal(cats.length, 3);
});

test("Re-running sync creates no duplicates and rewrites nothing", async () => {
  const r = await syncSource(shopifyId);
  assert.equal(r.created, 0);
  assert.equal(r.updated, 0);
  assert.equal(r.unchanged, 54);
  assert.equal(await count(shopifyId), 54);
  assert.equal(await db.category.count({ where: { clientId } }), 3);
});

test("Detects price, description, images, stock and variant changes", async () => {
  const p = state.shopify;
  p[1].variants[0].price = "999.00";                                  // price
  p[2].body_html = "<p>Brand new copy</p>";                          // description
  p[4].images = [{ src: "https://cdn.example.com/new.jpg" }];        // images
  p[8].variants[0].inventory_management = "shopify";                  // stock: now tracked + 0 qty => out of stock
  p[10].variants[1].title = "XL"; p[10].variants[1].option1 = "XL";  // variants
  const r = await syncSource(shopifyId);
  assert.equal(r.updated, 5);
  assert.equal(r.unchanged, 49);
  assert.equal(r.changes.price, 1);
  assert.equal(r.changes.description, 1);
  assert.equal(r.changes.images, 1);
  assert.equal(r.changes.stock, 1);
  assert.equal(r.changes.variants, 1);
  const get = (ext: string) => db.product.findFirstOrThrow({ where: { sourceId: shopifyId, externalId: ext }, include: { images: true, variants: true } });
  assert.equal(Number((await get("1001")).price), 999);
  assert.equal((await get("1002")).description, "Brand new copy");
  const img = await get("1004");
  assert.deepEqual(img.images.map((i) => i.url), ["https://cdn.example.com/new.jpg"]);
  assert.equal(img.thumbnailUrl, "https://cdn.example.com/new.jpg");
  assert.equal((await get("1008")).stockStatus, "OUT_OF_STOCK");
  assert.ok((await get("1010")).variants.some((v) => v.title === "XL"));
  assert.equal(await count(shopifyId), 54);
});

test("Source outage is non-destructive and recorded", async () => {
  const before = await db.source.findUniqueOrThrow({ where: { id: shopifyId } });
  state.mode = "down";
  const r = await syncSource(shopifyId);
  state.mode = "ok";
  assert.equal(r.status, "FAILED");
  assert.equal(await count(shopifyId, { isActive: true }), 54); // everything still published
  const after = await db.source.findUniqueOrThrow({ where: { id: shopifyId } });
  assert.equal(after.lastSyncStatus, "FAILED");
  assert.equal(after.lastSyncAt?.getTime(), before.lastSyncAt?.getTime()); // last SUCCESSFUL sync preserved
  assert.ok((await db.syncError.count({ where: { runId: r.runId } })) >= 1);
});

test("Empty response for a known catalog is refused", async () => {
  state.mode = "empty";
  const r = await syncSource(shopifyId);
  state.mode = "ok";
  assert.equal(r.status, "FAILED");
  assert.equal(await count(shopifyId, { isActive: true }), 54);
});

test("Product removed at source is hidden, and restored when it returns", async () => {
  const removed = state.shopify.splice(20, 1)[0];
  let r = await syncSource(shopifyId);
  assert.equal(r.deactivated, 1);
  assert.equal(await count(shopifyId, { isActive: true }), 53);
  assert.equal(await count(shopifyId), 54); // never deleted
  state.shopify.splice(20, 0, removed);
  r = await syncSource(shopifyId);
  assert.equal(await count(shopifyId, { isActive: true }), 54);
  assert.equal(await count(shopifyId), 54);
});

test("Admin manual overrides survive sync", async () => {
  const prod = await db.product.findFirstOrThrow({ where: { sourceId: shopifyId, externalId: "1005" } });
  await db.product.update({ where: { id: prod.id }, data: { price: 1, manualOverrides: { price: true } } });
  state.shopify[5].variants[0].price = "777.00";
  state.shopify[5].body_html = "<p>source changed desc</p>";
  await syncSource(shopifyId);
  const after = await db.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(Number(after.price), 1);                       // overridden, kept
  assert.equal(after.description, "source changed desc");     // not overridden, updated
});

test("Shopify Admin API mode (token + Link-header pagination)", async () => {
  const s = await db.source.create({ data: { clientId, type: "SHOPIFY", name: "S-admin", credentials: { shopDomain: mock.base, accessToken: "shpat_test", pageSize: "20" } } });
  const r = await syncSource(s.id);
  assert.equal(r.created, 54);
  const bad = await db.source.create({ data: { clientId, type: "SHOPIFY", name: "S-bad", credentials: { shopDomain: mock.base, accessToken: "wrong" } } });
  assert.equal((await syncSource(bad.id)).status, "FAILED");
});

test("WooCommerce import: 55 products, variations, hierarchy, sale price, stock", async () => {
  const r = await syncSource(wooId, { trigger: "import" });
  assert.equal(r.created, 55);
  assert.equal(r.status, "SUCCESS");
  assert.equal(await count(wooId), 55);
  const variable = await db.product.findFirstOrThrow({ where: { sourceId: wooId, externalId: "5000" }, include: { variants: true } });
  assert.equal(variable.variants.length, 2);
  assert.equal(variable.stockStatus, "IN_STOCK"); // one variation in stock
  const sale = await db.product.findFirstOrThrow({ where: { sourceId: wooId, externalId: "5004" } });
  assert.equal(Number(sale.price), 80);
  assert.equal(Number(sale.compareAtPrice), 100);
  const oos = await db.product.findFirstOrThrow({ where: { sourceId: wooId, externalId: "5008" } });
  assert.equal(oos.stockStatus, "OUT_OF_STOCK");
  const noImg = await db.product.findFirstOrThrow({ where: { sourceId: wooId, externalId: "5010" } });
  assert.equal(noImg.thumbnailUrl, null);
  const living = await db.category.findFirstOrThrow({ where: { clientId, slug: "living-room" } });
  const carpets = await db.category.findFirstOrThrow({ where: { clientId, slug: "carpets" } });
  assert.equal(living.parentId, carpets.id);
  // "Curtains" came from both Shopify (product_type) and Woo: merged, not duplicated
  assert.equal(await db.category.count({ where: { clientId, slug: "curtains" } }), 1);
});

test("WooCommerce: wrong credentials fail safely; unchanged re-sync", async () => {
  const bad = await db.source.create({ data: { clientId, type: "WOOCOMMERCE", name: "W-bad", baseUrl: mock.base, credentials: { siteUrl: mock.base, consumerKey: "x", consumerSecret: "y" } } });
  const r = await syncSource(bad.id);
  assert.equal(r.status, "FAILED");
  assert.match(r.message, /credentials|401/i);
  const again = await syncSource(wooId);
  assert.equal(again.unchanged, 55);
  assert.equal(again.created + again.updated, 0);
});

test("Only one run at a time per source", async () => {
  const run = await db.syncRun.create({ data: { sourceId: wooId } }); // simulates a run in progress
  await assert.rejects(() => syncSource(wooId), SyncBusyError);
  await db.syncRun.update({ where: { id: run.id }, data: { status: "SUCCESS" } });
  await syncSource(wooId); // runs again once free
});

test("Slug collisions across sources never break an import", async () => {
  const dup = makeWoo(1).products[0];
  dup.id = 9001; dup.name = "Shopify Item 1"; // same name (=> same slug) as an existing Shopify product
  state.woo.push(dup);
  const r = await syncSource(wooId);
  assert.equal(r.created, 1);
  assert.equal(r.failed, 0);
  assert.equal(await db.product.count({ where: { clientId, slug: "shopify-item-1" } }), 1);
});
