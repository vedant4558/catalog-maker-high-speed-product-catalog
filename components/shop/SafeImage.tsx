"use client";
import Image from "next/image";
import { useState } from "react";

export function Placeholder({ label }: { label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300">
      <svg viewBox="0 0 24 24" className="h-1/4 w-1/4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 9" /></svg>
    </div>
  );
}

/** next/image (responsive sizes, lazy, AVIF/WebP) that falls back to a placeholder when the file is missing or fails. */
export function SafeImage({ src, alt, sizes, priority, className = "object-cover" }: { src: string | null; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <Placeholder label={alt || "No image"} />;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} onError={() => setBad(true)} className={className} />;
}
