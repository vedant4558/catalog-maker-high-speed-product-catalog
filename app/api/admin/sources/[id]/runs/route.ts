import { db } from "@/lib/db";
import { getClient } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

// Sync history with per-product errors (for the admin "sync status/history" view).
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const client = await getClient();
  if (!(await db.source.findFirst({ where: { id, clientId: client.id }, select: { id: true } }))) throw new ApiError(404, "not_found", "Source not found.");
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 100);
  const runs = await db.syncRun.findMany({
    where: { sourceId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { errors: { take: 50, orderBy: { createdAt: "asc" }, select: { externalId: true, message: true, createdAt: true } } }
  });
  return json({ runs }, "no-store");
});
