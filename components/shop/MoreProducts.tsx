"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListItem } from "@/lib/dto";
import { GridCard } from "@/designs/grid/Card";
import { ShowcaseCard } from "@/designs/showcase/Card";

/**
 * Progressive loading: the first page is server-rendered; further pages load automatically as the customer scrolls
 * near the end (or via the button), from the internal API with a cursor. Skeletons show while loading.
 */
export function MoreProducts({ design, qs, initialCursor }: { design: string; qs: string; initialCursor: string | null }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const Card = design === "showcase" ? ShowcaseCard : GridCard;

  const load = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true); setError(false);
    try {
      const r = await fetch(`/api/v1/products?${qs}${qs ? "&" : ""}cursor=${encodeURIComponent(cursor)}`);
      if (!r.ok) throw new Error("bad status");
      const d = (await r.json()) as { items: ListItem[]; nextCursor: string | null };
      setItems((x) => { const seen = new Set(x.map((i) => i.id)); return [...x, ...d.items.filter((i) => !seen.has(i.id))]; });
      setCursor(d.nextCursor);
    } catch { setError(true); } finally { setLoading(false); }
  }, [cursor, loading, qs]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void load(); }, { rootMargin: "600px" });
    io.observe(el);
    // If the customer already scrolled to the end before hydration, the observer may not report it: check once explicitly.
    if (el.getBoundingClientRect().top < window.innerHeight + 600) void load();
    return () => io.disconnect();
  }, [cursor, error, load]);

  return (
    <>
      {items.map((p) => <Card key={p.id} p={p} />)}
      {loading && Array.from({ length: 4 }).map((_, i) => <li key={`s${i}`} className="animate-pulse" aria-hidden><div className="aspect-square rounded-lg bg-neutral-200" /><div className="mt-2 h-3 w-3/4 rounded bg-neutral-200" /><div className="mt-2 h-3 w-1/3 rounded bg-neutral-200" /></li>)}
      {(cursor || error) && (
        <li className="col-span-full flex flex-col items-center gap-2 py-4" ref={sentinel as never}>
          {error && <p role="alert" className="text-sm text-red-700">We couldn’t load more products.</p>}
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60">{loading ? "Loading…" : error ? "Try again" : "Load more products"}</button>
        </li>
      )}
    </>
  );
}
