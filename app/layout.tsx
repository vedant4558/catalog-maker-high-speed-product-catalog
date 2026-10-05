import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Catalog Maker", description: "High-speed product catalog" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
