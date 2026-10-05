"use server";
import { revalidatePath } from "next/cache";
import { invalidateCatalog } from "@/lib/cache";
import { withAdmin } from "@/lib/admin/context";
import type { ActionResult } from "@/lib/admin/results";
import { formToObject, parseInput, productSchema } from "@/lib/admin/validators";
import { createProduct, deleteProduct, updateProduct } from "@/lib/admin/services/products";

export async function saveProductAction(id: string | null, _prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withAdmin(async ({ client }) => {
    const input = parseInput(productSchema, formToObject(formData));
    const saved = id ? await updateProduct(client.id, id, input) : await createProduct(client.id, client, input);
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    invalidateCatalog();
    return { ok: true, message: id ? "Product saved." : "Product created.", data: { id: saved.id } };
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  return withAdmin(async ({ client }) => {
    await deleteProduct(client.id, id);
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    invalidateCatalog();
    return { ok: true, message: "Product deleted." };
  });
}
