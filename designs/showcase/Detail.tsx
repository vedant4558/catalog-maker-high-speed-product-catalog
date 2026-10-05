import Link from "next/link";
import type { DetailProps } from "../types";
import { formatPrice, stockLabel } from "@/lib/format";
import { Gallery } from "@/components/shop/Gallery";
import { EnquiryToggle, WishlistButton } from "@/components/shop/Buttons";
import { WhatsAppButton } from "@/components/shop/WhatsAppButton";
import { Specs } from "@/components/shop/Specs";
import { SafeImage } from "@/components/shop/SafeImage";

/** Design 2 detail: split layout — vertical thumbnails beside a tall image, sticky info panel, related as an image-tile strip. */
export function ShowcaseDetail({ client, product: p, related }: DetailProps) {
  const images = p.images.length ? p.images : p.thumbnail ? [{ url: p.thumbnail, alt: p.name }] : [];
  return (
    <article>
      <p className="mb-4 text-xs uppercase tracking-widest text-stone-500"><Link href="/" className="hover:underline">Collection</Link>{p.category && <> — <Link href={`/?category=${p.category.slug}`} className="hover:underline">{p.category.name}</Link></>}</p>
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
        <Gallery images={images.map((i) => ({ url: i.url, alt: i.alt ?? p.name }))} name={p.name} thumbs="side" ratio="aspect-[4/5]" />
        <div className="md:sticky md:top-4 md:self-start">
          <h1 className="font-serif text-3xl leading-tight">{p.name}</h1>
          <p className="mt-3 text-xl">{formatPrice(p.price, p.currency)}{p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="ml-2 text-base text-stone-400 line-through">{formatPrice(p.compareAtPrice, p.currency)}</span>}</p>
          <p className={`mt-1 text-sm ${p.inStock ? "text-emerald-700" : "text-stone-500"}`}>● {stockLabel(p.stockStatus)}</p>
          {p.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-stone-700">{p.description}</p>}
          <Specs product={p} className="mt-5 text-sm" />
          <div className="mt-6 space-y-2">
            <WhatsAppButton number={client.whatsappNumber} items={[{ name: p.name, slug: p.slug }]} className="flex min-h-12 w-full items-center justify-center gap-2 bg-emerald-700 px-4 text-sm uppercase tracking-widest text-white hover:bg-emerald-800" />
            <div className="flex gap-2">
              <EnquiryToggle id={p.id} name={p.name} className="min-h-11 flex-1 border border-stone-800 px-3 text-xs uppercase tracking-wider aria-pressed:bg-stone-800 aria-pressed:text-white" />
              <WishlistButton id={p.id} name={p.name} label className="min-h-11 flex-1 border border-stone-300 px-3 text-xs uppercase tracking-wider aria-pressed:text-rose-700" />
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-12" aria-label="Related products"><h2 className="mb-3 border-b border-stone-300 pb-2 font-serif text-xl">Related pieces</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{related.slice(0, 8).map((r) => (
            <li key={r.id}><Link href={`/p/${r.slug}`} prefetch={false} className="group block"><div className="relative aspect-[4/5] overflow-hidden bg-stone-100"><SafeImage src={r.thumbnail} alt={r.name} sizes="(min-width:640px) 22vw, 46vw" className="object-cover transition group-hover:opacity-90" /></div><p className="mt-1 line-clamp-1 text-sm">{r.name}</p><p className="text-xs text-stone-500">{formatPrice(r.price, r.currency)}</p></Link></li>
          ))}</ul>
        </section>
      )}
    </article>
  );
}
