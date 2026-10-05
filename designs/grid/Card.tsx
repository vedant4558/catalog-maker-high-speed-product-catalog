import Link from "next/link";
import type { ListItem } from "@/lib/dto";
import { formatPrice } from "@/lib/format";
import { SafeImage } from "@/components/shop/SafeImage";
import { EnquiryToggle, WishlistButton } from "@/components/shop/Buttons";

/** Design 1 card: square image, name, price; heart on the image; one-tap "Enquire". */
export function GridCard({ p, priority = false }: { p: ListItem; priority?: boolean }) {
  return (
    <li className="group relative flex flex-col">
      <Link href={`/p/${p.slug}`} className="block" prefetch={false}>
        <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
          <SafeImage src={p.thumbnail} alt={p.name} priority={priority} sizes="(min-width:1024px) 22vw, (min-width:640px) 30vw, 46vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
          {!p.inStock && <span className="absolute left-2 top-2 rounded-full bg-neutral-900/80 px-2 py-0.5 text-xs font-medium text-white">Out of stock</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{p.name}</h3>
        <p className="mt-0.5 text-sm">
          <span className="font-semibold">{formatPrice(p.price, p.currency)}</span>
          {p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="ml-1.5 text-xs text-neutral-400 line-through">{formatPrice(p.compareAtPrice, p.currency)}</span>}
        </p>
      </Link>
      <WishlistButton id={p.id} name={p.name} className="absolute right-2 top-2 h-10 w-10 rounded-full bg-white/90 text-rose-600 shadow" />
      <EnquiryToggle id={p.id} name={p.name} compact className="mt-2 min-h-10 rounded-lg border border-neutral-300 px-3 text-xs font-medium hover:bg-neutral-50 aria-pressed:border-green-600 aria-pressed:bg-green-50 aria-pressed:text-green-800" />
    </li>
  );
}
