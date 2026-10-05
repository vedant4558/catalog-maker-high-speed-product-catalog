import { Prisma, type SourceType, type SyncStatus } from "@prisma/client";
import { db } from "../db";
import { createAdapter } from "./adapters";
import { sha256, slugify, stableStringify } from "./text";
import type { NormalizedCategory, NormalizedProduct, SourceAdapter } from "./types";

/**
 * Sync engine. Guarantees:
 *  - The external catalog is fetched COMPLETELY before anything is written. A source outage,
 *    bad credentials or a half-finished pagination changes nothing and is recorded as FAILED.
 *  - Each product is written in its own transaction, so one bad product cannot corrupt others
 *    or leave a product half-updated (e.g. new price but old images).
 *  - Products are identified by (sourceId, externalId): re-running never creates duplicates.
 *  - Unchanged products (same content hash) are not rewritten.
 *  - Fields an admin edited by hand (Product.manualOverrides) are never overwritten.
 *  - Products that vanished from a *successful, non-empty* fetch are hidden (isActive=false),
 *    never deleted, and come back automatically if the source lists them again.
 */

const BATCH = 10;
const STALE_RUN_MS = 15 * 60 * 1000;
const MAX_ERRORS_STORED = 200;

export class SyncBusyError extends Error {
  constructor() {
    super("A synchronization is already running for this source.");
  }
}
export class SyncNotFoundError extends Error {
  constructor() {
    super("Source not found.");
  }
}

export interface SyncOptions {
  trigger?: "manual" | "import" | "schedule";
  /** Test seam / custom sources. Defaults to the adapter built from the Source row. */
  adapter?: SourceAdapter;
}

export interface SyncSummary {
  runId: string;
  status: SyncStatus;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  deactivated: number;
  changes: Record<string, number>;
  message: string;
}

type Overrides = Record<string, boolean>;
type Err = { externalId?: string; message: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

export function contentHash(p: NormalizedProduct): string {
  // sourceUpdatedAt is excluded: a "touch" at the source with no real change must not trigger a rewrite.
  return sha256(stableStringify({ ...p, sourceUpdatedAt: undefined }));
}

interface ExistingForDiff {
  name: string;
  sku: string | null;
  description: string | null;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  stockStatus: string;
  stockQty: number | null;
  images: { url: string }[];
  variants: { externalId: string | null; title: string; price: Prisma.Decimal | null; stockStatus: string }[];
}

/** Human-meaningful list of what changed, for sync history and stats. */
export function diffFields(ex: ExistingForDiff, p: NormalizedProduct): string[] {
  const out: string[] = [];
  if (Number(ex.price) !== p.price || Number(ex.compareAtPrice ?? 0) !== Number(p.compareAtPrice ?? 0)) out.push("price");
  if ((ex.description ?? null) !== (p.description ?? null)) out.push("description");
  if (ex.stockStatus !== p.stockStatus || (ex.stockQty ?? null) !== (p.stockQty ?? null)) out.push("stock");
  if (stableStringify(ex.images.map((i) => i.url)) !== stableStringify(p.images.map((i) => i.url))) out.push("images");
  const norm = (vs: { externalId?: string | null; title: string; price?: unknown; stockStatus: string }[]) =>
    stableStringify(vs.map((v) => [v.externalId, v.title, v.price == null ? null : Number(v.price), v.stockStatus]).sort());
  if (norm(ex.variants) !== norm(p.variants)) out.push("variants");
  if (ex.name !== p.name || (ex.sku ?? null) !== (p.sku ?? null)) out.push("details");
  return out;
}

async function failRun(runId: string, sourceId: string, errors: Err[], message: string): Promise<SyncSummary> {
  await db.$transaction([
    ...(errors.length ? [db.syncError.createMany({ data: errors.slice(0, MAX_ERRORS_STORED).map((e) => ({ runId, externalId: e.externalId, message: e.message })) })] : []),
    db.syncRun.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), message } }),
    // lastSyncAt intentionally untouched: it records the last *successful* sync.
    db.source.update({ where: { id: sourceId }, data: { lastSyncStatus: "FAILED" } })
  ]);
  return { runId, status: "FAILED", created: 0, updated: 0, unchanged: 0, failed: 0, deactivated: 0, changes: {}, message };
}

