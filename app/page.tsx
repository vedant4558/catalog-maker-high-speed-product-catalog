import { cachedProducts } from "@/lib/catalog/cached";
import { getDesign } from "@/designs/registry";
import { loadShop, parseHome } from "@/lib/shop";
import { NotConfigured } from "@/components/shop/States";

export const revalidate = 60;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const shop = await loadShop();
  if (!shop) return <NotConfigured />;
  const { client, categories } = shop;
  const h = parseHome(await searchParams);
  const active = h.category ? categories.find((c) => c.slug === h.category) ?? null : null;
  const design = getDesign(client.activeDesign);
  // An unknown/hidden category shows the empty state (not an error); products still appear in "All" and search.
  const data = h.category && !active ? { items: [], nextCursor: null } : await cachedProducts(client.id, h.query);
  return (
    <design.Shell client={client} categories={categories} activeCategory={active?.slug} q={h.q} keep={h.keep}>
      {/* key = the full query: a new sort/filter/category re-mounts the list, so the sort dropdown, the stock checkbox and the
          "load more" state always match the products shown (no products from the previous listing are kept). */}
      <design.Home key={h.qs} client={client} categories={categories} activeCategory={active} q={h.q} sort={h.sort} inStock={h.inStock} items={data.items} nextCursor={data.nextCursor} qs={h.qs} keep={h.keep} />
    </design.Shell>
  );
}
