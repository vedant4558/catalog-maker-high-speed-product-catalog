import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageContext } from "@/lib/admin/context";
import { listSourcesWithStatus } from "@/lib/admin/services/sources";
import { Badge, Card, PageHeader, Pagination, fmtDate, syncBadge } from "@/components/admin/ui";
import { RunSyncButton, SyncAllButton } from "@/components/admin/RunSyncButton";

export const maxDuration = 300;
const PAGE = 15;

const dur = (a: Date, b: Date | null) => { if (!b) return "…"; const s = Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

export default async function SyncPage({ searchParams }: { searchParams: Promise<{ source?: string; page?: string }> }) {
  const sp = await searchParams;
  const { client } = await requirePageContext();
  const page = Math.max(1, Number(sp.page) || 1);
  const sources = await listSourcesWithStatus(client.id);
  const where = { source: { clientId: client.id }, ...(sp.source ? { sourceId: sp.source } : {}) };
  const [total, runs] = await Promise.all([
    db.syncRun.count({ where }),
    db.syncRun.findMany({ where, orderBy: { startedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { source: { select: { name: true, type: true } }, errors: { take: 25, orderBy: { createdAt: "asc" }, select: { id: true, externalId: true, message: true } }, _count: { select: { errors: true } } } })
  ]);
  const href = (p: number) => `/admin/sync?${new URLSearchParams({ ...(sp.source ? { source: sp.source } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Sync" subtitle="Detects new, changed and unavailable products and updates the catalog. Failed runs never damage existing data." />
      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="mb-2 flex items-center justify-between gap-2"><div className="font-semibold">{s.name} <Badge tone="blue">{s.type === "SHOPIFY" ? "Shopify" : "WooCommerce"}</Badge></div>{syncBadge(s.lastSyncStatus)}</div>
            <div className="mb-3 text-sm text-neutral-600">{s.productCount} products · last successful sync: <strong>{fmtDate(s.lastSyncAt)}</strong></div>
            {!s.credentials.ok ? <p className="text-sm text-amber-800">Missing {s.credentials.missing.join(", ")}. <Link href="/admin/sources" className="underline">Fix on Sources</Link>.</p>
              : <RunSyncButton sourceId={s.id} mode="manual" label="Sync now" />}
          </Card>
        ))}
      </div>
      {sources.length > 1 && <div className="mt-4"><SyncAllButton sources={sources.filter((s) => s.credentials.ok).map((s) => ({ id: s.id, name: s.name }))} /></div>}

      <h2 className="mb-2 mt-8 text-sm font-semibold text-neutral-700">History</h2>
      <form method="get" className="mb-3 flex gap-2">
        <select name="source" defaultValue={sp.source ?? ""} aria-label="Source" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"><option value="">All sources</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50" type="submit">Filter</button>
      </form>
      {runs.length === 0 ? <Card><p className="text-sm text-neutral-600">No sync runs yet.</p></Card> : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">Started</th><th className="p-3">Duration</th><th className="p-3 text-right">Processed</th><th className="p-3 text-right">Created</th><th className="p-3 text-right">Updated</th><th className="p-3 text-right">Failed</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3"><div className="font-medium">{r.source.name}</div><div className="text-xs text-neutral-500">{r.trigger}</div></td>
                  <td className="p-3">{syncBadge(r.status)}</td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(r.startedAt)}</td>
                  <td className="p-3">{dur(r.startedAt, r.finishedAt)}</td>
                  <td className="p-3 text-right tabular-nums">{r.created + r.updated + r.unchanged + r.failed}</td>
                  <td className="p-3 text-right tabular-nums">{r.created}</td>
                  <td className="p-3 text-right tabular-nums">{r.updated}</td>
                  <td className="p-3 text-right tabular-nums">{r.failed}</td>
                </tr>
              )).flatMap((row, i) => {
                const r = runs[i];
                const extra = (
                  <tr key={`${r.id}-d`}><td colSpan={8} className="bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    {r.message ?? "—"}
                    {r._count.errors > 0 && (
                      <details className="mt-1"><summary className="cursor-pointer text-red-700">{r._count.errors} error{r._count.errors === 1 ? "" : "s"}</summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.errors.map((e) => <li key={e.id}>{e.externalId ? <code>{e.externalId}</code> : "Run"}: {e.message}</li>)}{r._count.errors > r.errors.length && <li>…and {r._count.errors - r.errors.length} more</li>}</ul>
                      </details>
                    )}
                  </td></tr>
                );
                return [row, extra];
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={href} />
    </>
  );
}
