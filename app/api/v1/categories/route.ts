import { getClient } from "@/lib/tenant";
import { handler, json, CACHE_LIST } from "@/lib/api";
import { getCategories } from "@/lib/catalog/queries";

// Visible categories only (a hidden parent hides its subcategories), tree-ordered by the admin-defined order.
export const GET = handler(async () => {
  const client = await getClient();
  const categories = (await getCategories(client.id)).map(({ totalCount, ...c }) => ({ ...c, totalCount }));
  return json({ categories }, CACHE_LIST);
});
