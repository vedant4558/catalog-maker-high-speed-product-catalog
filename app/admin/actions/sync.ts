"use server";
import { revalidatePath } from "next/cache";
import { invalidateCatalog } from "@/lib/cache";
import { withAdmin } from "@/lib/admin/context";
import type { ActionResult } from "@/lib/admin/results";
import { db } from "@/lib/db";
import { credentialStatus } from "@/lib/sync/adapters";
import { runSyncForClient } from "@/lib/sync/run";
import { createSource, updateSource } from "@/lib/admin/services/sources";
import { formToObject, parseInput, sourceSchema } from "@/lib/admin/validators";
import { z } from "zod";

export interface SyncOutcome { status: string; message: string; created: number; updated: number; unchanged: number; failed: number; deactivated: number }

/** Runs the existing Part 2 engine. Missing credentials are reported in plain words; engine/source errors are already friendly and recorded in the history. */
export async function runSyncAction(sourceId: string, mode: "import" | "manual"): Promise<ActionResult<SyncOutcome>> {
  return withAdmin(async ({ client }) => {
    const source = await db.source.findFirst({ where: { id: sourceId, clientId: client.id } });
    if (!source) return { ok: false, message: "That source no longer exists." };
    const cred = credentialStatus(source);
    if (!cred.ok) return { ok: false, message: `Cannot ${mode === "import" ? "import" : "sync"} yet: missing ${cred.missing.join(", ")}. ${cred.hint}` };
    const r = await runSyncForClient(client.id, sourceId, { trigger: mode });
    revalidatePath("/admin", "layout");
    invalidateCatalog();
    const data: SyncOutcome = { status: r.status, message: r.message, created: r.created, updated: r.updated, unchanged: r.unchanged, failed: r.failed, deactivated: r.deactivated };
    return r.status === "FAILED" ? { ok: false, message: r.message } : { ok: true, message: r.message, data };
  });
}

export async function saveSourceAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return withAdmin(async ({ client }) => {
    const raw = formToObject(formData);
    if (id) {
      const p = parseInput(z.object({ name: sourceSchema.shape.name, baseUrl: sourceSchema.shape.baseUrl }), raw);
      await updateSource(client.id, id, p);
    } else await createSource(client.id, parseInput(sourceSchema, raw));
    revalidatePath("/admin", "layout");
    return { ok: true, message: id ? "Source saved." : "Source added." };
  });
}
