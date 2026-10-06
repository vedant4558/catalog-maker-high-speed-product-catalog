// Sorting on the REAL query path (lib/catalog/queries.ts = what /api/v1/products and both catalog designs use),
// against real PostgreSQL. Sort must happen in the database BEFORE pagination, numerically for prices.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { listProducts, type ProductQuery } from "../lib/catalog/queries";
import { catHref, parseHome } from "../lib/shop";

let clientId = "";
const slug = `sort-test-${Date.now()}`;
// price, name (mixed case on purpose), category, stock, created (minutes ago)
const ROWS: [number, string, "a" | "b", boolean, number][] = [
  [1000, "Shoes Rack", "a", true, 50],
  [99, "apple Mat", "a", true, 10], // lowercase first letter: must still sort with "A"
  [250, "Camera Bag", "b", false, 30],
  [999, "banana Rug", "b", true, 40],
  [100, "Zebra Rug", "a", true, 20],
  [100, "Shirt Rug", "b", true, 60], // same price as Zebra: tie broken by id, never duplicated across pages
  [5000, "Delta Rug", "a", true, 5]
];
const byName = (n: string) => ROWS.find((r) => r[1] === n)!;

before(async () => {
  const c = await db.client.create({ data: { name: "Sort Test", slug } });
  clientId = c.id;
  const cats = { a: await db.category.create({ data: { clientId, name: "A", slug: "cat-a" } }), b: await db.category.create({ data: { clientId, name: "B", slug: "cat-b" } }) };
  for (const [price, name, cat, inStock, minsAgo] of ROWS) {
    await db.product.create({ data: { clientId, name, slug: name.toLowerCase().replace(/\s+/g, "-"), price, categoryId: cats[cat].id, stockStatus: inStock ? "IN_STOCK" : "OUT_OF_STOCK", createdAt: new Date(Date.now() - minsAgo * 60_000) } });
  }
});
after(async () => { await db.client.delete({ where: { id: clientId } }).catch(() => {}); await db.$disconnect(); });

/** Walk every page exactly like "load more" does (cursor from the previous page). */
async function all(q: ProductQuery, pageSize = 2) {
  const out: { name: string; price: number }[] = []; let cursor: string | undefined; let guard = 0;
  do {
    const r = await listProducts(clientId, { ...q, limit: pageSize, cursor });
    out.push(...r.items.map((i) => ({ name: i.name, price: i.price })));
    cursor = r.nextCursor ?? undefined;
  } while (cursor && ++guard < 50);
  return out;
}
const prices = (r: { price: number }[]) => r.map((x) => x.price);
const names = (r: { name: string }[]) => r.map((x) => x.name);

test("price low → high is NUMERIC (99, 100, 250, 999, 1000 — never '100, 1000, 250, 99')", async () => {
  const r = await all({ sort: "price_asc" });
  assert.deepEqual(prices(r), [99, 100, 100, 250, 999, 1000, 5000]);
});

test("price high → low is numeric", async () => {
  assert.deepEqual(prices(await all({ sort: "price_desc" })), [5000, 1000, 999, 250, 100, 100, 99]);
});

test("newest = real createdAt, newest first", async () => {
  const expected = [...ROWS].sort((a, b) => a[4] - b[4]).map((r) => r[1]);
  assert.deepEqual(names(await all({ sort: "newest" })), expected);
  assert.deepEqual(names(await all({})), expected, "newest is the default");
});

test("name A–Z is alphabetical and case-insensitive", async () => {
  assert.deepEqual(names(await all({ sort: "name" })), ["apple Mat", "banana Rug", "Camera Bag", "Delta Rug", "Shirt Rug", "Shoes Rack", "Zebra Rug"]);
});

test("sorting happens BEFORE pagination: page 1 holds the globally first items, pages never overlap", async () => {
  for (const sort of ["newest", "price_asc", "price_desc", "name"] as const) {
    const whole = (await listProducts(clientId, { sort, limit: 48 })).items.map((i) => i.name);
    for (const size of [1, 2, 3]) {
      const paged = names(await all({ sort }, size));
      assert.deepEqual(paged, whole, `${sort} with page size ${size}`);
      assert.equal(new Set(paged).size, ROWS.length, "no duplicates / gaps");
    }
  }
  const first = await listProducts(clientId, { sort: "price_asc", limit: 2 });
  assert.deepEqual(first.items.map((i) => i.price), [99, 100], "first page = cheapest overall");
});

test("sort + search / category / in-stock filters work together (and every sort returns the same set)", async () => {
  assert.deepEqual(prices(await all({ sort: "price_asc", q: "rug" })), [100, 100, 999, 5000]);
  assert.deepEqual(names(await all({ sort: "name", q: "RUG" })), ["banana Rug", "Delta Rug", "Shirt Rug", "Zebra Rug"]);
  assert.deepEqual(prices(await all({ sort: "price_desc", category: "cat-a" })), [5000, 1000, 100, 99]);
  assert.deepEqual(names(await all({ sort: "name", category: "cat-b" })), ["banana Rug", "Camera Bag", "Shirt Rug"]);
  assert.ok(!names(await all({ sort: "price_asc", inStock: true })).includes("Camera Bag"));
  assert.deepEqual(prices(await all({ sort: "price_asc", inStock: true, category: "cat-b" })), [100, 999]);
  assert.deepEqual(names(await all({ sort: "name", minPrice: 100, maxPrice: 999 })), ["banana Rug", "Camera Bag", "Shirt Rug", "Zebra Rug"]);
  assert.deepEqual(await all({ sort: "name", q: "50%_" }), [], "LIKE wildcards in search are plain text");
  const filters: ProductQuery[] = [{}, { q: "rug" }, { category: "cat-a" }, { inStock: true }, { q: "a", inStock: true, category: "cat-b" }];
  for (const f of filters) {
    const sets = await Promise.all((["newest", "price_asc", "price_desc", "name"] as const).map(async (sort) => names(await all({ ...f, sort })).sort().join("|")));
    assert.equal(new Set(sets).size, 1, `same products for every sort with ${JSON.stringify(f)}`);
  }
});

test("customer page: the chosen sort reaches the query, 'load more' and category/search links", () => {
  const h = parseHome({ sort: "price_asc", category: "cat-a", inStock: "1" });
  assert.equal(h.query.sort, "price_asc");
  assert.match(h.qs, /sort=price_asc/, "load-more requests keep the sort");
  assert.equal(catHref("cat-b", h.keep), "/?sort=price_asc&inStock=1&category=cat-b", "category links keep sort + stock filter");
  assert.equal(parseHome({ sort: "bogus" }).sort, "newest");
  assert.deepEqual(parseHome({}).keep, {});
  void byName;
});
