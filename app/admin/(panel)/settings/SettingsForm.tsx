"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/app/admin/actions/settings";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Alert, Card, Field, inputCls } from "@/components/admin/ui";

export function SettingsForm({ initial, designs }: { initial: { name: string; whatsappNumber: string; activeDesign: string; domain: string }; designs: readonly { key: string; label: string; description: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState(saveSettingsAction, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => { if (state && !state.ok && state.authExpired) router.push("/admin/login"); }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Alert kind="error">{state.message}</Alert>}
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      <Card title="Catalog">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Catalog name" htmlFor="name" error={fe.name}><input id="name" name="name" defaultValue={initial.name} required maxLength={120} className={inputCls} /></Field>
          <Field label="WhatsApp number" htmlFor="whatsappNumber" error={fe.whatsappNumber} hint="With country code, digits only (e.g. 919876543210). Enquiries are sent to this number."><input id="whatsappNumber" name="whatsappNumber" inputMode="tel" defaultValue={initial.whatsappNumber} className={inputCls} /></Field>
          <Field label="Custom domain (optional)" htmlFor="domain" error={fe.domain} hint="e.g. catalog.example.com. Point a CNAME at your hosting first."><input id="domain" name="domain" defaultValue={initial.domain} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title="Active catalog design">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Active design</legend>
          {designs.map((d) => (
            <label key={d.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50">
              <input type="radio" name="activeDesign" value={d.key} defaultChecked={initial.activeDesign === d.key} className="mt-1" />
              <span><span className="block text-sm font-medium">{d.label}</span><span className="block text-xs text-neutral-500">{d.description}</span></span>
            </label>
          ))}
        </fieldset>
        {fe.activeDesign && <p className="mt-1 text-xs text-red-600">{fe.activeDesign}</p>}
      </Card>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
