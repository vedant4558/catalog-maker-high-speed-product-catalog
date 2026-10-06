import Link from "next/link";
import type { ShellProps } from "../types";
import { catHref, navFor } from "@/lib/shop";
import { WishlistCount } from "@/components/shop/Buttons";
import { EnquiryBar } from "@/components/shop/Lists";

/** Design 1 shell: sticky header (brand, search, wishlist) with a horizontally scrollable category chip row. */
export function GridShell({ client, categories, activeCategory, q, keep, children }: ShellProps) {
  const active = categories.find((c) => c.slug === activeCategory) ?? null;
  const { roots, top } = navFor(categories, active);
  const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:bg-neutral-50"}`;
  return (
    <div data-design="grid" className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="truncate text-lg font-bold tracking-tight">{client.name}</Link>
          <form key={`${activeCategory}|${q}`} action="/" method="get" role="search" className="ml-auto flex min-w-0 flex-1 sm:max-w-md">
            {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
            <input name="q" defaultValue={q} type="search" placeholder="Search products" aria-label="Search products" className="min-w-0 flex-1 rounded-l-lg border border-neutral-300 px-3 py-2 text-base" />
            <button className="rounded-r-lg bg-neutral-900 px-3 text-sm font-medium text-white" aria-label="Search">Go</button>
          </form>
          <Link href="/wishlist" aria-label="Wishlist" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
            <WishlistCount className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-xs font-semibold text-white" />
          </Link>
        </div>
        {roots.length > 0 && (
          <nav aria-label="Categories" className="mx-auto max-w-6xl">
            <ul className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
              <li><Link href={catHref(undefined, keep)} className={chip(!activeCategory)}>All</Link></li>
              {roots.map((c) => <li key={c.id}><Link href={catHref(c.slug, keep)} className={chip(top?.id === c.id)}>{c.name}</Link></li>)}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      <EnquiryBar number={client.whatsappNumber} />
    </div>
  );
}
