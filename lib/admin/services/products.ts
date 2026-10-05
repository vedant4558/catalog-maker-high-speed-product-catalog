import { Prisma } from "@prisma/client";
import { db } from "../../db";
import { slugify, stableStringify } from "../../sync/text";
import { ValidationError } from "../results";
import { parseOptions, type ProductInput } from "../validators";

/** Fields the sync engine will not overwrite once an admin has edited them (Product.manualOverrides). */
export const OVERRIDABLE = ["name", "sku", "description", "price", "compareAtPrice", "stockStatus", "stockQty", "category", "images", "variants", "metadata", "isActive"] as const;
export type OverridableField = (typeof OVERRIDABLE)[number];

async function assertCategory(clientId: string, categoryId: string | null) {
  if (!categoryId) return;
  const c = await db.category.findFirst({ where: { id: categoryId, clientId }, select: { id: true } });
  if (!c) throw new ValidationError({ categoryId: "That category no longer exists" });
}

async function uniqueSlug(clientId: string, base: string, excludeId?: string) {
  const root = slugify(base);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const hit = await db.product.findFirst({ where: { clientId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!hit) return slug;
  }
  throw new ValidationError({ slug: "Could not generate a unique URL name" });
}

const variantRows = (vs: ProductInput["variants"]) =>
  vs.map((v, position) => ({
    externalId: v.externalId, sku: v.sku, title: v.title, price: v.price, stockStatus: v.stockStatus, position,
    options: (() => { const o = parseOptions(v.options); return o ? (o as Prisma.InputJsonValue) : Prisma.JsonNull; })()
  }));
const imageRows = (is: ProductInput["images"], name: string) => is.map((i, position) => ({ url: i.url, alt: i.alt ?? name, position }));

export async function createProduct(clientId: string, client: { currency: string }, input: ProductInput) {
  await assertCategory(clientId, input.categoryId);
  let slug: string;
  if (input.slug) {
    const s = slugify(input.slug);
    if (await db.product.findFirst({ where: { clientId, slug: s }, select: { id: true } })) throw new ValidationError({ slug: "This URL name is already used by another product" });
    slug = s;
  } else slug = await uniqueSlug(clientId, input.name);

  const images = imageRows(input.images, input.name);
  const p = await db.product.create({
    data: {
      clientId, slug, name: input.name, sku: input.sku, description: input.description, price: input.price, compareAtPrice: input.compareAtPrice,
      currency: client.currency, stockStatus: input.stockStatus, stockQty: input.stockQty, sourceUrl: input.sourceUrl, categoryId: input.categoryId,
      isActive: input.isActive, thumbnailUrl: images[0]?.url ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      images: { create: images }, variants: { create: variantRows(input.variants) }
    },
    select: { id: true }
  });
  return p;
}

export async function getProductForEdit(clientId: string, id: string) {
  return db.product.findFirst({
    where: { id, clientId },
    include: {
      images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } },
      category: { select: { id: true, name: true } }, source: { select: { id: true, name: true, type: true } }
    }
  });
}

