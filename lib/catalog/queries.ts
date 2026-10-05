// The ONE place that reads the catalog for customers. Used by the public API routes (/api/v1/*) AND by the
// server-rendered pages, so every design and the API always agree. Framework-free: testable without Next.
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { detailSelect, listSelect, toDetail, toListItem } from "../dto";

export interface PublicClient { id: string; slug: string; name: string; domain: string | null; whatsappNumber: string | null; activeDesign: string; currency: string }
const clientSelect = { id: true, slug: true, name: true, domain: true, whatsappNumber: true, activeDesign: true, currency: true } as const;

/** Custom domain first (multi-client / CNAME), else DEFAULT_CLIENT_SLUG (single-client mode). */
export async function resolveClient(host: string | null | undefined): Promise<PublicClient | null> {
  const h = host?.split(":")[0]?.toLowerCase();
  const byDomain = h ? await db.client.findUnique({ where: { domain: h }, select: clientSelect }) : null;
  return byDomain ?? (await db.client.findUnique({ where: { slug: process.env.DEFAULT_CLIENT_SLUG ?? "demo" }, select: clientSelect }));
}

export interface CategoryNode { id: string; slug: string; name: string; imageUrl: string | null; parentId: string | null; productCount: number; totalCount: number; depth: number }

/**
 * Visible categories in tree order (each parent followed by its children, both by admin-defined order).
 * A category is hidden if it OR any ancestor is hidden. productCount = own active products,
 * totalCount = own + subcategories.
 */
export async function getCategories(clientId: string): Promise<CategoryNode[]> {
  const [all, counts] = await Promise.all([
    db.category.findMany({ where: { clientId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true, imageUrl: true, parentId: true, isVisible: true } }),
    db.product.groupBy({ by: ["categoryId"], where: { clientId, isActive: true, categoryId: { not: null } }, _count: { _all: true } })
  ]);
  const own = new Map(counts.map((c) => [c.categoryId as string, c._count._all]));
  const byId = new Map(all.map((c) => [c.id, c]));
  const visible = (id: string, guard = 0): boolean => {
    const c = byId.get(id);
    if (!c || !c.isVisible || guard > 10) return false;
    return c.parentId ? visible(c.parentId, guard + 1) : true;
  };
  const vis = all.filter((c) => visible(c.id));
  const kids = new Map<string | null, typeof vis>();
  for (const c of vis) {
    const key = c.parentId && vis.some((p) => p.id === c.parentId) ? c.parentId : null;
    kids.set(key, [...(kids.get(key) ?? []), c]);
  }
  const out: CategoryNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of kids.get(parent) ?? []) {
      const start = out.length;
      out.push({ id: c.id, slug: c.slug, name: c.name, imageUrl: c.imageUrl, parentId: c.parentId, productCount: own.get(c.id) ?? 0, totalCount: 0, depth });
      walk(c.id, depth + 1);
      out[start].totalCount = out.slice(start).filter((x) => x.depth >= depth).reduce((n, x) => n + x.productCount, 0);
    }
  };
  walk(null, 0);
  return out;
}

export interface ProductQuery { category?: string; q?: string; inStock?: boolean; minPrice?: number; maxPrice?: number; sort?: "newest" | "price_asc" | "price_desc" | "name"; cursor?: string; limit?: number }

const ORDER: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "asc" }],
  name: [{ name: "asc" }, { id: "asc" }]
};

/** List / search / filter with cursor pagination. List rows never join images or variants. */
export async function listProducts(clientId: string, p: ProductQuery) {
  const limit = Math.min(Math.max(p.limit ?? 24, 1), 48);
  const where: Prisma.ProductWhereInput = { clientId, isActive: true };

  if (p.category) {
    const cats = await getCategories(clientId);
    const cat = cats.find((c) => c.slug === p.category);
    if (!cat) return { items: [], nextCursor: null as string | null }; // unknown / hidden category: empty, not an error
    where.categoryId = { in: [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)] };
  }
  const tokens = (p.q ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
  if (tokens.length) {
    where.AND = tokens.map((t) => ({ OR: [{ name: { contains: t, mode: "insensitive" as const } }, { sku: { contains: t, mode: "insensitive" as const } }, { description: { contains: t, mode: "insensitive" as const } }] }));
  }
  if (p.inStock) where.stockStatus = { not: "OUT_OF_STOCK" };
  if (p.minPrice != null || p.maxPrice != null) where.price = { gte: p.minPrice, lte: p.maxPrice };

  const rows = await db.product.findMany({
    where, orderBy: ORDER[p.sort ?? "newest"], take: limit + 1, ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}), select: listSelect
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page.map(toListItem), nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function getProduct(clientId: string, slug: string) {
  const p = await db.product.findFirst({ where: { clientId, slug, isActive: true }, select: detailSelect });
  return p ? toDetail(p) : null;
}

/** Same category first (in stock preferred), topped up with newest products. */
export async function getRelated(clientId: string, slug: string) {
  const base = await db.product.findFirst({ where: { clientId, slug, isActive: true }, select: { id: true, categoryId: true } });
  if (!base) return null;
  const LIMIT = 8;
  const same = base.categoryId
    ? await db.product.findMany({ where: { clientId, isActive: true, categoryId: base.categoryId, id: { not: base.id } }, orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }], take: LIMIT, select: listSelect })
    : [];
  let items = same;
  if (items.length < LIMIT) {
    const filler = await db.product.findMany({ where: { clientId, isActive: true, id: { notIn: [base.id, ...same.map((s) => s.id)] } }, orderBy: { createdAt: "desc" }, take: LIMIT - items.length, select: listSelect });
    items = [...items, ...filler];
  }
  return items.map(toListItem);
}

/** Resolves wishlist / enquiry ids to cards, in the requested order. Unknown / unavailable ids are reported in `missing`. */
export async function getByIds(clientId: string, ids: string[]) {
  const list = [...new Set(ids.map((s) => s.trim()).filter(Boolean))].slice(0, 100);
  const rows = await db.product.findMany({ where: { clientId, isActive: true, id: { in: list } }, select: listSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { items: list.flatMap((id) => (byId.has(id) ? [toListItem(byId.get(id)!)] : [])), missing: list.filter((id) => !byId.has(id)) };
}
