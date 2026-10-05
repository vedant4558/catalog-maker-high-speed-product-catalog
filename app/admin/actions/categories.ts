"use server";
import { revalidatePath } from "next/cache";
import { invalidateCatalog } from "@/lib/cache";
import { withAdmin } from "@/lib/admin/context";
import type { ActionResult } from "@/lib/admin/results";
import { categorySchema, formToObject, parseInput } from "@/lib/admin/validators";
import { createCategory, deleteCategory, moveCategory, setCategoryVisibility, updateCategory } from "@/lib/admin/services/categories";

const refresh = () => { invalidateCatalog(); revalidatePath("/admin/categories"); revalidatePath("/admin/products"); revalidatePath("/admin"); };

export async function saveCategoryAction(id: string | null, _prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withAdmin(async ({ client }) => {
    const input = parseInput(categorySchema, formToObject(formData));
    if (id) { await updateCategory(client.id, id, input); refresh(); return { ok: true, message: "Category saved.", data: { id } }; }
    const c = await createCategory(client.id, input);
    refresh();
    return { ok: true, message: "Category created.", data: { id: c.id } };
  });
}

export async function moveCategoryAction(id: string, dir: "up" | "down"): Promise<ActionResult> {
  return withAdmin(async ({ client }) => { await moveCategory(client.id, id, dir); refresh(); return { ok: true }; });
}

export async function toggleCategoryAction(id: string, visible: boolean): Promise<ActionResult> {
  return withAdmin(async ({ client }) => { await setCategoryVisibility(client.id, id, visible); refresh(); return { ok: true, message: visible ? "Category is now visible." : "Category hidden from the catalog." }; });
}

export async function deleteCategoryAction(id: string, moveTo: string | null): Promise<ActionResult> {
  return withAdmin(async ({ client }) => {
    const r = await deleteCategory(client.id, id, moveTo || null);
    refresh();
    return { ok: true, message: `Category deleted. ${r.productsMoved} product(s) and ${r.subcategoriesMoved} subcategor${r.subcategoriesMoved === 1 ? "y" : "ies"} moved.` };
  });
}
