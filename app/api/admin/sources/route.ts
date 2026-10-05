import { z } from "zod";
import { db } from "@/lib/db";
import { getClient } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { maskCredentials } from "@/lib/sync/run";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const client = await getClient();
  const sources = await db.source.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } }, syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } }
  });
  return json({
    sources: sources.map((s) => ({
      id: s.id, type: s.type, name: s.name, baseUrl: s.baseUrl,
      credentials: maskCredentials(s.credentials), // secrets never leave the server
      productCount: s._count.products, lastSyncAt: s.lastSyncAt, lastSyncStatus: s.lastSyncStatus, lastRun: s.syncRuns[0] ?? null
    }))
  }, "no-store");
});

const createBody = z.object({
  type: z.enum(["SHOPIFY", "WOOCOMMERCE"]),
  name: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().max(300).optional(),
  credentials: z.record(z.string().max(500)).optional()
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  const client = await getClient();
  const b = createBody.parse(await req.json().catch(() => ({})));
  const source = await db.source.create({ data: { clientId: client.id, type: b.type, name: b.name, baseUrl: b.baseUrl, credentials: b.credentials ?? {} } });
  return json({ source: { id: source.id, type: source.type, name: source.name } }, "no-store", 201);
});