async function upsertCategories(clientId: string, sourceType: SourceType, products: NormalizedProduct[]): Promise<Map<string, string>> {
  const wanted = new Map<string, NormalizedCategory>();
  for (const p of products) for (const c of p.categories) if (!wanted.has(c.externalId)) wanted.set(c.externalId, c);

  const existing = await db.category.findMany({ where: { clientId } });
  const bySource = new Map(existing.filter((c) => c.sourceType === sourceType && c.externalId).map((c) => [c.externalId as string, c]));
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  let nextOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;

  const idMap = new Map<string, string>();
  const pending = [...wanted.values()];
  // Parents first; bounded passes handle any depth and survive cycles in bad data.
  for (let pass = 0; pass < 8 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const c = pending[i];
      if (c.parentExternalId && wanted.has(c.parentExternalId) && !idMap.has(c.parentExternalId) && pass < 7) continue;
      const found = bySource.get(c.externalId) ?? bySlug.get(c.slug);
      if (found) {
        idMap.set(c.externalId, found.id); // existing admin settings (name, order, visibility) are never overwritten
      } else {
        const created = await db.category.create({
          data: {
            clientId,
            name: c.name,
            slug: c.slug || slugify(c.name),
            externalId: c.externalId,
            sourceType,
            parentId: c.parentExternalId ? idMap.get(c.parentExternalId) ?? null : null,
            sortOrder: nextOrder++
          }
        });
        idMap.set(c.externalId, created.id);
        bySlug.set(created.slug, created);
      }
      pending.splice(i, 1);
    }
  }
  return idMap;
}

