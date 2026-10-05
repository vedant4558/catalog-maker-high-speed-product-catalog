import { z } from "zod";
import { getClient } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { runSyncForClient } from "@/lib/sync/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // large catalogs; Vercel Pro limit

const body = z.object({ trigger: z.enum(["import", "manual"]).default("manual") });

// POST /api/admin/sources/:id/sync   {"trigger":"import"|"manual"}
// The first run of a source is the import; later runs are synchronisations (same engine).
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const client = await getClient();
  const b = body.parse(await req.json().catch(() => ({})));
  const summary = await runSyncForClient(client.id, id, { trigger: b.trigger });
  return json({ result: summary }, "no-store");
});
