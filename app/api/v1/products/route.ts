import { z } from "zod";
import { getClient } from "@/lib/tenant";
import { handler, json, CACHE_LIST } from "@/lib/api";
import { listProducts } from "@/lib/catalog/queries";

const query = z.object({
  category: z.string().max(100).optional(), // category slug; includes its sub-categories
  q: z.string().trim().max(100).optional(),
  inStock: z.enum(["true", "false"]).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest"),
  cursor: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24)
});

// List, category filter, search and filters in one endpoint. Cursor pagination keeps deep pages as fast as page one.
export const GET = handler(async (req: Request) => {
  const p = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const client = await getClient();
  return json(await listProducts(client.id, { ...p, inStock: p.inStock === "true" }), CACHE_LIST);
});