export async function syncSource(sourceId: string, opts: SyncOptions = {}): Promise<SyncSummary> {
  const source = await db.source.findUnique({ where: { id: sourceId }, include: { client: true } });
  if (!source) throw new SyncNotFoundError();

  // One run at a time per source. Runs stuck for >15 min (crashed / timed out) are closed first.
  await db.syncRun.updateMany({
    where: { sourceId, status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", finishedAt: new Date(), message: "Run did not finish (timed out or crashed)." }
  });
  if (await db.syncRun.findFirst({ where: { sourceId, status: "RUNNING" }, select: { id: true } })) throw new SyncBusyError();

  const run = await db.syncRun.create({ data: { sourceId, trigger: opts.trigger ?? "manual" } });

  // ---- 1. Fetch everything. Nothing is written if this fails. ----------------------------
  let fetched;
  try {
    fetched = await (opts.adapter ?? createAdapter(source)).fetchAll();
  } catch (e) {
    return failRun(run.id, sourceId, [{ message: errMsg(e) }], `Source unavailable. Existing catalog left untouched. ${errMsg(e)}`);
  }

  const existingCount = await db.product.count({ where: { sourceId } });
  if (fetched.products.length === 0 && existingCount > 0) {
    // An empty answer for a catalog we previously had is almost always an outage / wrong scope, not "deleted everything".
    return failRun(run.id, sourceId, fetched.skipped.map((s) => ({ externalId: s.externalId, message: s.message })), "Source returned 0 products; refusing to apply. Existing catalog left untouched.");
  }

  const errors: Err[] = fetched.skipped.map((s) => ({ externalId: s.externalId, message: s.message }));
  let created = 0, updated = 0, unchanged = 0, failed = errors.length, deactivated = 0;
  const changes: Record<string, number> = {};

  try {
    // ---- 2. Categories ------------------------------------------------------------------
    const catIds = await upsertCategories(source.clientId, source.type, fetched.products);

    // ---- 3. Classify products -----------------------------------------------------------
    const existing = await db.product.findMany({
      where: { sourceId },
      select: { id: true, externalId: true, slug: true, contentHash: true, isActive: true, manualOverrides: true }
    });
    const byExt = new Map(existing.map((p) => [p.externalId as string, p]));
    const takenSlugs = new Set((await db.product.findMany({ where: { clientId: source.clientId }, select: { slug: true } })).map((p) => p.slug));

    const seen = new Set<string>(fetched.skipped.flatMap((s) => (s.externalId ? [s.externalId] : [])));
    const unchangedIds: string[] = [];
    const work: { p: NormalizedProduct; hash: string; ex?: (typeof existing)[number]; slug: string }[] = [];

    for (const p of fetched.products) {
      seen.add(p.externalId);
      const hash = contentHash(p);
      const ex = byExt.get(p.externalId);
      if (ex && ex.contentHash === hash && ex.isActive) {
        unchangedIds.push(ex.id);
        continue;
      }
      let slug = ex?.slug ?? slugify(p.name);
      if (!ex) {
        if (takenSlugs.has(slug)) slug = `${slug}-${slugify(p.externalId)}`;
        for (let n = 2; takenSlugs.has(slug); n++) slug = `${slugify(p.name)}-${slugify(p.externalId)}-${n}`;
        takenSlugs.add(slug);
      }
      work.push({ p, hash, ex, slug });
    }
    unchanged = unchangedIds.length;

    // Fine-grained change detection (price / description / images / stock / variants) for rows that changed.
    const changedIds = work.flatMap((w) => (w.ex ? [w.ex.id] : []));
    const full = changedIds.length
      ? await db.product.findMany({
          where: { id: { in: changedIds } },
          include: { images: { select: { url: true }, orderBy: { position: "asc" } }, variants: { select: { externalId: true, title: true, price: true, stockStatus: true } } }
        })
      : [];
    const fullById = new Map(full.map((f) => [f.id, f]));

    // ---- 4. Write, one transaction per product -------------------------------------------
    const now = new Date();
    const writeOne = async (w: (typeof work)[number]) => {
      const { p, hash, ex, slug } = w;
      const ov = (ex?.manualOverrides ?? {}) as Overrides;
      const keep = <T>(field: string, v: T): T | undefined => (ov[field] ? undefined : v);
      const categoryId = p.categories[0] ? catIds.get(p.categories[0].externalId) ?? null : null;
      const images = p.images.map((i, position) => ({ url: i.url, alt: i.alt ?? p.name, width: i.width ?? null, height: i.height ?? null, position }));
      const variants = p.variants.map((v, position) => ({
        externalId: v.externalId, sku: v.sku ?? null, title: v.title, price: v.price ?? null, stockStatus: v.stockStatus,
        options: v.options ? (v.options as Prisma.InputJsonValue) : Prisma.JsonNull, position
      }));
      const data = {
        name: keep("name", p.name),
        sku: keep("sku", p.sku ?? null),
        description: keep("description", p.description ?? null),
        price: keep("price", p.price),
        compareAtPrice: keep("compareAtPrice", p.compareAtPrice ?? null),
        currency: source.client.currency,
        stockStatus: keep("stockStatus", p.stockStatus),
        stockQty: keep("stockQty", p.stockQty ?? null),
        sourceUrl: p.sourceUrl ?? null,
        categoryId: keep("category", categoryId),
        thumbnailUrl: keep("images", images[0]?.url ?? null), // null => designs show a placeholder
        metadata: keep("metadata", p.metadata ? (p.metadata as Prisma.InputJsonValue) : Prisma.JsonNull),
        sourceUpdatedAt: p.sourceUpdatedAt ? new Date(p.sourceUpdatedAt) : null,
        lastSyncedAt: now,
        contentHash: hash,
        isActive: keep("isActive", true)
      };
      if (!ex) {
        await db.product.create({ data: { ...data, name: p.name, price: p.price, clientId: source.clientId, sourceId, externalId: p.externalId, slug, images: { create: images }, variants: { create: variants } } });
        return { kind: "created" as const, fields: [] as string[] };
      }
      const fields = fullById.has(ex.id) ? diffFields(fullById.get(ex.id) as ExistingForDiff, p) : [];
      await db.$transaction([
        db.product.update({ where: { id: ex.id }, data }),
        ...(ov.images ? [] : [db.productImage.deleteMany({ where: { productId: ex.id } }), db.productImage.createMany({ data: images.map((i) => ({ ...i, productId: ex.id })) })]),
        ...(ov.variants ? [] : [db.variant.deleteMany({ where: { productId: ex.id } }), db.variant.createMany({ data: variants.map((v) => ({ ...v, productId: ex.id })) })])
      ]);
      return { kind: "updated" as const, fields };
    };

    for (let i = 0; i < work.length; i += BATCH) {
      const slice = work.slice(i, i + BATCH);
      const results = await Promise.allSettled(slice.map(writeOne));
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          if (r.value.kind === "created") created++;
          else {
            updated++;
            for (const f of r.value.fields) changes[f] = (changes[f] ?? 0) + 1;
          }
        } else {
          failed++;
          errors.push({ externalId: slice[idx].p.externalId, message: errMsg(r.reason) }); // old data for this product is untouched (transaction rolled back)
        }
      });
    }

    if (unchangedIds.length) await db.product.updateMany({ where: { id: { in: unchangedIds } }, data: { lastSyncedAt: now } });

    // ---- 5. Hide products removed at the source (never delete) ----------------------------
    const gone = existing.filter((p) => p.isActive && !seen.has(p.externalId as string)).map((p) => p.id);
    if (gone.length) {
      await db.product.updateMany({ where: { id: { in: gone } }, data: { isActive: false } });
      deactivated = gone.length;
    }
  } catch (e) {
    // Unexpected failure mid-apply (e.g. database down). Completed products stay; nothing is half-written.
    errors.push({ message: errMsg(e) });
    return finish(run.id, sourceId, "FAILED", { created, updated, unchanged, failed: failed + 1, deactivated, changes }, errors, `Sync aborted: ${errMsg(e)}`);
  }

  const status: SyncStatus = failed > 0 ? (created + updated + unchanged === 0 ? "FAILED" : "PARTIAL") : "SUCCESS";
  const changeText = Object.entries(changes).map(([k, v]) => `${k}:${v}`).join(", ");
  const message = `${created} new, ${updated} updated${changeText ? ` (${changeText})` : ""}, ${unchanged} unchanged, ${deactivated} hidden, ${failed} failed.`;
  return finish(run.id, sourceId, status, { created, updated, unchanged, failed, deactivated, changes }, errors, message);
}

