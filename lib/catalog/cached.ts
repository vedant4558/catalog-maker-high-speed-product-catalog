// Server-component data access: the same queries, wrapped in Next's data cache (shared across requests/users).
// Admin edits, settings changes and syncs call invalidateCatalog(), so changes appear immediately; the 60 s
// revalidate is only a safety net. Customers therefore hit PostgreSQL rarely and NEVER the Shopify/Woo APIs.
import { unstable_cache } from "next/cache";
import { CATALOG_TAG } from "../cache";
import * as q from "./queries";

const opts = { revalidate: 60, tags: [CATALOG_TAG] };

export const cachedClient = unstable_cache(async (host: string) => q.resolveClient(host), ["catalog:client"], opts);
export const cachedCategories = unstable_cache(async (clientId: string) => q.getCategories(clientId), ["catalog:categories"], opts);
export const cachedProducts = unstable_cache(async (clientId: string, query: q.ProductQuery) => q.listProducts(clientId, query), ["catalog:products"], opts);
export const cachedProduct = unstable_cache(async (clientId: string, slug: string) => q.getProduct(clientId, slug), ["catalog:product"], opts);
export const cachedRelated = unstable_cache(async (clientId: string, slug: string) => q.getRelated(clientId, slug), ["catalog:related"], opts);
