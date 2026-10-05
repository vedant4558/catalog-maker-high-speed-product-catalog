import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { getProductForEdit } from "@/lib/admin/services/products";
import { optionsToText } from "@/lib/admin/validators";
import { ActionButton } from "@/components/admin/ActionButton";
import { Alert, Card, PageHeader, btnDangerCls, fmtDate } from "@/components/admin/ui";
import { deleteProductAction } from "@/app/admin/actions/products";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const { client } = await requirePageContext();
  const [p, cats] = await Promise.all([getProductForEdit(client.id, id), listCategoryTree(client.id)]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.name} subtitle={p.sourceId ? "Imported product: your edits are kept across syncs." : "Manual product"} actions={<Link className="text-sm underline" href={`/api/v1/products/${p.slug}`} target="_blank">View in API</Link>} />
      {created && <div className="mb-4"><Alert kind="success">Product created.</Alert></div>}
      <ProductForm id={p.id} categories={cats.map((c) => ({ id: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }))}
        source={p.source ? { name: p.source.name, type: p.source.type, externalId: p.externalId, lastSyncedAt: p.lastSyncedAt ? fmtDate(p.lastSyncedAt) : null, locked: Object.keys((p.manualOverrides ?? {}) as object) } : null}
        initial={{
          name: p.name, slug: p.slug, sku: p.sku ?? "", description: p.description ?? "", price: String(Number(p.price)), compareAtPrice: p.compareAtPrice ? String(Number(p.compareAtPrice)) : "",
          stockStatus: p.stockStatus, stockQty: p.stockQty == null ? "" : String(p.stockQty), categoryId: p.categoryId ?? "", sourceUrl: p.sourceUrl ?? "", isActive: p.isActive,
          metadata: p.metadata ? JSON.stringify(p.metadata, null, 2) : "",
          images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
          variants: p.variants.map((v) => ({ externalId: v.externalId ?? "", title: v.title, sku: v.sku ?? "", price: v.price == null ? "" : String(Number(v.price)), stockStatus: v.stockStatus, options: optionsToText(v.options) }))
        }} />
      <Card title="Danger zone" className="mt-6 border-red-200">
        <p className="mb-3 text-sm text-neutral-600">{p.sourceId ? "This product is synchronised from a store: deleting it here removes it from the catalog, but the next sync will bring it back. To keep it out, untick “Visible in the catalog” instead." : "Deleting a product permanently removes it, its images and variants."}</p>
        <ActionButton action={deleteProductAction.bind(null, p.id)} label="Delete product" pendingLabel="Deleting…" className={btnDangerCls} confirmText={`Delete “${p.name}”? This cannot be undone.`} redirectTo="/admin/products" />
      </Card>
    </>
  );
}
