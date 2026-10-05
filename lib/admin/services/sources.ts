import { db } from "../../db";
import { credentialStatus } from "../../sync/adapters";
import { ValidationError } from "../results";

export async function listSourcesWithStatus(clientId: string) {
  const sources = await db.source.findMany({
    where: { clientId }, orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } }, syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } }
  });
  return sources.map((s) => ({
    id: s.id, type: s.type, name: s.name, baseUrl: s.baseUrl, productCount: s._count.products,
    lastSyncAt: s.lastSyncAt, lastSyncStatus: s.lastSyncStatus, lastRun: s.syncRuns[0] ?? null,
    credentials: credentialStatus(s) // names of missing items only, never values
  }));
}

export async function createSource(clientId: string, input: { type: "SHOPIFY" | "WOOCOMMERCE"; name: string; baseUrl: string }) {
  const baseUrl = normalizeAddress(input.type, input.baseUrl);
  return db.source.create({ data: { clientId, type: input.type, name: input.name, baseUrl, credentials: {} }, select: { id: true } });
}

export async function updateSource(clientId: string, id: string, input: { name: string; baseUrl: string }) {
  const s = await db.source.findFirst({ where: { id, clientId } });
  if (!s) throw new ValidationError({}, "That source no longer exists.");
  const baseUrl = normalizeAddress(s.type, input.baseUrl);
  // Credentials stored through the Part 2 API may also carry the address; keep them in step, leave secrets untouched.
  const c = { ...((s.credentials ?? {}) as Record<string, string>) };
  if (s.type === "SHOPIFY" && "shopDomain" in c) c.shopDomain = baseUrl;
  if (s.type === "WOOCOMMERCE" && "siteUrl" in c) c.siteUrl = baseUrl;
  await db.source.update({ where: { id }, data: { name: input.name, baseUrl, credentials: c } });
}

function normalizeAddress(type: "SHOPIFY" | "WOOCOMMERCE" | string, raw: string): string {
  const v = raw.trim().replace(/\/+$/, "");
  if (type === "SHOPIFY") {
    const host = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) throw new ValidationError({ baseUrl: "Enter the store domain, e.g. my-store.myshopify.com" });
    return host.toLowerCase();
  }
  try {
    const u = new URL(/^https?:\/\//.test(v) ? v : `https://${v}`);
    return u.origin + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    throw new ValidationError({ baseUrl: "Enter the WordPress site address, e.g. https://shop.example.com" });
  }
}
