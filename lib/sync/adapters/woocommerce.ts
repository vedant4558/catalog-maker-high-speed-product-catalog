import { getJson } from "../http";
import { cleanUrl, htmlToText, parsePrice, slugify } from "../text";
import { SourceError, type FetchResult, type NormalizedCategory, type NormalizedProduct, type NormalizedVariant, type SourceAdapter, type StockState } from "../types";

export interface WooCredentials {
  /** Site root, e.g. https://shop.example.com */
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

interface WooCategory { id: number; name: string; slug: string; parent: number }
interface WooProduct {
  id: number;
  name: string;
  slug?: string;
  permalink?: string;
  type?: string; // simple | variable | grouped | external
  status?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  on_sale?: boolean;
  description?: string;
  short_description?: string;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  manage_stock?: boolean;
  stock_quantity?: number | null;
  categories?: { id: number; name: string; slug: string }[];
  images?: { src: string; alt?: string; name?: string }[];
  attributes?: { name: string; options: string[]; variation?: boolean }[];
  tags?: { name: string }[];
  weight?: string;
  date_modified_gmt?: string;
  variations?: number[];
}
interface WooVariation {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  attributes?: { name: string; option: string }[];
}

const PER_PAGE = 100;
const MAX_PAGES = 200;
const mapStock = (s?: string): StockState => (s === "outofstock" ? "OUT_OF_STOCK" : s === "onbackorder" ? "ON_BACKORDER" : "IN_STOCK");

export function normalizeWooProduct(p: WooProduct, cats: Map<number, WooCategory>, variations: WooVariation[]): NormalizedProduct | { error: string } {
  if (p.id == null || !p.name) return { error: "Missing product id or name." };
  const regular = parsePrice(p.regular_price);
  const current = parsePrice(p.price) ?? regular;
  if (current == null) return { error: "No valid price." };
  const onSale = !!p.on_sale && regular != null && regular > current;

  const categories: NormalizedCategory[] = (p.categories ?? []).map((c) => {
    const full = cats.get(c.id);
    return { externalId: String(c.id), name: c.name, slug: c.slug || slugify(c.name), parentExternalId: full && full.parent ? String(full.parent) : null };
  });
  // Include ancestors so the whole tree exists even when a product is only in a leaf category.
  const seen = new Set(categories.map((c) => c.externalId));
  for (const c of [...categories]) {
    let parentId = c.parentExternalId ? Number(c.parentExternalId) : 0;
    for (let guard = 0; parentId && guard < 10; guard++) {
      const parent = cats.get(parentId);
      if (!parent || seen.has(String(parent.id))) break;
      seen.add(String(parent.id));
      categories.push({ externalId: String(parent.id), name: parent.name, slug: parent.slug, parentExternalId: parent.parent ? String(parent.parent) : null });
      parentId = parent.parent;
    }
  }

  const variants: NormalizedVariant[] = variations.map((v) => ({
    externalId: String(v.id),
    sku: v.sku || null,
    title: (v.attributes ?? []).map((a) => a.option).join(" / ") || `Variant ${v.id}`,
    price: parsePrice(v.price) ?? parsePrice(v.regular_price),
    stockStatus: mapStock(v.stock_status),
    options: Object.fromEntries((v.attributes ?? []).map((a) => [a.name, a.option]))
  }));

  // A variable product is purchasable if any variation is.
  const stockStatus: StockState = variants.length
    ? variants.some((v) => v.stockStatus === "IN_STOCK") ? "IN_STOCK" : variants.some((v) => v.stockStatus === "ON_BACKORDER") ? "ON_BACKORDER" : "OUT_OF_STOCK"
    : mapStock(p.stock_status);

  return {
    externalId: String(p.id),
    sku: p.sku || null,
    name: htmlToText(p.name) ?? p.name,
    description: htmlToText(p.description) ?? htmlToText(p.short_description),
    price: current,
    compareAtPrice: onSale ? regular : null,
    stockStatus,
    stockQty: p.manage_stock && typeof p.stock_quantity === "number" ? p.stock_quantity : null,
    sourceUrl: cleanUrl(p.permalink),
    categories,
    images: (p.images ?? []).flatMap((i) => {
      const url = cleanUrl(i.src);
      return url ? [{ url, alt: i.alt || i.name || null }] : [];
    }),
    variants,
    metadata: { source: "woocommerce", type: p.type ?? null, tags: (p.tags ?? []).map((t) => t.name), weight: p.weight || null, attributes: (p.attributes ?? []).map((a) => ({ name: a.name, options: a.options })) },
    sourceUpdatedAt: p.date_modified_gmt ? `${p.date_modified_gmt}Z` : null
  };
}

export class WooCommerceAdapter implements SourceAdapter {
  readonly type = "WOOCOMMERCE" as const;
  private base: string;
  private headers: Record<string, string>;

  constructor(c: WooCredentials) {
    if (!c.siteUrl || !c.consumerKey || !c.consumerSecret) throw new SourceError("WooCommerce source needs siteUrl, consumerKey and consumerSecret.");
    this.base = c.siteUrl.replace(/\/$/, "");
    this.headers = { Authorization: `Basic ${Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64")}` };
  }

  private async paged<T>(path: string, extra = ""): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, headers } = await getJson<T[]>(`${this.base}/wp-json/wc/v3/${path}?per_page=${PER_PAGE}&page=${page}${extra}`, { headers: this.headers });
      if (!Array.isArray(data)) throw new SourceError("Unexpected WooCommerce response shape.");
      out.push(...data);
      const total = Number(headers.get("x-wp-totalpages") ?? (data.length === PER_PAGE ? page + 1 : page));
      if (page >= total) return out;
    }
    throw new SourceError("WooCommerce catalog exceeded the page limit; refusing partial import.");
  }

  async fetchAll(): Promise<FetchResult> {
    const [cats, raw] = await Promise.all([this.paged<WooCategory>("products/categories"), this.paged<WooProduct>("products", "&status=publish")]);
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const result: FetchResult = { products: [], skipped: [] };

    for (const p of raw) {
      if (p.status && p.status !== "publish") continue;
      // Variations need one extra call per variable product. A failure here fails the whole fetch
      // (never import a variable product without its variants).
      const variations = p.type === "variable" && (p.variations?.length ?? 0) > 0 ? await this.paged<WooVariation>(`products/${p.id}/variations`) : [];
      const n = normalizeWooProduct(p, catMap, variations);
      if ("error" in n) result.skipped.push({ externalId: p.id != null ? String(p.id) : undefined, message: n.error });
      else result.products.push(n);
    }
    return result;
  }
}
