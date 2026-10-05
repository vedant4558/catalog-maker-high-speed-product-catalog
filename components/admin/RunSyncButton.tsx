"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runSyncAction, type SyncOutcome } from "@/app/admin/actions/sync";
import { Alert, btnCls, btnGhostCls } from "./ui";

type Result = { ok: boolean; message: string; data?: SyncOutcome } | null;

/** Starts an import/sync through the Part 2 engine. Shows a progress message while running and a readable outcome after. */
export function RunSyncButton({ sourceId, mode, label, secondary = false, disabledReason }: { sourceId: string; mode: "import" | "manual"; label: string; secondary?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending || !!disabledReason} title={disabledReason} className={secondary ? btnGhostCls : btnCls}
        onClick={() => {
          setResult(null);
          start(async () => {
            const r = await runSyncAction(sourceId, mode);
            setResult({ ok: r.ok, message: r.message ?? (r.ok ? "Done." : "Failed."), data: r.ok ? r.data : undefined });
            if (!r.ok && r.authExpired) router.push("/admin/login");
            router.refresh();
          });
        }}>
        {pending ? (mode === "import" ? "Importing… this can take a minute" : "Syncing… this can take a minute") : label}
      </button>
      {result && <Alert kind={result.ok ? "success" : "error"}>{result.message}</Alert>}
    </div>
  );
}

/** Runs the sync for several sources one after another (one failing source never stops the others). */
export function SyncAllButton({ sources }: { sources: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<{ name: string; ok: boolean; message: string }[]>([]);
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending || sources.length === 0} className={btnCls}
        onClick={() => {
          setLines([]);
          start(async () => {
            const out: typeof lines = [];
            for (const s of sources) {
              const r = await runSyncAction(s.id, "manual");
              out.push({ name: s.name, ok: r.ok, message: r.message ?? (r.ok ? "Done." : "Failed.") });
              setLines([...out]);
            }
            router.refresh();
          });
        }}>
        {pending ? "Syncing all sources…" : "Sync all sources"}
      </button>
      {lines.map((l) => <Alert key={l.name} kind={l.ok ? "success" : "error"}><strong>{l.name}:</strong> {l.message}</Alert>)}
    </div>
  );
}
