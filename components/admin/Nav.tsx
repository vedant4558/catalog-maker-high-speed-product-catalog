"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions/auth";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/sources", label: "Sources / Imports" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/settings", label: "Settings" }
];

export function AdminNav({ clientName }: { clientName: string }) {
  const path = usePathname() ?? "";
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const links = (
    <>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
          className={`block rounded-md px-3 py-2 text-sm ${active(i.href) ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
          {i.label}
        </Link>
      ))}
      <form action={logoutAction}>
        <button type="submit" className="mt-2 block w-full rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100">Log out</button>
      </form>
    </>
  );
  return (
    <>
      {/* desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-3 md:block">
        <div className="mb-4 px-3 pt-1"><div className="text-xs uppercase tracking-wide text-neutral-400">Catalog Maker</div><div className="truncate text-sm font-semibold">{clientName}</div></div>
        <nav className="space-y-1">{links}</nav>
      </aside>
      {/* mobile: collapsible menu, no JS needed to open */}
      <header className="border-b border-neutral-200 bg-white md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">{clientName} · Admin</span>
            <span className="text-sm text-neutral-500 group-open:hidden">Menu ☰</span><span className="hidden text-sm text-neutral-500 group-open:inline">Close ✕</span>
          </summary>
          <nav className="space-y-1 px-3 pb-3">{links}</nav>
        </details>
      </header>
    </>
  );
}
