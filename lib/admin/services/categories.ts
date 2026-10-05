import { db } from "../../db";
import { slugify } from "../../sync/text";
import { ValidationError } from "../results";
import type { CategoryInput } from "../validators";

export interface CategoryRow { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; isVisible: boolean; imageUrl: string | null; sourceType: string; productCount: number; depth: number }

/** Flat list ordered as a tree: each parent followed by its children; every row carries its product count. */
export async function listCategoryTree(clientId: string): Promise<CategoryRow[]> {
  const all = await db.category.findMany({ where: { clientId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  const byParent = new Map<string | null, typeof all>();
  for (const c of all) {
    // A category whose parent no longer exists is shown at top level instead of disappearing.
    const key = c.parentId && all.some((p) => p.id === c.parentId) ? c.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const out: CategoryRow[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const c of byParent.get(parent) ?? []) {
      if (seen.has(c.id)) continue; // cycle guard for corrupt data
      seen.add(c.id);
      out.push({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, sortOrder: c.sortOrder, isVisible: c.isVisible, imageUrl: c.imageUrl, sourceType: c.sourceType, productCount: c._count.products, depth });
      walk(c.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

/** All ids below `id` (children, grandchildren...). */
async function descendants(clientId: string, id: string): Promise<Set<string>> {
  const all = await db.category.findMany({ where: { clientId }, select: { id: true, parentId: true } });
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const c of all) if (c.parentId === cur && !out.has(c.id)) { out.add(c.id); stack.push(c.id); }
  }
  return out;
}

async function uniqueSlug(clientId: string, base: string, excludeId?: string) {
  const root = slugify(base);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    if (!(await db.category.findFirst({ where: { clientId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }))) return slug;
  }
  throw new ValidationError({ slug: "Could not generate a unique URL name" });
}

async function nextOrder(clientId: string, parentId: string | null) {
  const agg = await db.category.aggregate({ where: { clientId, parentId }, _max: { sortOrder: true } });
  return (agg._max.sortOrder ?? -1) + 1;
}

async function checkParent(clientId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new ValidationError({ parentId: "A category cannot be its own parent" });
  if (!(await db.category.findFirst({ where: { id: parentId, clientId }, select: { id: true } }))) throw new ValidationError({ parentId: "That parent category no longer exists" });
  if (selfId && (await descendants(clientId, selfId)).has(parentId)) throw new ValidationError({ parentId: "A category cannot be moved under its own subcategory" });
}

export async function createCategory(clientId: string, input: CategoryInput) {
  await checkParent(clientId, input.parentId);
  let slug = input.slug;
  if (slug) {
    if (await db.category.findFirst({ where: { clientId, slug }, select: { id: true } })) throw new ValidationError({ slug: "This URL name is already used by another category" });
  } else slug = await uniqueSlug(clientId, input.name);
  return db.category.create({ data: { clientId, name: input.name, slug, parentId: input.parentId, imageUrl: input.imageUrl, isVisible: input.isVisible, sortOrder: await nextOrder(clientId, input.parentId) }, select: { id: true } });
}

export async function updateCategory(clientId: string, id: string, input: CategoryInput) {
  const ex = await db.category.findFirst({ where: { id, clientId } });
  if (!ex) throw new ValidationError({}, "That category no longer exists.");
  await checkParent(clientId, input.parentId, id);
  let slug = ex.slug;
  if (input.slug && input.slug !== ex.slug) {
    if (await db.category.findFirst({ where: { clientId, slug: input.slug, id: { not: id } }, select: { id: true } })) throw new ValidationError({ slug: "This URL name is already used by another category" });
    slug = input.slug;
  }
  const parentChanged = (ex.parentId ?? null) !== (input.parentId ?? null);
  await db.category.update({
    where: { id },
    data: { name: input.name, slug, parentId: input.parentId, imageUrl: input.imageUrl, isVisible: input.isVisible, ...(parentChanged ? { sortOrder: await nextOrder(clientId, input.parentId) } : {}) }
  });
}

export async function setCategoryVisibility(clientId: string, id: string, isVisible: boolean) {
  const r = await db.category.updateMany({ where: { id, clientId }, data: { isVisible } });
  if (r.count === 0) throw new ValidationError({}, "That category no longer exists.");
}

/** Moves a category one step up/down among its siblings. Sibling order is re-numbered 0..n-1 first so ties can't break it. */
export async function moveCategory(clientId: string, id: string, dir: "up" | "down") {
  const me = await db.category.findFirst({ where: { id, clientId }, select: { parentId: true } });
  if (!me) throw new ValidationError({}, "That category no longer exists.");
  const sibs = await db.category.findMany({ where: { clientId, parentId: me.parentId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
  const i = sibs.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= sibs.length) return; // already first/last
  const order = sibs.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  await db.$transaction(order.map((cid, idx) => db.category.update({ where: { id: cid }, data: { sortOrder: idx } })));
}

/**
 * Safe delete. Nothing is ever left dangling:
 *  - products in the category move to `moveTo` (or become uncategorised),
 *  - subcategories move to `moveTo` (or are promoted to the deleted category's parent),
 * and `moveTo` can't be the category itself or one of its descendants.
 */
export async function deleteCategory(clientId: string, id: string, moveTo: string | null) {
  const ex = await db.category.findFirst({ where: { id, clientId }, select: { id: true, parentId: true } });
  if (!ex) throw new ValidationError({}, "That category no longer exists.");
  if (moveTo) {
    if (moveTo === id || (await descendants(clientId, id)).has(moveTo)) throw new ValidationError({ moveTo: "Choose a category outside the one being deleted" });
    if (!(await db.category.findFirst({ where: { id: moveTo, clientId }, select: { id: true } }))) throw new ValidationError({ moveTo: "That category no longer exists" });
  }
  const [products, children] = await db.$transaction([
    db.product.updateMany({ where: { categoryId: id, clientId }, data: { categoryId: moveTo } }),
    db.category.updateMany({ where: { parentId: id, clientId }, data: { parentId: moveTo ?? ex.parentId } }),
    db.category.delete({ where: { id } })
  ]);
  return { productsMoved: products.count, subcategoriesMoved: children.count };
}
