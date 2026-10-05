import Link from "next/link";

export function NotConfigured() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Catalog coming soon</h1>
      <p className="mt-2 text-neutral-600">This catalog has not been set up yet. Please check back shortly.</p>
    </main>
  );
}

export function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4" aria-busy="true" aria-label="Loading">
      <div className="mb-4 h-10 animate-pulse rounded-lg bg-neutral-200" />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <li key={i} className="animate-pulse"><div className="aspect-square rounded-xl bg-neutral-200" /><div className="mt-2 h-3 w-3/4 rounded bg-neutral-200" /><div className="mt-2 h-3 w-1/3 rounded bg-neutral-200" /></li>)}
      </ul>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-4 md:grid-cols-2" aria-busy="true" aria-label="Loading">
      <div className="aspect-square animate-pulse rounded-xl bg-neutral-200" />
      <div className="space-y-3"><div className="h-8 w-3/4 animate-pulse rounded bg-neutral-200" /><div className="h-6 w-1/4 animate-pulse rounded bg-neutral-200" /><div className="h-24 animate-pulse rounded bg-neutral-200" /></div>
    </div>
  );
}

export function Friendly({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-neutral-600">{text}</p>
      <div className="mt-5">{action ?? <Link href="/" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Back to the catalog</Link>}</div>
    </main>
  );
}
