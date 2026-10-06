import Link from "next/link";
import type { ShellProps } from "../types";
import { catHref } from "@/lib/shop";
import { WishlistCount } from "@/components/shop/Buttons";
import { EnquiryBar } from "@/components/shop/Lists";
import type { CategoryNode } from "@/lib/catalog/queries";

function Tree({ nodes, parent, active, keep }: { nodes: CategoryNode[]; parent: string | null; active?: string; keep?: Record<string, string> }) {
  const kids = nodes.filter((n) => n.parentId === parent);
  if (!kids.length) return null;
  return (
    <ul className={parent ? "ml-3 mt-1 space-y-1 border-l border-stone-200 pl-3" : "space-y-2"}>
      {kids.map((c) => (
        <li key={c.id}>
          <Link href={catHref(c.slug, keep)} className={`flex justify-between gap-2 py-1 text-sm ${active === c.slug ? "font-semibold underline underline-offset-4" : "text-stone-600 hover:text-stone-900"}`}>
            <span>{c.name}</span><span className="text-xs text-stone-400">{c.totalCount}</span>
          </Link>
          <Tree nodes={nodes} parent={c.id} active={active} keep={keep} />
        </li>
      ))}
    </ul>
  );
}

/** Design 2 shell: centred editorial masthead + a persistent category TREE (sidebar on desktop, collapsible on mobile). */
export function ShowcaseShell({ client, categories, activeCategory, q, keep, children }: ShellProps) {
  return (
    <div data-design="showcase" className="min-h-screen bg-stone-50 pb-24 font-sans text-stone-900">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs uppercase tracking-widest text-stone-500">
          <span>Catalogue</span>
          <Link href="/wishlist" className="flex items-center gap-1 hover:text-stone-900">Wishlist <WishlistCount className="rounded-full bg-stone-900 px-1.5 text-[10px] text-white" /></Link>
        </div>
        <div className="px-4 pb-5 pt-2 text-center">
          <Link href="/" className="font-serif text-3xl tracking-wide sm:text-4xl">{client.name}</Link>
          <form key={`${activeCategory}|${q}`} action="/" method="get" role="search" className="mx-auto mt-4 flex max-w-lg border-b border-stone-800">
            {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
            <input name="q" defaultValue={q} type="search" placeholder="Search the collection" aria-label="Search the collection" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none" />
            <button className="px-3 text-xs uppercase tracking-widest">Search</button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[14rem_1fr]">
        <aside aria-label="Categories">
          <details className="lg:hidden rounded border border-stone-300 bg-white p-3"><summary className="cursor-pointer text-sm font-medium uppercase tracking-widest">Browse categories</summary>
            <div className="mt-3"><Link href={catHref(undefined, keep)} className="text-sm text-stone-600">All products</Link><div className="mt-2"><Tree nodes={categories} parent={null} active={activeCategory} keep={keep} /></div></div>
          </details>
          <nav className="sticky top-4 hidden lg:block"><h2 className="mb-3 text-xs uppercase tracking-widest text-stone-500">Categories</h2>
            <Link href={catHref(undefined, keep)} className={`mb-2 block text-sm ${!activeCategory ? "font-semibold underline underline-offset-4" : "text-stone-600"}`}>All products</Link>
            <Tree nodes={categories} parent={null} active={activeCategory} keep={keep} />
          </nav>
        </aside>
        <main>{children}</main>
      </div>
      <EnquiryBar number={client.whatsappNumber} accent="bg-emerald-700 hover:bg-emerald-800" />
    </div>
  );
}
