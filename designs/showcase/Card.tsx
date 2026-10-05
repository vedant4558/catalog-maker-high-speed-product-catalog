import Link from "next/link";
import type { ListItem } from "@/lib/dto";
import { formatPrice } from "@/lib/format";
import { SafeImage } from "@/components/shop/SafeImage";
import { EnquiryToggle, WishlistButton } from "@/components/shop/Buttons";

/** Design 2 card: a wide horizontal row (image left, text right) — a different layout, not a restyled grid. */
export function ShowcaseCard({ p }: { p: ListItem }) {
  return (
    <li className="flex gap-4 border-b border-stone-200 py-4 sm:gap-6">
      <Link href={`/p/${p.slug}`} prefetch={false} className="relative block h-32 w-28 shrink-0 overflow-hidden bg-stone-100 sm:h-44 sm:w-36">
        <SafeImage src={p.thumbnail} alt={p.name} sizes="(min-width:640px) 144px, 112px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        {p.category && <p className="text-[11px] uppercase tracking-widest text-stone-500">{p.category.name}</p>}
        <Link href={`/p/${p.slug}`} prefetch={false} className="mt-1 font-serif text-lg leading-snug hover:underline sm:text-xl"><h3 className="line-clamp-2">{p.name}</h3></Link>
        <p className="mt-1 text-base">
          {formatPrice(p.price, p.currency)}
          {p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="ml-2 text-sm text-stone-400 line-through">{formatPrice(p.compareAtPrice, p.currency)}</span>}
        </p>
        <p className={`mt-1 text-xs ${p.inStock ? "text-emerald-700" : "text-stone-500"}`}>{p.inStock ? "Available" : "Currently unavailable"}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <EnquiryToggle id={p.id} name={p.name} className="min-h-10 border border-stone-800 px-3 text-xs uppercase tracking-wider hover:bg-stone-800 hover:text-white aria-pressed:bg-stone-800 aria-pressed:text-white" />
          <WishlistButton id={p.id} name={p.name} label className="min-h-10 border border-stone-300 px-3 text-xs uppercase tracking-wider text-stone-700 aria-pressed:text-rose-700" />
        </div>
      </div>
    </li>
  );
}
