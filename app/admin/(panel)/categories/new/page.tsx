import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { Card, PageHeader } from "@/components/admin/ui";
import { CategoryForm } from "../CategoryForm";

export default async function NewCategoryPage() {
  const { client } = await requirePageContext();
  const cats = await listCategoryTree(client.id);
  return (
    <>
      <PageHeader title="Add category" />
      <Card><CategoryForm id={null} parents={cats.map((c) => ({ id: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }))} initial={{ name: "", slug: "", parentId: "", imageUrl: "", isVisible: true }} /></Card>
    </>
  );
}
