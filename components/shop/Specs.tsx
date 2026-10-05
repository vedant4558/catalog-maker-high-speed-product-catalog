import type { ProductDetail } from "@/lib/dto";
import { formatPrice, stockLabel } from "@/lib/format";

/** SKU, category, variants and scalar metadata. Every field is optional: missing data simply isn't rendered. */
export function Specs({ product: p, className = "" }: { product: ProductDetail; className?: string }) {
  const meta = p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
    ? Object.entries(p.metadata as Record<string, unknown>).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v) && String(v).trim() !== "").slice(0, 12)
    : [];
  return (
    <div className={className}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {p.sku && <><dt className="text-neutral-500">SKU</dt><dd>{p.sku}</dd></>}
        {p.category && <><dt className="text-neutral-500">Category</dt><dd>{p.category.name}</dd></>}
        {p.stockQty != null && p.inStock && p.stockQty > 0 && p.stockQty <= 10 && <><dt className="text-neutral-500">Stock</dt><dd>Only {p.stockQty} left</dd></>}
        {meta.map(([k, v]) => <><dt key={`k${k}`} className="capitalize text-neutral-500">{k.replace(/[_-]+/g, " ")}</dt><dd key={`v${k}`}>{String(v)}</dd></>)}
      </dl>
      {p.variants.length > 0 && (
        <div className="mt-3">
          <h2 className="mb-1 font-semibold">Variants</h2>
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {p.variants.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{v.title}</span>
                <span className="shrink-0 text-right">{v.price != null ? formatPrice(v.price, p.currency) : ""} <span className={v.inStock ? "text-green-700" : "text-neutral-500"}>{stockLabel(v.stockStatus)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
