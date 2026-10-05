import { getJson } from "../http";
import { cleanUrl, htmlToText, parsePrice, slugify } from "../text";
import { SourceError, type FetchResult, type NormalizedProduct, type NormalizedVariant, type SourceAdapter, type StockState } from "../types";

export interface ShopifyCredentials {
  /** e.g. my-store.myshopify.com */
  shopDomain: string;
  /** Admin API access token (custom app, scope read_products). Optional: without it the public /products.json feed is used. */
  accessToken?: string;
  /** Customer-facing domain for product URLs (defaults to shopDomain). */
  storefrontDomain?: string;
  apiVersion?: string;
  /** Page size (max 250). Lowered only in tests. */
  pageSize?: number;
}

interface ShopifyVariant {
  id: number;
  title: string;
  sku?: string | null;
  price?: string;
  compare_at_price?: string | null;
  inventory_quantity?: number | null;
  inventory_management?: string | null;
  inventory_policy?: string | null;
  available?: boolean; // public feed only
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  status?: string; // admin API: active | draft | archived
  tags?: string | string[];
  updated_at?: string;
  variants?: ShopifyVariant[];
  options?: { name: string; position: number }[];
  images?: { src: string; alt?: string | null; width?: number; height?: number }[];
}

const PAGE = 250;
// Accepts "shop.myshopify.com" or a full "https://..." (http allowed for local test servers).
const origin = (d: string) => (/^https?:\/\//.test(d) ? d.replace(/\/$/, "") : `https://${d.replace(/\/$/, "")}`);
const MAX_PAGES = 200; // hard stop against runaway pagination

function variantStock(v: ShopifyVariant): StockState {
  if (typeof v.available === "boolean") return v.available ? "IN_STOCK" : "OUT_OF_STOCK"; // public feed
  if (!v.inventory_management) return "IN_STOCK"; // inventory not tracked
  if ((v.inventory_quantity ?? 0) > 0) return "IN_STOCK";
  return v.inventory_policy === "continue" ? "ON_BACKORDER" : "OUT_OF_STOCK";
}

export function normalizeShopifyProduct(p: ShopifyProduct, storefrontOrigin: string): NormalizedProduct | { error: string } {
  if (p.id == null || !p.title) return { error: "Missing product id or title." };
  const vs = p.variants ?? [];
  const prices = vs.map((v) => parsePrice(v.price)).filter((n): n is number => n != null);
  if (!prices.length) return { error: "No valid variant price." };
  const price = Math.min(...prices);
  const cheapest = vs.find((v) => parsePrice(v.price) === price);
  const compare = parsePrice(cheapest?.compare_at_price);

  const optionNames = (p.options ?? []).sort((a, b) => a.position - b.position).map((o) => o.name);
  const variants: NormalizedVariant[] =
    vs.length === 1 && vs[0].title === "Default Title"
      ? [] // single implicit variant: nothing to choose
      : vs.map((v) => {
          const vals = [v.option1, v.option2, v.option3];
          const options: Record<string, string> = {};
          optionNames.forEach((n, i) => {
            if (vals[i]) options[n] = vals[i] as string;
          });
          return { externalId: String(v.id), sku: v.sku || null, title: v.title, price: parsePrice(v.price), stockStatus: variantStock(v), options };
        });

  const states = vs.map(variantStock);
  const stockStatus: StockState = states.includes("IN_STOCK") ? "IN_STOCK" : states.includes("ON_BACKORDER") ? "ON_BACKORDER" : "OUT_OF_STOCK";
  const tracked = vs.some((v) => v.inventory_management);
  const stockQty = tracked ? vs.reduce((s, v) => s + Math.max(0, v.inventory_quantity ?? 0), 0) : null;

  const type = p.product_type?.trim();
  const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  return {
    externalId: String(p.id),
    sku: vs.find((v) => v.sku)?.sku ?? null,
    name: p.title.trim(),
    description: htmlToText(p.body_html),
    price,
    compareAtPrice: compare != null && compare > price ? compare : null,
    stockStatus,
    stockQty,
    sourceUrl: `${storefrontOrigin}/products/${p.handle}`,
    // Shopify "collections" need extra calls and are many-to-many; product_type is the stable single category.
    categories: type ? [{ externalId: `type:${slugify(type)}`, name: type, slug: slugify(type) }] : [],
    images: (p.images ?? []).flatMap((i) => {
      const url = cleanUrl(i.src);
      return url ? [{ url, alt: i.alt ?? null, width: i.width ?? null, height: i.height ?? null }] : [];
    }),
    variants,
    metadata: { source: "shopify", vendor: p.vendor || null, tags, handle: p.handle },
    sourceUpdatedAt: p.updated_at ?? null
  };
}

export class ShopifyAdapter implements SourceAdapter {
  readonly type = "SHOPIFY" as const;
  constructor(private c: ShopifyCredentials) {
    if (!c.shopDomain) throw new SourceError("Shopify source is missing shopDomain.");
  }

  async fetchAll(): Promise<FetchResult> {
    const shop = origin(this.c.shopDomain);
    const storefront = origin(this.c.storefrontDomain ?? this.c.shopDomain);
    const admin = !!this.c.accessToken;
    const version = this.c.apiVersion ?? "2024-10";
    const size = Math.min(this.c.pageSize ?? PAGE, PAGE);
    const headers: Record<string, string> = admin ? { "X-Shopify-Access-Token": this.c.accessToken as string } : {};

    const raw: ShopifyProduct[] = [];
    // Admin API: cursor pagination via Link header. Public feed: ?page=N.
    let url: string | null = admin
      ? `${shop}/admin/api/${version}/products.json?limit=${size}&status=active`
      : `${storefront}/products.json?limit=${size}&page=1`;
    for (let page = 1; url && page <= MAX_PAGES; page++) {
      const res: { data: { products?: ShopifyProduct[] }; headers: Headers } = await getJson<{ products?: ShopifyProduct[] }>(url, { headers });
      const { data, headers: h } = res;
      if (!data || !Array.isArray(data.products)) throw new SourceError("Unexpected Shopify response shape.");
      raw.push(...data.products);
      if (admin) {
        const m = /<([^>]+)>;\s*rel="next"/.exec(h.get("link") ?? "");
        url = m ? m[1] : null;
      } else {
        url = data.products.length === size ? `${storefront}/products.json?limit=${size}&page=${page + 1}` : null;
      }
      if (url && page === MAX_PAGES) throw new SourceError("Shopify catalog exceeded the page limit; refusing partial import.");
    }

    const result: FetchResult = { products: [], skipped: [] };
    for (const p of raw) {
      if (p.status && p.status !== "active") continue;
      const n = normalizeShopifyProduct(p, storefront);
      if ("error" in n) result.skipped.push({ externalId: p.id != null ? String(p.id) : undefined, message: n.error });
      else result.products.push(n);
    }
    return result;
  }
}
