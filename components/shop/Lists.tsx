"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ListItem } from "@/lib/dto";
import { formatPrice } from "@/lib/format";
import { SafeImage } from "./SafeImage";
import { WhatsAppButton } from "./WhatsAppButton";
import { addIds, clearList, removeId, removeIds, toggleId, useList } from "./store";

const known = new Map<string, ListItem>(); // in-memory cache: re-opening the panel costs no request
const gone = new Set<string>();

/** Resolves stored ids to product cards with ONE by-ids request for the ids not seen yet. */
function useItems(ids: string[]) {
  const [, bump] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [tries, setTries] = useState(0);
  const unknown = ids.filter((id) => !known.has(id) && !gone.has(id));
  const key = unknown.join(",");
  useEffect(() => {
    if (!key) { setState("idle"); return; }
    let live = true;
    setState("loading");
    fetch(`/api/v1/products/by-ids?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((d: { items: ListItem[]; missing: string[] }) => {
        d.items.forEach((i) => known.set(i.id, i));
        d.missing.forEach((m) => gone.add(m));
        if (live) { setState("idle"); bump((n) => n + 1); }
      })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [key, tries]);
  return {
    items: ids.flatMap((id) => (known.has(id) ? [known.get(id) as ListItem] : [])),
    missing: ids.filter((id) => gone.has(id)),
    loading: state === "loading" && unknown.length > 0,
    error: state === "error",
    retry: () => setTries((t) => t + 1)
  };
}

/**
 * The wishlist-style panel used by both designs.
 *  mode="enquiry"  : the products selected for the WhatsApp enquiry (remove individually, send ONE message)
 *  mode="wishlist" : saved products; tick the ones to include in an enquiry
 */
export function ListPanel({ mode, number, accent = "bg-green-600 hover:bg-green-700", onClose }: { mode: "wishlist" | "enquiry"; number: string | null; accent?: string; onClose?: () => void }) {
  const ids = useList(mode);
  const selected = useList("enquiry");
  const { items, missing, loading, error, retry } = useItems(ids);
  const chosen = mode === "enquiry" ? items : items.filter((i) => selected.includes(i.id));
  const allOn = mode === "wishlist" && items.length > 0 && items.every((i) => selected.includes(i.id));

  const btn = `flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-white ${accent}`;
  if (ids.length === 0) {
    return (
      <div className="py-10 text-center text-neutral-600">
        <p className="text-lg font-medium">{mode === "wishlist" ? "Your wishlist is empty" : "No products selected yet"}</p>
        <p className="mt-1 text-sm">{mode === "wishlist" ? "Tap the heart on any product to save it here. Saved items stay on this device." : "Use “Add to enquiry” on products, then send them all in one WhatsApp message."}</p>
        <Link href="/" onClick={onClose} className="mt-4 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium">Browse the catalog</Link>
      </div>
    );
  }
  return (
    <div>
      {mode === "wishlist" && items.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600">{selected.filter((s) => items.some((i) => i.id === s)).length} of {items.length} selected for enquiry</span>
          <button type="button" className="font-medium underline" onClick={() => (allOn ? removeIds("enquiry", items.map((i) => i.id)) : addIds("enquiry", items.map((i) => i.id)))}>{allOn ? "Clear selection" : "Select all"}</button>
        </div>
      )}
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">We couldn’t load your products. <button type="button" onClick={retry} className="font-medium underline">Try again</button></div>}
      {missing.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {missing.length} item{missing.length === 1 ? " is" : "s are"} no longer available.{" "}
          <button type="button" className="font-medium underline" onClick={() => { removeIds(mode, missing); removeIds("enquiry", missing); }}>Remove {missing.length === 1 ? "it" : "them"}</button>
        </div>
      )}
      <ul className="divide-y divide-neutral-200">
        {loading && ids.filter((id) => !known.has(id) && !gone.has(id)).map((id) => (
          <li key={id} className="flex animate-pulse items-center gap-3 py-3"><div className="h-16 w-16 rounded-md bg-neutral-200" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-neutral-200" /><div className="h-3 w-1/4 rounded bg-neutral-200" /></div></li>
        ))}
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            {mode === "wishlist" && <input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(p.id)} onChange={() => toggleId("enquiry", p.id)} aria-label={`Include ${p.name} in enquiry`} />}
            <Link href={`/p/${p.slug}`} onClick={onClose} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100"><SafeImage src={p.thumbnail} alt="" sizes="64px" /></Link>
            <div className="min-w-0 flex-1">
              <Link href={`/p/${p.slug}`} onClick={onClose} className="line-clamp-2 text-sm font-medium hover:underline">{p.name}</Link>
              <div className="text-sm text-neutral-600">{formatPrice(p.price, p.currency)} · <span className={p.inStock ? "text-green-700" : "text-red-700"}>{p.inStock ? "In stock" : "Out of stock"}</span></div>
            </div>
            <button type="button" onClick={() => { removeId(mode, p.id); if (mode === "wishlist") removeId("enquiry", p.id); }} aria-label={`Remove ${p.name}`} className="h-10 w-10 shrink-0 rounded-full text-lg text-neutral-500 hover:bg-neutral-100">✕</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2">
        <WhatsAppButton number={number} items={chosen.map((p) => ({ name: p.name, slug: p.slug }))} className={btn} label={chosen.length ? `Enquire on WhatsApp (${chosen.length})` : "Enquire on WhatsApp"} />
        <button type="button" className="w-full py-1 text-sm text-neutral-500 underline" onClick={() => { clearList(mode); if (mode === "wishlist") clearList("enquiry"); }}>{mode === "wishlist" ? "Clear wishlist" : "Clear selection"}</button>
      </div>
    </div>
  );
}

/** Floating bar + slide-up panel that appears as soon as one product is selected for enquiry, on every page. */
export function EnquiryBar({ number, accent }: { number: string | null; accent?: string }) {
  const sel = useList("enquiry");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => { if (!sel.length) setOpen(false); }, [sel.length]);
  if (!sel.length) return null;
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={close} aria-hidden />}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Products selected for enquiry" className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem] sm:rounded-2xl">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold">Your enquiry ({sel.length})</h2><button type="button" onClick={close} aria-label="Close" className="h-10 w-10 rounded-full text-xl hover:bg-neutral-100">✕</button></div>
          <ListPanel mode="enquiry" number={number} accent={accent} onClose={close} />
        </div>
      )}
      {!open && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setOpen(true)} className="mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">
            <span>{sel.length} selected for enquiry</span><span>Review &amp; send →</span>
          </button>
        </div>
      )}
    </>
  );
}
