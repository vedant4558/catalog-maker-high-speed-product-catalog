import { requirePageContext } from "@/lib/admin/context";
import { listSourcesWithStatus } from "@/lib/admin/services/sources";
import { Alert, Badge, Card, PageHeader, fmtDate, syncBadge } from "@/components/admin/ui";
import { RunSyncButton } from "@/components/admin/RunSyncButton";
import { SourceForm } from "./SourceForm";

export const maxDuration = 300; // imports run inside this request (server action)

export default async function SourcesPage() {
  const { client } = await requirePageContext();
  const sources = await listSourcesWithStatus(client.id);
  return (
    <>
      <PageHeader title="Sources / Imports" subtitle="Connect Shopify and WooCommerce, then import. Later runs are synchronisations (see Sync)." />
      <div className="mb-4"><Alert kind="info">Secrets (Shopify access token, WooCommerce keys) are never shown or stored here: they are read from server environment variables. This page only shows whether they are present.</Alert></div>
      <div className="space-y-4">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><h2 className="font-semibold">{s.name}</h2><Badge tone="blue">{s.type === "SHOPIFY" ? "Shopify" : "WooCommerce"}</Badge></div>
              {syncBadge(s.lastSyncStatus)}
            </div>
            <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-neutral-500">Products imported</dt><dd>{s.productCount}</dd></div>
              <div><dt className="text-xs text-neutral-500">Last successful sync</dt><dd>{fmtDate(s.lastSyncAt)}</dd></div>
              <div><dt className="text-xs text-neutral-500">Credentials</dt><dd>{s.credentials.ok ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Missing: {s.credentials.missing.join(", ")}</Badge>}</dd></div>
            </dl>
            {!s.credentials.ok && <div className="mb-3"><Alert kind="warn">{s.credentials.hint}</Alert></div>}
            {s.lastRun && s.lastRun.status !== "SUCCESS" && s.lastRun.message && <div className="mb-3"><Alert kind={s.lastRun.status === "FAILED" ? "error" : "warn"}>Last run: {s.lastRun.message}</Alert></div>}
            <SourceForm id={s.id} type={s.type as "SHOPIFY" | "WOOCOMMERCE"} initial={{ name: s.name, baseUrl: s.baseUrl ?? "" }} />
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <RunSyncButton sourceId={s.id} mode="import" label={s.productCount === 0 ? `Import ${s.type === "SHOPIFY" ? "Shopify" : "WooCommerce"} products` : "Re-import products"} disabledReason={s.credentials.ok ? undefined : "Add the missing credentials first"} />
              <p className="mt-2 text-xs text-neutral-500">Importing never creates duplicates and never deletes anything. If the store is unreachable, your existing catalog is left untouched.</p>
            </div>
          </Card>
        ))}
        <Card title="Add a source"><SourceForm id={null} initial={{ name: "", baseUrl: "" }} /></Card>
      </div>
    </>
  );
}
