import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { Alert, Card, PageHeader } from "@/components/admin/ui";
import { CategoryForm } from "../CategoryForm";
import { DeleteCategory } from "./DeleteCategory";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await requirePageContext();
  const [c, rows] = await Promise.all([db.category.findFirst({ where: { id, clientId: client.id }, include: { _count: { select: { products: true, children: true } } } }), listCategoryTree(client.id)]);
  if (!c) notFound();
  // A category can't become a child of itself or its own descendants: hide those from the parent list.
  const blocked = new Set<string>([id]);
  for (const r of rows) if (r.parentId && blocked.has(r.parentId)) blocked.add(r.id);
  const options = rows.filter((r) => !blocked.has(r.id)).map((r) => ({ id: r.id, label: `${"— ".repeat(r.depth)}${r.name}` }));
  return (
    <>
      <PageHeader title={c.name} subtitle={`${c._count.products} product(s) · ${c._count.children} subcategor${c._count.children === 1 ? "y" : "ies"}`} />
      {c.sourceType !== "MANUAL" && <div className="mb-4"><Alert kind="info">Created by a {c.sourceType === "SHOPIFY" ? "Shopify" : "WooCommerce"} import. Your edits to name, order and visibility are kept when syncing. If you delete it, the next sync recreates it for products that still belong to it.</Alert></div>}
      <Card><CategoryForm id={c.id} parents={options} initial={{ name: c.name, slug: c.slug, parentId: c.parentId ?? "", imageUrl: c.imageUrl ?? "", isVisible: c.isVisible }} /></Card>
      <Card title="Delete category" className="mt-6 border-red-200"><DeleteCategory id={c.id} name={c.name} options={options} /></Card>
    </>
  );
}
