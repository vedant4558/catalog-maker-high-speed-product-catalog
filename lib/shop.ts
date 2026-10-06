import { headers } from "next/headers";
import { cachedCategories, cachedClient } from "@/lib/catalog/cached";
import type { CategoryNode } from "@/lib/catalog/queries";
import type { ProductQuery } from "@/lib/catalog/queries";

/** Resolve the client (from the Host header) and its category tree through the tagged cache. null => not configured yet. */
export async function loadShop() {
  const host = (await headers()).get("host") ?? "";
  const client = await cachedClient(host);
  if (!client) return null;
  const categories = await cachedCategories(client.id);
  return { client, categories };
}

export const PAGE_SIZE = 24;
const SORTS = ["newest", "price_asc", "price_desc", "name"] as const;
type Sort = (typeof SORTS)[number];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseHome(sp: Record<string, string | string[] | undefined>) {
  const category = one(sp.category).slice(0, 120);
  const q = one(sp.q).trim().slice(0, 100);
  const s = one(sp.sort);
  const sort: Sort = (SORTS as readonly string[]).includes(s) ? (s as Sort) : "newest";
  const inStock = one(sp.inStock) === "1";
  const query: ProductQuery = { category: category || undefined, q: q || undefined, sort, inStock: inStock || undefined, limit: PAGE_SIZE };
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (sort !== "newest") params.set("sort", sort);
  if (inStock) params.set("inStock", "1");
  params.set("limit", String(PAGE_SIZE));
  // Sort + stock filter are carried along when the customer changes category or searches, so they are never lost.
  const keep: Record<string, string> = {};
  if (sort !== "newest") keep.sort = sort;
  if (inStock) keep.inStock = "1";
  return { category, q, sort, inStock, query, qs: params.toString(), keep };
}

/** Top-level categories + the subcategories of whichever branch is active (for chip rows / trees). */
export function navFor(categories: CategoryNode[], active: CategoryNode | null) {
  const roots = categories.filter((c) => c.parentId === null);
  const byId = new Map(categories.map((c) => [c.id, c]));
  let top: CategoryNode | null = active;
  while (top && top.parentId && byId.get(top.parentId)) top = byId.get(top.parentId)!;
  const subs = top ? categories.filter((c) => c.parentId === top!.id) : [];
  return { roots, top, subs };
}

export const catHref = (slug?: string, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams(extra);
  if (slug) p.set("category", slug);
  const s = p.toString();
  return s ? `/?${s}` : "/";
};