async function finish(runId: string, sourceId: string, status: SyncStatus, c: Omit<SyncSummary, "runId" | "status" | "message">, errors: Err[], message: string): Promise<SyncSummary> {
  await db.$transaction([
    ...(errors.length ? [db.syncError.createMany({ data: errors.slice(0, MAX_ERRORS_STORED).map((e) => ({ runId, externalId: e.externalId, message: e.message })) })] : []),
    db.syncRun.update({ where: { id: runId }, data: { status, finishedAt: new Date(), created: c.created, updated: c.updated, unchanged: c.unchanged, failed: c.failed, message } }),
    db.source.update({ where: { id: sourceId }, data: { lastSyncStatus: status, ...(status === "FAILED" ? {} : { lastSyncAt: new Date() }) } })
  ]);
  return { runId, status, ...c, message };
}

/** Used by the scheduled job: every syncable source, one after another, failures isolated. */
export async function syncAllSources(trigger: SyncOptions["trigger"] = "schedule") {
  const sources = await db.source.findMany({ where: { type: { in: ["SHOPIFY", "WOOCOMMERCE"] } }, select: { id: true, name: true } });
  const out: { sourceId: string; name: string; result?: SyncSummary; error?: string }[] = [];
  for (const s of sources) {
    try {
      out.push({ sourceId: s.id, name: s.name, result: await syncSource(s.id, { trigger }) });
    } catch (e) {
      out.push({ sourceId: s.id, name: s.name, error: errMsg(e) });
    }
  }
  return out;
}
