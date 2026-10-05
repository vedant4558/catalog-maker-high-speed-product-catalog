import type { Metadata } from "next";

// Admin pages are private: never indexed, never cached by shared caches (see also headers in next.config.mjs).
export const metadata: Metadata = { title: "Catalog Maker Admin", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900">{children}</div>;
}
