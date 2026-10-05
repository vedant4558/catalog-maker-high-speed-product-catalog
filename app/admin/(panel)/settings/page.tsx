import { requirePageContext } from "@/lib/admin/context";
import { DESIGNS } from "@/lib/designs";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { client } = await requirePageContext();
  // Presence only: values of secrets are never read into the page.
  const env = [
    ["Admin password", !!process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD"],
    ["Scheduled sync secret", !!process.env.CRON_SECRET, "CRON_SECRET"],
    ["Shopify access token (optional)", !!process.env.SHOPIFY_ACCESS_TOKEN, "SHOPIFY_ACCESS_TOKEN"],
    ["WooCommerce keys", !!process.env.WOOCOMMERCE_CONSUMER_KEY && !!process.env.WOOCOMMERCE_CONSUMER_SECRET, "WOOCOMMERCE_CONSUMER_KEY / _SECRET"]
  ] as const;
  return (
    <>
      <PageHeader title="Settings" subtitle="Catalog configuration stored in the database." />
      <SettingsForm designs={DESIGNS} initial={{ name: client.name, whatsappNumber: client.whatsappNumber ?? "", activeDesign: client.activeDesign, domain: client.domain ?? "" }} />
      <Card title="Server configuration (read-only)" className="mt-6">
        <p className="mb-3 text-sm text-neutral-600">Secrets live in server environment variables and are never displayed or editable here. Currency: <strong>{client.currency}</strong>. Client ID: <code className="text-xs">{client.slug}</code>.</p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">{env.map(([label, ok, name]) => <li key={name} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"><span>{label}<span className="block text-xs text-neutral-400">{name}</span></span>{ok ? <Badge tone="green">Set</Badge> : <Badge tone="gray">Not set</Badge>}</li>)}</ul>
        <p className="mt-3 text-xs text-neutral-500">To change the admin password, update ADMIN_PASSWORD in your hosting environment and redeploy. All signed-in sessions end automatically.</p>
      </Card>
    </>
  );
}
