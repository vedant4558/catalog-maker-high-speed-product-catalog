"use client";
import { useActionState } from "react";
import { loginAction } from "../actions/auth";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Alert, inputCls } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Admin password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className={inputCls} />
      </div>
      {state && !state.ok && <Alert kind="error">{state.message}</Alert>}
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