export async function updateProduct(clientId: string, id: string, input: ProductInput) {
  const ex = await db.product.findFirst({ where: { id, clientId }, include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } } } });
  if (!ex) throw new ValidationError({}, "That product no longer exists. Refresh the page.");
  await assertCategory(clientId, input.categoryId);

  let slug = ex.slug;
  if (input.slug && input.slug !== ex.slug) {
    const s = slugify(input.slug);
    if (await db.product.findFirst({ where: { clientId, slug: s, id: { not: id } }, select: { id: true } })) throw new ValidationError({ slug: "This URL name is already used by another product" });
    slug = s;
  }

  const images = imageRows(input.images, input.name);
  const variants = variantRows(input.variants);

  // For products that come from Shopify/WooCommerce, lock every field the admin actually changed so the next sync keeps it.
  const overrides = { ...((ex.manualOverrides ?? {}) as Record<string, boolean>) };
  for (const f of input.unlock) delete overrides[f]; // unlock first; a field changed in this same save is re-locked below
  if (ex.sourceId && input.lock) {
    const norm = (s: string | null | undefined) => (s ?? "").trim();
    const changed: Record<OverridableField, boolean> = {
      name: ex.name !== input.name,
      sku: norm(ex.sku) !== norm(input.sku),
      description: norm(ex.description) !== norm(input.description),
      price: Number(ex.price) !== input.price,
      compareAtPrice: Number(ex.compareAtPrice ?? 0) !== Number(input.compareAtPrice ?? 0),
      stockStatus: ex.stockStatus !== input.stockStatus,
      stockQty: (ex.stockQty ?? null) !== (input.stockQty ?? null),
      category: (ex.categoryId ?? null) !== (input.categoryId ?? null),
      images: stableStringify(ex.images.map((i) => [i.url, i.alt ?? ""])) !== stableStringify(images.map((i) => [i.url, i.alt ?? ""])),
      variants: stableStringify(ex.variants.map((v) => [v.title, v.sku ?? "", v.price == null ? null : Number(v.price), v.stockStatus, v.options ?? null])) !==
        stableStringify(variants.map((v) => [v.title, v.sku ?? "", v.price, v.stockStatus, v.options === Prisma.JsonNull ? null : v.options])),
      metadata: stableStringify(ex.metadata ?? null) !== stableStringify(input.metadata ?? null),
      isActive: ex.isActive !== input.isActive
    };
    for (const f of OVERRIDABLE) if (changed[f]) overrides[f] = true;
  }

  await db.$transaction([
    db.product.update({
      where: { id },
      data: {
        slug, name: input.name, sku: input.sku, description: input.description, price: input.price, compareAtPrice: input.compareAtPrice,
        stockStatus: input.stockStatus, stockQty: input.stockQty, categoryId: input.categoryId, isActive: input.isActive,
        // product URL is only editable for products that are not synchronised from a source
        ...(ex.sourceId ? {} : { sourceUrl: input.sourceUrl }),
        thumbnailUrl: images[0]?.url ?? null, // keeps the Part 1 list payload (which never joins images) correct
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        manualOverrides: ex.sourceId ? (Object.keys(overrides).length ? (overrides as Prisma.InputJsonValue) : Prisma.JsonNull) : undefined
      }
    }),
    db.productImage.deleteMany({ where: { productId: id } }),
    db.productImage.createMany({ data: images.map((i) => ({ ...i, productId: id })) }),
    db.variant.deleteMany({ where: { productId: id } }),
    db.variant.createMany({ data: variants.map((v) => ({ ...v, productId: id })) })
  ]);
  return { id, locked: Object.keys(overrides) };
}

export async function deleteProduct(clientId: string, id: string) {
  const r = await db.product.deleteMany({ where: { id, clientId } }); // images + variants cascade
  if (r.count === 0) throw new ValidationError({}, "That product no longer exists.");
}

export interface ProductListQuery { q?: string; categoryId?: string; stock?: string; status?: string; page?: number; pageSize?: number }

export async function listProducts(clientId: string, q: ProductListQuery) {
  const pageSize = Math.min(q.pageSize ?? 20, 50);
  const page = Math.max(1, q.page ?? 1);
  const where: Prisma.ProductWhereInput = { clientId };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { sku: { contains: q.q, mode: "insensitive" } }, { slug: { contains: q.q, mode: "insensitive" } }];
  if (q.categoryId === "none") where.categoryId = null;
  else if (q.categoryId) {
    const kids = await db.category.findMany({ where: { clientId, parentId: q.categoryId }, select: { id: true } });
    where.categoryId = { in: [q.categoryId, ...kids.map((k) => k.id)] };
  }
  if (q.stock === "IN_STOCK" || q.stock === "OUT_OF_STOCK" || q.stock === "ON_BACKORDER") where.stockStatus = q.stock;
  if (q.status === "active") where.isActive = true;
  if (q.status === "hidden") where.isActive = false;

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, name: true, sku: true, price: true, currency: true, stockStatus: true, isActive: true, thumbnailUrl: true, updatedAt: true, category: { select: { name: true } }, source: { select: { name: true, type: true } } }
    })
  ]);
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), rows };
}
