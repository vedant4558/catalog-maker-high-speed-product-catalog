"use client";
import { useState } from "react";
import { ENQUIRY_ERRORS, buildEnquiry, type EnquiryItem } from "@/lib/whatsapp";

/**
 * Real click-to-chat enquiry. The link is generated at click time from the configured number (admin Settings)
 * and the current site origin, so it is correct on custom domains. With no number configured, or nothing selected,
 * a clear message is shown instead of a dead link.
 */
export function WhatsAppButton({ number, items, label, className = "", onSent }: { number: string | null; items: EnquiryItem[]; label?: string; className?: string; onSent?: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const text = label ?? (items.length > 1 ? `Enquire on WhatsApp (${items.length})` : "Enquire on WhatsApp");
  return (
    <div className="w-full">
      <button type="button" className={className}
        onClick={() => {
          const r = buildEnquiry(number, items, window.location.origin);
          if (!r.ok) { setMsg(ENQUIRY_ERRORS[r.reason]); return; }
          setMsg(null);
          window.open(r.url, "_blank", "noopener,noreferrer");
          onSent?.();
        }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" /><path d="M8.5 9.5c.3 2.2 2.800 4.700 5 5l1.300-1.200-1.800-1-.8.700c-.8-.4-1.600-1.200-2-2l.7-.8-1-1.800z" fill="currentColor" stroke="none" /></svg>
        <span>{text}</span>
      </button>
      {msg && <p role="alert" className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
