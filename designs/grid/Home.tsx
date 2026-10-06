import Link from "next/link";
import type { HomeProps } from "../types";
import { GridCard } from "./Card";
import { MoreProducts } from "@/components/shop/MoreProducts";
import { catHref, navFor } from "@/lib/shop";

export function GridHome({ categories, activeCategory, q, sort, inStock, items, nextCursor, qs, keep }: HomeProps) {
  const { subs, top } = navFor(categories, activeCategory);
  const sub = (on: boolean) => `shrink-0 rounded-md px-3 py-1.5 text-sm ${on ? "bg-neutral-200 font-semibold" : "text-neutral-600 hover:bg-neutral-100"}`;
  return (
    <>
      {subs.length > 0 && top && (
        <nav aria-label="Subcategories" className="mb-3"><ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          <li><Link href={catHref(top.slug, keep)} className={sub(activeCategory?.id === top.id)}>All {top.name}</Link></li>
          {subs.map((s) => <li key={s.id}><Link href={catHref(s.slug, keep)} className={sub(activeCategory?.id === s.id)}>{s.name}</Link></li>)}
        </ul></nav>
      )}
      <form action="/" method="get" className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {activeCategory && <input type="hidden" name="category" value={activeCategory.slug} />}
        {q && <input type="hidden" name="q" value={q} />}
        <h1 className="mr-auto text-lg font-semibold">{q ? `Results for “${q}”` : activeCategory ? activeCategory.name : "All products"}</h1>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="inStock" value="1" defaultChecked={inStock} className="h-4 w-4" /> In stock</label>
        <select name="sort" defaultValue={sort} aria-label="Sort" className="rounded-lg border border-neutral-300 bg-white px-2 py-2">
          <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name A–Z</option>
        </select>
        <button className="rounded-lg border border-neutral-300 px-3 py-2 font-medium hover:bg-neutral-50">Apply</button>
      </form>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-14 text-center" role="status">
          <p className="font-medium">{q ? `No products match “${q}”.` : activeCategory ? "No products in this category yet." : "No products to show yet."}</p>
          <p className="mt-1 text-sm text-neutral-500">{q || inStock ? "Try a different search or clear the filters." : "Please check back soon."}</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Browse all products</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => <GridCard key={p.id} p={p} priority={i < 4} />)}
          <MoreProducts design="grid" qs={qs} initialCursor={nextCursor} />
        </ul>
      )}
    </>
  );
}
