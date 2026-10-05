"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveCategoryAction } from "@/app/admin/actions/categories";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Alert, Field, btnGhostCls, inputCls } from "@/components/admin/ui";

export function CategoryForm({ id, initial, parents }: { id: string | null; initial: { name: string; slug: string; parentId: string; imageUrl: string; isVisible: boolean }; parents: { id: string; label: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState(saveCategoryAction.bind(null, id), null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => {
    if (!state) return;
    if (state.ok) router.push("/admin/categories");
    else if (state.authExpired) router.push("/admin/login");
  }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Alert kind="error">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}><input id="name" name="name" defaultValue={initial.name} required maxLength={100} className={inputCls} /></Field>
        <Field label="URL name (slug)" htmlFor="slug" error={fe.slug} hint="Used in category links. Leave empty to generate from the name."><input id="slug" name="slug" defaultValue={initial.slug} maxLength={100} className={inputCls} /></Field>
        <Field label="Parent category" htmlFor="parentId" error={fe.parentId} hint="Choose a parent to make this a subcategory.">
          <select id="parentId" name="parentId" defaultValue={initial.parentId} className={inputCls}><option value="">None (top level)</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </Field>
        <Field label="Image URL (optional)" htmlFor="imageUrl" error={fe.imageUrl}><input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVisible" defaultChecked={initial.isVisible} className="h-4 w-4" /> Visible in the catalog</label>
      <div className="flex gap-2"><SubmitButton>{id ? "Save category" : "Create category"}</SubmitButton><button type="button" className={btnGhostCls} onClick={() => router.push("/admin/categories")}>Cancel</button></div>
    </form>
  );
}
