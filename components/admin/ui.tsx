import Link from "next/link";
import type { ReactNode } from "react";

export const inputCls = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100";
export const btnCls = "inline-flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhostCls = "inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60";
export const btnDangerCls = "inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>}
      {children}
    </section>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "success" | "error" | "warn"; children: ReactNode }) {
  const c = { info: "border-sky-200 bg-sky-50 text-sky-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900", error: "border-red-200 bg-red-50 text-red-900", warn: "border-amber-200 bg-amber-50 text-amber-900" }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", gray: "bg-neutral-100 text-neutral-700", blue: "bg-sky-100 text-sky-800"
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}
export const stockBadge = (s: string) => s === "IN_STOCK" ? <Badge tone="green">In stock</Badge> : s === "OUT_OF_STOCK" ? <Badge tone="red">Out of stock</Badge> : <Badge tone="amber">Backorder</Badge>;
export const syncBadge = (s?: string | null) => !s ? <Badge>Never synced</Badge> : s === "SUCCESS" ? <Badge tone="green">Success</Badge> : s === "PARTIAL" ? <Badge tone="amber">Partial</Badge> : s === "RUNNING" ? <Badge tone="blue">Running</Badge> : <Badge tone="red">Failed</Badge>;

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? <Link className={btnGhostCls} href={hrefFor(page - 1)}>← Previous</Link> : <span />}
      <span className="text-neutral-500">Page {page} of {pages}</span>
      {page < pages ? <Link className={btnGhostCls} href={hrefFor(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}

export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—");
export const fmtMoney = (n: unknown, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n));
