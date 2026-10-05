const cache = new Map<string, Intl.NumberFormat>();
export function formatPrice(n: number, currency = "INR"): string {
  let f = cache.get(currency);
  if (!f) { try { f = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }); } catch { f = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }); } cache.set(currency, f); }
  return f.format(n);
}
export const stockLabel = (s: string) => (s === "OUT_OF_STOCK" ? "Out of stock" : s === "ON_BACKORDER" ? "On backorder" : "In stock");
