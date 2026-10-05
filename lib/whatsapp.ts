// WhatsApp click-to-chat: pure functions (no browser APIs) so they are unit-tested and shared by every design.
// No cart, no checkout: the enquiry IS the conversion.

export interface EnquiryItem { name: string; slug: string }

/** Digits only, 8-15 long (E.164 without "+"). Returns null when the configured value is unusable. */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export const productUrl = (origin: string, slug: string) => `${origin.replace(/\/+$/, "")}/p/${encodeURIComponent(slug)}`;

/** The pre-filled message. One product or many, same structure (matches the assignment's example). */
export function buildEnquiryMessage(items: EnquiryItem[], origin: string): string {
  const lines = items.map((p, i) => `${i + 1}. ${p.name} - ${productUrl(origin, p.slug)}`);
  return [`Hi, I am interested in the following product${items.length === 1 ? "" : "s"}:`, ...lines, "Please share more details and pricing."].join("\n");
}

/** Standard https://wa.me/<number>?text=<encoded> link: opens the WhatsApp app on phones and WhatsApp Web on desktop. */
export function buildWhatsAppUrl(number: string | null | undefined, message: string): string | null {
  const n = normalizeWhatsAppNumber(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}

export type EnquiryResult = { ok: true; url: string } | { ok: false; reason: "no-products" | "no-number" };

export function buildEnquiry(number: string | null | undefined, items: EnquiryItem[], origin: string): EnquiryResult {
  if (items.length === 0) return { ok: false, reason: "no-products" };
  const url = buildWhatsAppUrl(number, buildEnquiryMessage(items, origin));
  return url ? { ok: true, url } : { ok: false, reason: "no-number" };
}

export const ENQUIRY_ERRORS = {
  "no-products": "Select at least one product to enquire about.",
  "no-number": "WhatsApp enquiries are not set up for this catalog yet. Please try again later."
} as const;
