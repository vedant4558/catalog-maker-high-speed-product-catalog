"use client";
import { useState } from "react";
import { deleteCategoryAction } from "@/app/admin/actions/categories";
import { ActionButton } from "@/components/admin/ActionButton";
import { btnDangerCls, inputCls } from "@/components/admin/ui";

export function DeleteCategory({ id, name, options }: { id: string; name: string; options: { id: string; label: string }[] }) {
  const [target, setTarget] = useState("");
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="moveTo">Move its products and subcategories to</label>
      <select id="moveTo" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} max-w-sm`}>
        <option value="">Nowhere: products become uncategorised, subcategories move up a level</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ActionButton action={deleteCategoryAction.bind(null, id, target || null)} label="Delete category" pendingLabel="Deleting…" className={btnDangerCls} confirmText={`Delete the category “${name}”? Products are kept and moved as selected.`} redirectTo="/admin/categories" />
    </div>
  );
}
