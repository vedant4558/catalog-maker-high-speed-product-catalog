"use client";
import { Placeholder, SafeImage as Img } from "./SafeImage";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryImage { url: string; alt: string | null }

/**
 * Product gallery: main image + thumbnails + full-screen lightbox (keyboard: ← → Esc, swipe on touch).
 * Handles 0 images (placeholder), 1 image (no thumbnails / arrows) and many.
 * `thumbs="side"` = vertical strip on desktop (Design 2), "below" = horizontal strip (Design 1).
 */
export function Gallery({ images, name, thumbs = "below", ratio = "aspect-square" }: { images: GalleryImage[]; name: string; thumbs?: "below" | "side"; ratio?: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const go = useCallback((d: number) => setI((x) => (n ? (x + d + n) % n : 0)), [n]);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, go]);

  const cur = images[i];
  const label = (k: number) => images[k]?.alt || `${name} (image ${k + 1} of ${n})`;
  const strip = n > 1 && (
    <ul className={`flex gap-2 overflow-x-auto ${thumbs === "side" ? "lg:max-h-[34rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible" : ""}`} aria-label="Image thumbnails">
      {images.map((im, k) => (
        <li key={k} className="shrink-0">
          <button type="button" onClick={() => setI(k)} aria-label={`Show image ${k + 1}`} aria-current={k === i} className={`relative block h-16 w-16 overflow-hidden rounded-md border-2 bg-neutral-100 ${k === i ? "border-neutral-900" : "border-transparent opacity-70 hover:opacity-100"}`}>
            <Img src={im.url} alt="" sizes="64px" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={thumbs === "side" ? "flex flex-col gap-3 lg:flex-row-reverse" : "flex flex-col gap-3"}>
      <div className="relative min-w-0 flex-1">
        <div className={`relative w-full overflow-hidden rounded-lg bg-neutral-100 ${ratio}`}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current != null && n > 1) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } touch.current = null; }}>
          {cur ? (
            <button type="button" onClick={() => setOpen(true)} aria-label="Open full-screen image" className="absolute inset-0 cursor-zoom-in">
              <Img key={cur.url} src={cur.url} alt={label(i)} sizes="(min-width:1024px) 50vw, 100vw" priority className="object-contain" />
            </button>
          ) : <Placeholder label={`${name}: no image available`} />}
        </div>
        {n > 1 && <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 text-lg shadow hover:bg-white">‹</button>
          <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 text-lg shadow hover:bg-white">›</button>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{i + 1} / {n}</span>
        </>}
      </div>
      {strip}

      {open && cur && (
        <div role="dialog" aria-modal="true" aria-label={`${name} images`} className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setOpen(false)}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current != null && n > 1) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } touch.current = null; }}>
          <div className="flex items-center justify-between p-3 text-white"><span className="text-sm">{i + 1} / {n}</span><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close full-screen view" className="h-11 w-11 rounded-full bg-white/10 text-xl hover:bg-white/20">✕</button></div>
          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
            <Img key={cur.url} src={cur.url} alt={label(i)} sizes="100vw" className="object-contain" />
            {n > 1 && <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl text-white hover:bg-white/30">‹</button>
              <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl text-white hover:bg-white/30">›</button>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
