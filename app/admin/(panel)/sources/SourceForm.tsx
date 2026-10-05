"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSourceAction } from "@/app/admin/actions/sync";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Alert, Field, inputCls } from "@/components/admin/ui";

export function SourceForm({ id, type, initial }: { id: string | null; type?: "SHOPIFY" | "WOOCOMMERCE"; initial: { name: string; baseUrl: string } }) {
  const router = useRouter();
  const [state, action] = useActionState(saveSourceAction.bind(null, id), null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const isShopify = (type ?? "SHOPIFY") === "SHOPIFY";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
      {!id && (
        <div className="sm:col-span-3"><Field label="Platform" htmlFor="type"><select id="type" name="type" defaultValue="SHOPIFY" className={`${inputCls} max-w-xs`}><option value="SHOPIFY">Shopify</option><option value="WOOCOMMERCE">WooCommerce</option></select></Field></div>
      )}
      <Field label="Name" htmlFor={`name-${id ?? "new"}`} error={fe.name}><input id={`name-${id ?? "new"}`} name="name" defaultValue={initial.name} required maxLength={100} className={inputCls} /></Field>
      <Field label={isShopify || !id ? "Store address" : "Site address"} htmlFor={`url-${id ?? "new"}`} error={fe.baseUrl} hint={isShopify ? "Shopify: my-store.myshopify.com. WooCommerce: https://shop.example.com" : "https://shop.example.com"}>
        <input id={`url-${id ?? "new"}`} name="baseUrl" defaultValue={initial.baseUrl} required className={inputCls} />
      </Field>
      <SubmitButton>{id ? "Save" : "Add source"}</SubmitButton>
      {state && !state.ok && <div className="sm:col-span-3"><Alert kind="error">{state.message}</Alert></div>}
      {state?.ok && <div className="sm:col-span-3"><Alert kind="success">{state.message}</Alert></div>}
    </form>
  );
}
