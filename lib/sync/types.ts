// Source-agnostic shapes. Adapters translate Shopify / WooCommerce into these;
// the sync engine only ever sees these. Adding a new source = one new adapter.

export type StockState = "IN_STOCK" | "OUT_OF_STOCK" | "ON_BACKORDER";

export interface NormalizedCategory {
  externalId: string;
  name: string;
  slug: string;
  parentExternalId?: string | null;
}

export interface NormalizedImage {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface NormalizedVariant {
  externalId: string;
  sku?: string | null;
  title: string;
  price?: number | null;
  stockStatus: StockState;
  options?: Record<string, string> | null;
}

export interface NormalizedProduct {
  externalId: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency?: string | null;
  stockStatus: StockState;
  stockQty?: number | null;
  sourceUrl?: string | null;
  /** First entry is the primary category. */
  categories: NormalizedCategory[];
  images: NormalizedImage[];
  variants: NormalizedVariant[];
  metadata?: Record<string, unknown> | null;
  sourceUpdatedAt?: string | null;
}

export interface FetchResult {
  products: NormalizedProduct[];
  /** Products the adapter could not normalise (bad price, no id...). Recorded, never imported. */
  skipped: { externalId?: string; message: string }[];
}

export interface SourceAdapter {
  readonly type: "SHOPIFY" | "WOOCOMMERCE";
  /** Fetches the COMPLETE catalog. Must throw on any incomplete/failed fetch (no partial results). */
  fetchAll(): Promise<FetchResult>;
}

export class SourceError extends Error {
  constructor(message: string, public status?: number, public retryable = false) {
    super(message);
    this.name = "SourceError";
  }
}
