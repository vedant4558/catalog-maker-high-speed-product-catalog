import { z } from "zod";
import { getClient } from "@/lib/tenant";
import { handler, json } from "@/lib/api";
import { getByIds } from "@/lib/catalog/queries";

const query = z.object({ ids: z.string().min(1).max(2000) });

// Powers the wishlist and the multi-product enquiry: the browser keeps only ids, this resolves them to cards in
// one request (in the requested order) and reports ids that no longer exist in `missing`.
export const GET = handler(async (req: Request) => {
  const { ids } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await getByIds((await getClient()).id, ids.split(",")), "private, max-age=30");
});
