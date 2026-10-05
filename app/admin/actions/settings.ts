"use server";
import { revalidatePath } from "next/cache";
import { invalidateCatalog } from "@/lib/cache";
import { withAdmin } from "@/lib/admin/context";
import type { ActionResult } from "@/lib/admin/results";
import { formToObject, parseInput, settingsSchema } from "@/lib/admin/validators";
import { updateSettings } from "@/lib/admin/services/settings";

export async function saveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return withAdmin(async ({ client }) => {
    await updateSettings(client.id, parseInput(settingsSchema, formToObject(formData)));
    invalidateCatalog();
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    // The public catalog caches configuration for up to a minute at the edge.
    return { ok: true, message: "Settings saved. The public catalog picks them up within about a minute." };
  });
}
