"use client";
import { useFormStatus } from "react-dom";
import { btnCls } from "./ui";

export function SubmitButton({ children, pendingText = "Saving…", className = btnCls }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? pendingText : children}</button>;
}
