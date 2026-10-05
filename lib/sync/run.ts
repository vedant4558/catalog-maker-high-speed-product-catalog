import { ApiError } from "../api";
import { SyncBusyError, SyncNotFoundError, syncSource, type SyncOptions } from "./engine";
import { db } from "../db";
import { invalidateCatalog } from "../cache";

/** API-facing wrapper: translates engine errors into HTTP errors and enforces client ownership. */
export async function runSyncForClient(clientId: string, sourceId: string, opts: SyncOptions) {
  const owned = await db.source.findFirst({ where: { id: sourceId, clientId }, select: { id: true } });
  if (!owned) throw new ApiError(404, "not_found", "Source not found.");
  try {
    const r = await syncSource(sourceId, opts);
    invalidateCatalog();
    return r;
  } catch (e) {
    if (e instanceof SyncBusyError) throw new ApiError(409, "sync_running", e.message);
    if (e instanceof SyncNotFoundError) throw new ApiError(404, "not_found", e.message);
    throw e;
  }
}

export function maskCredentials(c: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((c ?? {}) as Record<string, unknown>)) {
    if (typeof v !== "string" || !v) continue;
    out[k] = /key|secret|token|password/i.test(k) ? `••••${v.slice(-4)}` : v;
  }
  return out;
}
