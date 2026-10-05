import { z } from "zod";
import { db } from "@/lib/db";
import { getClient } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  baseUrl: z.string().trim().max(300).optional(),
  credentials: z.record(z.string().max(500)).optional() // merged; blank values keep the stored secret
});

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const client = await getClient();
  const b = patchBody.parse(await req.json().catch(() => ({})));
  const s = await db.source.findFirst({ where: { id, clientId: client.id } });
  if (!s) throw new ApiError(404, "not_found", "Source not found.");
  const incoming = Object.fromEntries(Object.entries(b.credentials ?? {}).filter(([, v]) => v.trim() && !v.startsWith("••••")));
  await db.source.update({
    where: { id },
    data: { name: b.name, baseUrl: b.baseUrl, ...(b.credentials ? { credentials: { ...((s.credentials as object) ?? {}), ...incoming } } : {}) }
  });
  return json({ ok: true }, "no-store");
});
