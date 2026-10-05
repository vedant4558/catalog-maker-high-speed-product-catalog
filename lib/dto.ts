import type { Prisma } from "@prisma/client";

// Minimal list payload: only what a product card needs. No description, no image joins.
export const listSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  stockStatus: true,
  thumbnailUrl: true,
  category: { select: { slug: true, name: true } }
} satisfies Prisma.ProductSelect;

export const detailSelect = {
  ...listSelect,
  sku: true,
  description: true,
  sourceUrl: true,
  stockQty: true,
  metadata: true,
  updatedAt: true,
  images: { orderBy: { position: "asc" }, select: { url: true, alt: true, width: true, height: true } },
  variants: { orderBy: { position: "asc" }, select: { id: true, sku: true, title: true, price: true, stockStatus: true, options: true } }
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>;
type DetailRow = Prisma.ProductGetPayload<{ select: typeof detailSelect }>;

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

export function toListItem(p: ListRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: num(p.price)!,
    compareAtPrice: num(p.compareAtPrice),
    currency: p.currency,
    inStock: p.stockStatus !== "OUT_OF_STOCK",
    stockStatus: p.stockStatus,
    thumbnail: p.thumbnailUrl, // may be null: designs must render a placeholder
    category: p.category
  };
}

export function toDetail(p: DetailRow) {
  return {
    ...toListItem(p),
    sku: p.sku,
    description: p.description,
    sourceUrl: p.sourceUrl,
    stockQty: p.stockQty,
    metadata: p.metadata,
    updatedAt: p.updatedAt.toISOString(),
    images: p.images,
    variants: p.variants.map((v) => ({ ...v, price: num(v.price), inStock: v.stockStatus !== "OUT_OF_STOCK" }))
  };
}

export type ListItem = ReturnType<typeof toListItem>;
export type ProductDetail = ReturnType<typeof toDetail>;
