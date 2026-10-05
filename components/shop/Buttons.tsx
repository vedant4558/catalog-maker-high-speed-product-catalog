"use client";
import { toggleId, useList } from "./store";

/** Heart toggle. Works identically in every design; `className` lets a design restyle it. */
export function WishlistButton({ id, name, className = "", label = false }: { id: string; name: string; className?: string; label?: boolean }) {
  const saved = useList("wishlist").includes(id);
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleId("wishlist", id); }}
      aria-pressed={saved} aria-label={saved ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className={`inline-flex items-center justify-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
      {label && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

/** "Add to enquiry" toggle: builds the selection that becomes ONE WhatsApp message. */
export function EnquiryToggle({ id, name, className = "", compact = false }: { id: string; name: string; className?: string; compact?: boolean }) {
  const on = useList("enquiry").includes(id);
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleId("enquiry", id); }}
      aria-pressed={on} aria-label={on ? `Remove ${name} from enquiry` : `Add ${name} to enquiry`} className={`inline-flex items-center justify-center gap-1.5 ${className}`}>
      <span aria-hidden>{on ? "✓" : "+"}</span><span>{on ? (compact ? "Added" : "Added to enquiry") : (compact ? "Enquire" : "Add to enquiry")}</span>
    </button>
  );
}

export function WishlistCount({ className = "" }: { className?: string }) {
  const n = useList("wishlist").length;
  return n ? <span className={className} aria-label={`${n} saved`}>{n}</span> : null;
}
