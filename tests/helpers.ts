import http from "node:http";
import type { AddressInfo } from "node:net";

/** Deterministic fake Shopify / WooCommerce stores served over HTTP, with switches to simulate outages. */
export interface MockState {
  shopify: any[];
  woo: any[];
  wooVariations: Record<number, any[]>;
  wooCategories: any[];
  mode: "ok" | "down" | "empty";
  hits: number;
}

export function makeShopifyProducts(n: number) {
  const types = ["Carpets", "Rugs", "Curtains"];
  return Array.from({ length: n }, (_, i) => {
    const id = 1000 + i;
    const multi = i % 5 === 0;
    return {
      id, title: `Shopify Item ${i}`, handle: `shopify-item-${i}`, status: "active", vendor: "Acme", product_type: types[i % 3] ?? "",
      tags: "demo, test", updated_at: "2026-01-01T00:00:00Z",
      body_html: `<p>Description <b>${i}</b> &amp; more</p>`,
      options: multi ? [{ name: "Size", position: 1 }] : [{ name: "Title", position: 1 }],
      variants: multi
        ? [{ id: id * 10 + 1, title: "Small", sku: `S-${i}-S`, price: `${100 + i}.00`, option1: "Small", inventory_management: "shopify", inventory_quantity: 5, inventory_policy: "deny" },
           { id: id * 10 + 2, title: "Large", sku: `S-${i}-L`, price: `${150 + i}.00`, compare_at_price: `${200 + i}.00`, option1: "Large", inventory_management: "shopify", inventory_quantity: 0, inventory_policy: "deny" }]
        : [{ id: id * 10 + 1, title: "Default Title", sku: `S-${i}`, price: `${100 + i}.50`, option1: "Default Title", inventory_management: i % 7 === 0 ? "shopify" : null, inventory_quantity: 0, inventory_policy: "deny" }],
      images: i % 9 === 0 ? [] : [{ src: `https://cdn.example.com/s${i}-1.jpg`, alt: `img ${i}` }, { src: `//cdn.example.com/s${i}-2.jpg` }]
    };
  });
}

export function makeWoo(n: number) {
  const cats = [
    { id: 10, name: "Carpets", slug: "carpets", parent: 0 },
    { id: 11, name: "Living Room", slug: "living-room", parent: 10 },
    { id: 12, name: "Curtains", slug: "curtains", parent: 0 }
  ];
  const variations: Record<number, any[]> = {};
  const products = Array.from({ length: n }, (_, i) => {
    const id = 5000 + i;
    const variable = i % 6 === 0;
    if (variable) variations[id] = [
      { id: id * 10 + 1, sku: `W-${i}-A`, price: "300", regular_price: "300", stock_status: "outofstock", attributes: [{ name: "Color", option: "Red" }] },
      { id: id * 10 + 2, sku: `W-${i}-B`, price: "320", regular_price: "320", stock_status: "instock", attributes: [{ name: "Color", option: "Blue" }] }
    ];
    return {
      id, name: `Woo Item ${i}`, slug: `woo-item-${i}`, permalink: `https://woo.example.com/product/woo-item-${i}/`, type: variable ? "variable" : "simple", status: "publish",
      sku: `W-${i}`, price: i % 4 === 0 ? "80" : "100", regular_price: "100", sale_price: i % 4 === 0 ? "80" : "", on_sale: i % 4 === 0,
      description: `<p>Woo description ${i}</p>`, short_description: "",
      stock_status: i % 8 === 0 ? "outofstock" : "instock", manage_stock: i % 3 === 0, stock_quantity: i % 3 === 0 ? 7 : null,
      categories: [i % 2 ? { id: 11, name: "Living Room", slug: "living-room" } : { id: 12, name: "Curtains", slug: "curtains" }],
      images: i % 10 === 0 ? [] : [{ src: `https://woo.example.com/wp-content/uploads/w${i}.jpg`, alt: "" }],
      attributes: [], tags: [{ name: "demo" }], weight: "", date_modified_gmt: "2026-01-01T00:00:00", variations: variable ? variations[id].map((v) => v.id) : []
    };
  });
  return { cats, products, variations };
}

export async function startMock(state: MockState, wooAuth = "Basic " + Buffer.from("ck_test:cs_test").toString("base64")) {
  const server = http.createServer((req, res) => {
    state.hits++;
    const url = new URL(req.url ?? "/", "http://x");
    const send = (code: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    if (state.mode === "down") return send(503, { error: "unavailable" });
    const page = Number(url.searchParams.get("page") ?? 1);

    // Shopify public feed
    if (url.pathname === "/products.json") {
      const size = Number(url.searchParams.get("limit") ?? 250);
      const list = state.mode === "empty" ? [] : state.shopify;
      return send(200, { products: list.slice((page - 1) * size, page * size) });
    }
    // Shopify admin API (cursor pagination through Link header)
    if (url.pathname.startsWith("/admin/api/")) {
      if (req.headers["x-shopify-access-token"] !== "shpat_test") return send(401, { errors: "Invalid API key" });
      const size = Number(url.searchParams.get("limit") ?? 250);
      const p = Number(url.searchParams.get("page_info") ?? 1);
      const list = state.mode === "empty" ? [] : state.shopify;
      const hasNext = p * size < list.length;
      const headers: Record<string, string> = {};
      if (hasNext) headers.link = `<http://${req.headers.host}${url.pathname}?limit=${size}&page_info=${p + 1}>; rel="next"`;
      return send(200, { products: list.slice((p - 1) * size, p * size) }, headers);
    }
    // WooCommerce
    if (url.pathname.startsWith("/wp-json/wc/v3/")) {
      if (req.headers.authorization !== wooAuth) return send(401, { code: "woocommerce_rest_cannot_view" });
      const per = Number(url.searchParams.get("per_page") ?? 10);
      const slice = <T,>(a: T[]) => ({ rows: a.slice((page - 1) * per, page * per), pages: Math.max(1, Math.ceil(a.length / per)) });
      const sub = url.pathname.replace("/wp-json/wc/v3/", "");
      if (sub === "products/categories") { const s = slice(state.wooCategories); return send(200, s.rows, { "x-wp-totalpages": String(s.pages) }); }
      if (sub === "products") { const s = slice(state.mode === "empty" ? [] : state.woo); return send(200, s.rows, { "x-wp-totalpages": String(s.pages) }); }
      const m = /^products\/(\d+)\/variations$/.exec(sub);
      if (m) { const s = slice(state.wooVariations[Number(m[1])] ?? []); return send(200, s.rows, { "x-wp-totalpages": String(s.pages) }); }
    }
    send(404, { error: "not found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}
