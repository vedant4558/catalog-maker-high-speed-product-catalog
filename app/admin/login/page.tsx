import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Catalog Maker</h1>
        <p className="mb-5 text-sm text-neutral-500">Sign in to manage your catalog.</p>
        <LoginForm />
      </div>
    </main>
  );
}
