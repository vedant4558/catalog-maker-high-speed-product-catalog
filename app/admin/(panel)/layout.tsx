import { AdminNav } from "@/components/admin/Nav";
import { Alert, Card } from "@/components/admin/ui";
import { getPageContextSafe } from "@/lib/admin/context";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPageContextSafe(); // redirects to /admin/login when not signed in
  if (!ctx) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card title="Setup needed">
          <Alert kind="warn">No catalog (client) exists yet. Run <code>npm run db:seed</code> once, or insert a Client row whose slug matches DEFAULT_CLIENT_SLUG.</Alert>
        </Card>
      </main>
    );
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminNav clientName={ctx.client.name} />
      <main className="min-w-0 flex-1 p-4 md:p-6"><div className="mx-auto max-w-6xl">{children}</div></main>
    </div>
  );
}
