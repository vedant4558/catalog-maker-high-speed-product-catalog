import Link from "next/link";
import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, Card, PageHeader, btnCls } from "@/components/admin/ui";
import { moveCategoryAction, toggleCategoryAction } from "@/app/admin/actions/categories";

export default async function CategoriesPage() {
  const { client } = await requirePageContext();
  const rows = await listCategoryTree(client.id);
  const sibs = (parentId: string | null) => rows.filter((r) => r.parentId === parentId);
  return (
    <>
      <PageHeader title="Categories" subtitle="Order and visibility control what customers see." actions={<Link className={btnCls} href="/admin/categories/new">Add category</Link>} />
      {rows.length === 0 ? <Card><p className="text-sm text-neutral-600">No categories yet. Create one, or import products to create them automatically.</p></Card> : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Category</th><th className="p-3">Products</th><th className="p-3">Visibility</th><th className="p-3">Order</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((c) => {
                const s = sibs(c.parentId);
                const idx = s.findIndex((x) => x.id === c.id);
                return (
                  <tr key={c.id} className={c.isVisible ? "" : "bg-neutral-50 text-neutral-500"}>
                    <td className="p-3"><span style={{ paddingLeft: c.depth * 20 }} className="inline-flex items-center gap-2">{c.depth > 0 && <span aria-hidden>↳</span>}<Link href={`/admin/categories/${c.id}`} className="font-medium hover:underline">{c.name}</Link>{c.sourceType !== "MANUAL" && <Badge tone="blue">{c.sourceType === "SHOPIFY" ? "Shopify" : "WooCommerce"}</Badge>}</span></td>
                    <td className="p-3">{c.productCount === 0 ? <Badge tone="amber">Empty</Badge> : c.productCount}</td>
                    <td className="p-3"><ActionButton action={toggleCategoryAction.bind(null, c.id, !c.isVisible)} label={c.isVisible ? "Visible" : "Hidden"} title="Click to toggle" /></td>
                    <td className="p-3"><span className="inline-flex gap-1">
                      <ActionButton action={moveCategoryAction.bind(null, c.id, "up")} label="↑" pendingLabel="…" title="Move up" className={`rounded-md border border-neutral-300 px-2 py-1 text-sm ${idx === 0 ? "pointer-events-none opacity-30" : "hover:bg-neutral-100"}`} />
                      <ActionButton action={moveCategoryAction.bind(null, c.id, "down")} label="↓" pendingLabel="…" title="Move down" className={`rounded-md border border-neutral-300 px-2 py-1 text-sm ${idx === s.length - 1 ? "pointer-events-none opacity-30" : "hover:bg-neutral-100"}`} />
                    </span></td>
                    <td className="p-3 text-right"><Link className="underline" href={`/admin/categories/${c.id}`}>Edit</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
