import { getClient } from "@/lib/tenant";
import { ApiError, handler, json, CACHE_DETAIL } from "@/lib/api";
import { getRelated } from "@/lib/catalog/queries";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const items = await getRelated((await getClient()).id, slug);
  if (!items) throw new ApiError(404, "not_found", "Product not found.");
  return json({ items }, CACHE_DETAIL);
});
