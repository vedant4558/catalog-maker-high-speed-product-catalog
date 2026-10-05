"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/app/admin/actions/products";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Alert, Card, Field, btnGhostCls, inputCls } from "@/components/admin/ui";

export interface ProductFormInitial {
  name: string; slug: string; sku: string; description: string; price: string; compareAtPrice: string;
  stockStatus: string; stockQty: string; categoryId: string; sourceUrl: string; isActive: boolean; metadata: string;
  images: { url: string; alt: string }[];
  variants: { externalId: string; title: string; sku: string; price: string; stockStatus: string; options: string }[];
}
export interface CategoryOption { id: string; label: string }
export interface SourceInfo { name: string; type: string; externalId: string | null; lastSyncedAt: string | null; locked: string[] }

const LOCK_LABEL: Record<string, string> = { name: "name", sku: "SKU", description: "description", price: "price", compareAtPrice: "compare-at price", stockStatus: "availability", stockQty: "stock quantity", category: "category", images: "images", variants: "variants", metadata: "metadata", isActive: "visibility" };

export function ProductForm({ id, initial, categories, source }: { id: string | null; initial: ProductFormInitial; categories: CategoryOption[]; source: SourceInfo | null }) {
  const router = useRouter();
  const [state, action] = useActionState(saveProductAction.bind(null, id), null);
  const [images, setImages] = useState(initial.images);
  const [variants, setVariants] = useState(initial.variants);
  const [unlock, setUnlock] = useState<string[]>([]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (!state) return;
    if (state.ok && !id && state.data) router.replace(`/admin/products/${state.data.id}?created=1`);
    else if (state.ok) { setUnlock([]); router.refresh(); }
    else if (state.authExpired) router.push("/admin/login");
  }, [state, id, router]);

  const setImg = (i: number, k: "url" | "alt", v: string) => setImages((a) => a.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const setVar = (i: number, k: keyof ProductFormInitial["variants"][number], v: string) => setVariants((a) => a.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Alert kind="error">{state.message}</Alert>}
      {state?.ok && <Alert kind="success">{state.message}</Alert>}

      <Card title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name" htmlFor="name" error={fe.name}><input id="name" name="name" defaultValue={initial.name} required maxLength={200} className={inputCls} /></Field></div>
          <Field label="SKU / product ID" htmlFor="sku" error={fe.sku}><input id="sku" name="sku" defaultValue={initial.sku} maxLength={100} className={inputCls} /></Field>
          <Field label="URL name (slug)" htmlFor="slug" error={fe.slug} hint="Used in the product link. Leave empty to generate from the name."><input id="slug" name="slug" defaultValue={initial.slug} maxLength={100} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Description" htmlFor="description" error={fe.description}><textarea id="description" name="description" defaultValue={initial.description} rows={5} className={inputCls} /></Field></div>
          <Field label="Category / subcategory" htmlFor="categoryId" error={fe.categoryId}>
            <select id="categoryId" name="categoryId" defaultValue={initial.categoryId} className={inputCls}><option value="">Uncategorised</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="h-4 w-4" /> Visible in the catalog</label>
        </div>
      </Card>

      <Card title="Price & availability">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Price" htmlFor="price" error={fe.price}><input id="price" name="price" inputMode="decimal" defaultValue={initial.price} required className={inputCls} /></Field>
          <Field label="Compare-at price" htmlFor="compareAtPrice" error={fe.compareAtPrice} hint="Optional: shows a strike-through price."><input id="compareAtPrice" name="compareAtPrice" inputMode="decimal" defaultValue={initial.compareAtPrice} className={inputCls} /></Field>
          <Field label="Availability" htmlFor="stockStatus" error={fe.stockStatus}>
            <select id="stockStatus" name="stockStatus" defaultValue={initial.stockStatus} className={inputCls}><option value="IN_STOCK">In stock</option><option value="OUT_OF_STOCK">Out of stock</option><option value="ON_BACKORDER">Backorder</option></select>
          </Field>
          <Field label="Stock quantity" htmlFor="stockQty" error={fe.stockQty} hint="Optional."><input id="stockQty" name="stockQty" inputMode="numeric" defaultValue={initial.stockQty} className={inputCls} /></Field>
        </div>
      </Card>

      <Card title="Images">
        <input type="hidden" name="images" value={JSON.stringify(images.filter((i) => i.url.trim()))} />
        <p className="mb-2 text-xs text-neutral-500">Paste image links. The first image is the thumbnail shown in lists; products without images show a placeholder.</p>
        <div className="space-y-2">
          {images.map((img, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img.url ? <img src={img.url} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} /> : <span className="h-10 w-10 rounded bg-neutral-100" />}
              <input value={img.url} onChange={(e) => setImg(i, "url", e.target.value)} placeholder="https://…" aria-label={`Image ${i + 1} URL`} className={`${inputCls} min-w-0 flex-1 basis-60`} />
              <input value={img.alt} onChange={(e) => setImg(i, "alt", e.target.value)} placeholder="Alt text (optional)" aria-label={`Image ${i + 1} alt text`} className={`${inputCls} basis-40 sm:w-48 sm:flex-none`} />
              <button type="button" className={btnGhostCls} disabled={i === 0} onClick={() => setImages((a) => { const c = [...a]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} aria-label="Move image up">↑</button>
              <button type="button" className={btnGhostCls} onClick={() => setImages((a) => a.filter((_, j) => j !== i))} aria-label="Remove image">✕</button>
            </div>
          ))}
        </div>
        {fe.images && <p className="mt-1 text-xs text-red-600">{fe.images}</p>}
        <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setImages((a) => [...a, { url: "", alt: "" }])}>+ Add image</button>
      </Card>

      <Card title="Variants">
        <input type="hidden" name="variants" value={JSON.stringify(variants.filter((v) => v.title.trim()))} />
        <p className="mb-2 text-xs text-neutral-500">Optional. Options look like <code>Size=Large; Color=Red</code>. A blank variant price uses the product price.</p>
        <div className="space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-neutral-200 p-2 sm:grid-cols-6">
              <input value={v.title} onChange={(e) => setVar(i, "title", e.target.value)} placeholder="Variant name" aria-label="Variant name" className={`${inputCls} sm:col-span-2`} />
              <input value={v.sku} onChange={(e) => setVar(i, "sku", e.target.value)} placeholder="SKU" aria-label="Variant SKU" className={inputCls} />
              <input value={v.price} onChange={(e) => setVar(i, "price", e.target.value)} placeholder="Price" inputMode="decimal" aria-label="Variant price" className={inputCls} />
              <select value={v.stockStatus} onChange={(e) => setVar(i, "stockStatus", e.target.value)} aria-label="Variant availability" className={inputCls}><option value="IN_STOCK">In stock</option><option value="OUT_OF_STOCK">Out of stock</option><option value="ON_BACKORDER">Backorder</option></select>
              <button type="button" className={btnGhostCls} onClick={() => setVariants((a) => a.filter((_, j) => j !== i))}>Remove</button>
              <input value={v.options} onChange={(e) => setVar(i, "options", e.target.value)} placeholder="Options, e.g. Size=Large; Color=Red" aria-label="Variant options" className={`${inputCls} sm:col-span-6`} />
            </div>
          ))}
        </div>
        {fe.variants && <p className="mt-1 text-xs text-red-600">{fe.variants}</p>}
        <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setVariants((a) => [...a, { externalId: "", title: "", sku: "", price: "", stockStatus: "IN_STOCK", options: "" }])}>+ Add variant</button>
      </Card>

      <Card title="Source & metadata">
        {source ? (
          <div className="mb-3 space-y-1 text-sm">
            <div>Imported from <strong>{source.name}</strong> ({source.type === "SHOPIFY" ? "Shopify" : "WooCommerce"}) · source ID <code>{source.externalId}</code> · last synced {source.lastSyncedAt ?? "never"}</div>
            {initial.sourceUrl && <div>Product URL: <a className="break-all underline" href={initial.sourceUrl} target="_blank" rel="noreferrer noopener">{initial.sourceUrl}</a></div>}
            <label className="mt-2 flex items-start gap-2"><input type="checkbox" name="lock" defaultChecked className="mt-0.5 h-4 w-4" /><span>Keep my changes when this product is synchronised (locks the fields I edit).</span></label>
            {source.locked.length > 0 && (
              <div className="mt-2 rounded-md bg-amber-50 p-2">
                <div className="text-xs font-medium text-amber-900">Locked fields (sync will not overwrite): tick to unlock</div>
                <input type="hidden" name="unlock" value={unlock.join(",")} />
                <div className="mt-1 flex flex-wrap gap-3">{source.locked.map((f) => <label key={f} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={unlock.includes(f)} onChange={(e) => setUnlock((u) => (e.target.checked ? [...u, f] : u.filter((x) => x !== f)))} /> {LOCK_LABEL[f] ?? f}</label>)}</div>
              </div>
            )}
          </div>
        ) : (
          <Field label="Product URL" htmlFor="sourceUrl" error={fe.sourceUrl} hint="Optional. Used in WhatsApp enquiries; leave empty to use the catalog page link."><input id="sourceUrl" name="sourceUrl" defaultValue={initial.sourceUrl} className={`${inputCls} mb-3`} /></Field>
        )}
        <Field label="Metadata (JSON)" htmlFor="metadata" error={fe.metadata} hint='Optional extra details as a JSON object, e.g. {"material":"Wool","size":"5x7 ft"}'>
          <textarea id="metadata" name="metadata" defaultValue={initial.metadata} rows={4} spellCheck={false} className={`${inputCls} font-mono`} />
        </Field>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <SubmitButton>{id ? "Save changes" : "Create product"}</SubmitButton>
        <button type="button" className={btnGhostCls} onClick={() => router.push("/admin/products")}>Back to list</button>
      </div>
    </form>
  );
}
