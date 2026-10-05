import { z } from "zod";
import { db } from "@/lib/db";
import { getClient } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handler, json } from "@/lib/api";
import { runSyncForClient } from "@/lib/sync/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const body = z.object({
  type: z.enum(["SHOPIFY", "WOOCOMMERCE", "ALL"]).default("ALL"),
  trigger: z.enum(["import", "manual"]).default("manual")
});

// One-click backend for "Import Shopify" / "Import WooCommerce" / "Run synchronization".
// Each source is synced independently: one failing source never blocks the other.
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  const client = await getClient();
  const b = body.parse(await req.json().catch(() => ({})));
  const sources = await db.source.findMany({
    where: { clientId: client.id, type: b.type === "ALL" ? { in: ["SHOPIFY", "WOOCOMMERCE"] } : b.type },
    select: { id: true, name: true, type: true }
  });
  if (!sources.length) throw new ApiError(404, "not_found", "No matching source is configured.");
  const results = [];
  for (const s of sources) {
    try {
      results.push({ sourceId: s.id, name: s.name, type: s.type, result: await runSyncForClient(client.id, s.id, { trigger: b.trigger }) });
    } catch (e) {
      results.push({ sourceId: s.id, name: s.name, type: s.type, error: e instanceof ApiError ? e.message : "Sync could not be started." });
    }
  }
  return json({ results }, "no-store");
});
