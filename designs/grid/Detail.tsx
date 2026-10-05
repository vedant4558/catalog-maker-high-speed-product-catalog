import Link from "next/link";
import type { DetailProps } from "../types";
import { GridCard } from "./Card";
import { formatPrice, stockLabel } from "@/lib/format";
import { Gallery } from "@/components/shop/Gallery";
import { EnquiryToggle, WishlistButton } from "@/components/shop/Buttons";
import { WhatsAppButton } from "@/components/shop/WhatsAppButton";
import { Specs } from "@/components/shop/Specs";

export function GridDetail({ client, product: p, related }: DetailProps) {
  const images = p.images.length ? p.images : p.thumbnail ? [{ url: p.thumbnail, alt: p.name }] : [];
  return (
    <article>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-neutral-500"><Link href="/" className="hover:underline">All</Link>{p.category && <> / <Link href={`/?category=${p.category.slug}`} className="hover:underline">{p.category.name}</Link></>}</nav>
      <div className="grid gap-6 md:grid-cols-2">
        <Gallery images={images.map((i) => ({ url: i.url, alt: i.alt ?? p.name }))} name={p.name} thumbs="below" />
        <div>
          <h1 className="text-2xl font-bold leading-tight">{p.name}</h1>
          <p className="mt-2 text-2xl">
            <span className="font-semibold">{formatPrice(p.price, p.currency)}</span>
            {p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="ml-2 text-base text-neutral-400 line-through">{formatPrice(p.compareAtPrice, p.currency)}</span>}
          </p>
          <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm ${p.inStock ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-700"}`}>{stockLabel(p.stockStatus)}</p>
          <Specs product={p} className="mt-4 text-sm" />
          <div className="mt-5 flex flex-col gap-2">
            <WhatsAppButton number={client.whatsappNumber} items={[{ name: p.name, slug: p.slug }]} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 font-semibold text-white hover:bg-green-700" />
            <div className="grid grid-cols-2 gap-2">
              <WishlistButton id={p.id} name={p.name} label className="min-h-11 rounded-xl border border-neutral-300 text-sm font-medium text-rose-600" />
              <EnquiryToggle id={p.id} name={p.name} className="min-h-11 rounded-xl border border-neutral-300 text-sm font-medium aria-pressed:bg-green-50" />
            </div>
          </div>
          {p.description && <section className="mt-6"><h2 className="font-semibold">Description</h2><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-700">{p.description}</p></section>}
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-10" aria-label="Related products"><h2 className="mb-3 text-lg font-semibold">You may also like</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{related.slice(0, 8).map((r) => <GridCard key={r.id} p={r} />)}</ul>
        </section>
      )}
    </article>
  );
}
