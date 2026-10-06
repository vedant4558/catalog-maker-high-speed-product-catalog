import Link from "next/link";
import type { HomeProps } from "../types";
import { ShowcaseCard } from "./Card";
import { MoreProducts } from "@/components/shop/MoreProducts";
import { catHref } from "@/lib/shop";

export function ShowcaseHome({ categories, activeCategory, q, sort, inStock, items, nextCursor, qs, keep }: HomeProps) {
  const children = activeCategory ? categories.filter((c) => c.parentId === activeCategory.id) : [];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-stone-300 pb-3">
        <div>
          <h1 className="font-serif text-2xl">{q ? `Results for “${q}”` : activeCategory ? activeCategory.name : "The collection"}</h1>
          <p className="text-xs uppercase tracking-widest text-stone-500">{items.length}{nextCursor ? "+" : ""} item{items.length === 1 && !nextCursor ? "" : "s"}</p>
        </div>
        <form action="/" method="get" className="flex items-center gap-3 text-xs uppercase tracking-wider">
          {activeCategory && <input type="hidden" name="category" value={activeCategory.slug} />}
          {q && <input type="hidden" name="q" value={q} />}
          <label className="flex items-center gap-1"><input type="checkbox" name="inStock" value="1" defaultChecked={inStock} /> Available</label>
          <select name="sort" defaultValue={sort} aria-label="Sort" className="border border-stone-300 bg-white px-2 py-2"><option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="name">A–Z</option></select>
          <button className="border border-stone-800 px-3 py-2">Apply</button>
        </form>
      </div>
      {children.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{children.map((c) => <li key={c.id}><Link href={catHref(c.slug, keep)} className="block border border-stone-300 bg-white p-3 text-sm hover:border-stone-800"><span className="font-serif text-base">{c.name}</span><span className="block text-xs text-stone-500">{c.totalCount} items</span></Link></li>)}</ul>
      )}
      {items.length === 0 ? (
        <div className="border border-dashed border-stone-300 bg-white px-4 py-14 text-center" role="status">
          <p className="font-serif text-lg">{q ? `Nothing found for “${q}”.` : activeCategory ? "This category is empty for now." : "The collection is empty for now."}</p>
          <Link href="/" className="mt-4 inline-block border border-stone-800 px-4 py-2 text-xs uppercase tracking-widest">View everything</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-1">
          {items.map((p) => <ShowcaseCard key={p.id} p={p} />)}
          <MoreProducts design="showcase" qs={qs} initialCursor={nextCursor} />
        </ul>
      )}
    </>
  );
}
