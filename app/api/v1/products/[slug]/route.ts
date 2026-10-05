import { getClient } from "@/lib/tenant";
import { ApiError, handler, json, CACHE_DETAIL } from "@/lib/api";
import { getProduct } from "@/lib/catalog/queries";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const product = await getProduct((await getClient()).id, slug);
  if (!product) throw new ApiError(404, "not_found", "Product not found.");
  return json({ product }, CACHE_DETAIL);
});
