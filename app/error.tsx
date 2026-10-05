"use client";
import { Friendly } from "@/components/shop/States";
// Customers never see raw server errors: only this friendly message and a retry.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <Friendly title="Something went wrong" text="We couldn’t load this page. Please try again in a moment." action={<button onClick={reset} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Try again</button>} />;
}
