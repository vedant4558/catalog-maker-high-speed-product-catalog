import { requireCron } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { syncAllSources } from "@/lib/sync/engine";
import { invalidateCatalog } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Scheduled synchronization (bonus). Triggered by Vercel Cron, see vercel.json.
export const GET = handler(async (req: Request) => {
  requireCron(req);
  const results = await syncAllSources("schedule");
  invalidateCatalog();
  return json({ results }, "no-store");
});
