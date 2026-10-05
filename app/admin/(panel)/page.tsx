import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageContext } from "@/lib/admin/context";
import { Alert, Badge, Card, PageHeader, btnCls, btnGhostCls, fmtDate, syncBadge } from "@/components/admin/ui";
import { listSourcesWithStatus } from "@/lib/admin/services/sources";

export default async function DashboardPage() {
  const { client } = await requirePageContext();
  const [total, active, out, noImage, categories, hiddenCats, runs, sources] = await Promise.all([
    db.product.count({ where: { clientId: client.id } }),
    db.product.count({ where: { clientId: client.id, isActive: true } }),
    db.product.count({ where: { clientId: client.id, stockStatus: "OUT_OF_STOCK" } }),
    db.product.count({ where: { clientId: client.id, thumbnailUrl: null } }),
    db.category.count({ where: { clientId: client.id } }),
    db.category.count({ where: { clientId: client.id, isVisible: false } }),
    db.syncRun.findMany({ where: { source: { clientId: client.id } }, orderBy: { startedAt: "desc" }, take: 5, include: { source: { select: { name: true, type: true } } } }),
    listSourcesWithStatus(client.id)
  ]);
  const stat = (label: string, value: number, href: string, tone = "") => (
    <Link href={href} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-400">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </Link>
  );
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview of ${client.name}`} actions={<><Link className={btnCls} href="/admin/products/new">Add product</Link><Link className={btnGhostCls} href="/admin/sync">Run sync</Link></>} />
      <div className="mb-5 space-y-2">
        {!client.whatsappNumber && <Alert kind="warn">No WhatsApp number is set, so customers cannot send enquiries. <Link className="underline" href="/admin/settings">Add it in Settings</Link>.</Alert>}
        {sources.filter((s) => !s.credentials.ok).map((s) => <Alert key={s.id} kind="info">{s.name}: missing {s.credentials.missing.join(", ")}. <Link className="underline" href="/admin/sources">Details</Link></Alert>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Products", total, "/admin/products")}
        {stat("Visible in catalog", active, "/admin/products?status=active")}
        {stat("Out of stock", out, "/admin/products?stock=OUT_OF_STOCK", out ? "text-red-700" : "")}
        {stat("Without image", noImage, "/admin/products", noImage ? "text-amber-700" : "")}
        {stat("Categories", categories, "/admin/categories")}
        {stat("Hidden categories", hiddenCats, "/admin/categories")}
        {stat("Sources", sources.length, "/admin/sources")}
        {stat("Active design", 1, "/admin/settings")}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Sources">
          {sources.length === 0 ? <p className="text-sm text-neutral-500">No sources yet. <Link className="underline" href="/admin/sources">Add Shopify or WooCommerce</Link>.</p> : (
            <ul className="divide-y divide-neutral-100">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div><div className="font-medium">{s.name} <Badge>{s.type === "SHOPIFY" ? "Shopify" : "WooCommerce"}</Badge></div><div className="text-xs text-neutral-500">{s.productCount} products · last success {fmtDate(s.lastSyncAt)}</div></div>
                  {syncBadge(s.lastSyncStatus)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent sync runs">
          {runs.length === 0 ? <p className="text-sm text-neutral-500">Nothing has been synchronised yet.</p> : (
            <ul className="divide-y divide-neutral-100">
              {runs.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{r.source.name}</span>{syncBadge(r.status)}</div>
                  <div className="text-xs text-neutral-500">{fmtDate(r.startedAt)} · {r.created} new, {r.updated} updated, {r.failed} failed</div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/sync" className="mt-3 inline-block text-sm underline">Full history</Link>
        </Card>
      </div>
    </>
  );
}
