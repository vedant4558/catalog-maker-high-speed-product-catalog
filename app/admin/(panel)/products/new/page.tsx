import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage() {
  const { client } = await requirePageContext();
  const cats = await listCategoryTree(client.id);
  return (
    <>
      <PageHeader title="Add product" />
      <ProductForm id={null} categories={cats.map((c) => ({ id: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }))} source={null}
        initial={{ name: "", slug: "", sku: "", description: "", price: "", compareAtPrice: "", stockStatus: "IN_STOCK", stockQty: "", categoryId: "", sourceUrl: "", isActive: true, metadata: "", images: [{ url: "", alt: "" }], variants: [] }} />
    </>
  );
}
