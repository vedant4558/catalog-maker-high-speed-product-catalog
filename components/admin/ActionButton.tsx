"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/results";
import { btnGhostCls } from "./ui";

/** Runs a (bound) server action from a button, with optional confirm, loading text, error display and refresh/redirect. */
export function ActionButton({ action, label, pendingLabel = "Working…", confirmText, className = btnGhostCls, redirectTo, title }: {
  action: () => Promise<ActionResult<any>>; label: React.ReactNode; pendingLabel?: string; confirmText?: string; className?: string; redirectTo?: string; title?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button type="button" title={title} disabled={pending} className={className}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) { setError(r.message); if (r.authExpired) router.push("/admin/login"); return; }
            if (redirectTo) router.push(redirectTo); else router.refresh();
          });
        }}>
        {pending ? pendingLabel : label}
      </button>
      {error && <span role="alert" className="mt-1 max-w-xs text-xs text-red-600">{error}</span>}
    </span>
  );
}
