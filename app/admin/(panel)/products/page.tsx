import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageContext } from "@/lib/admin/context";
import { listCategoryTree } from "@/lib/admin/services/categories";
import { listProducts } from "@/lib/admin/services/products";
import { Badge, Card, PageHeader, Pagination, btnCls, btnGhostCls, fmtMoney, inputCls, stockBadge } from "@/components/admin/ui";

type SP = { q?: string; category?: string; stock?: string; status?: string; page?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { client } = await requirePageContext();
  const page = Math.max(1, Number(sp.page) || 1);
  const [list, cats] = await Promise.all([
    listProducts(client.id, { q: sp.q?.trim().slice(0, 100), categoryId: sp.category, stock: sp.stock, status: sp.status, page }),
    listCategoryTree(client.id)
  ]);
  const qs = (p: number) => { const u = new URLSearchParams(); for (const k of ["q", "category", "stock", "status"] as const) if (sp[k]) u.set(k, sp[k] as string); u.set("page", String(p)); return `/admin/products?${u}`; };
  return (
    <>
      <PageHeader title="Products" subtitle={`${list.total} product${list.total === 1 ? "" : "s"}`} actions={<Link className={btnCls} href="/admin/products/new">Add product</Link>} />
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <input name="q" defaultValue={sp.q} placeholder="Search name, SKU…" className={`${inputCls} lg:col-span-2`} aria-label="Search products" />
          <select name="category" defaultValue={sp.category ?? ""} className={inputCls} aria-label="Category">
            <option value="">All categories</option><option value="none">Uncategorised</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
          </select>
          <select name="stock" defaultValue={sp.stock ?? ""} className={inputCls} aria-label="Availability">
            <option value="">Any availability</option><option value="IN_STOCK">In stock</option><option value="OUT_OF_STOCK">Out of stock</option><option value="ON_BACKORDER">Backorder</option>
          </select>
          <div className="flex gap-2">
            <select name="status" defaultValue={sp.status ?? ""} className={inputCls} aria-label="Visibility"><option value="">All</option><option value="active">Visible</option><option value="hidden">Hidden</option></select>
            <button className={btnGhostCls} type="submit">Filter</button>
          </div>
        </form>
      </Card>
      {list.rows.length === 0 ? (
        <Card><p className="text-sm text-neutral-600">No products match. {sp.q || sp.category || sp.stock || sp.status ? <Link href="/admin/products" className="underline">Clear filters</Link> : <>Add one or <Link href="/admin/sources" className="underline">import from Shopify/WooCommerce</Link>.</>}</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th><th className="p-3">Availability</th><th className="p-3">Source</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {list.rows.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      {p.thumbnailUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnailUrl} alt="" loading="lazy" width={40} height={40} className="h-10 w-10 rounded object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">No img</span>}
                      <span className="font-medium">{p.name}{!p.isActive && <> <Badge tone="gray">Hidden</Badge></>}</span>
                    </Link>
                  </td>
                  <td className="p-3 text-neutral-600">{p.sku ?? "—"}</td>
                  <td className="p-3 text-neutral-600">{p.category?.name ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{fmtMoney(p.price, p.currency)}</td>
                  <td className="p-3">{stockBadge(p.stockStatus)}</td>
                  <td className="p-3 text-neutral-600">{p.source ? p.source.name : "Manual"}</td>
                  <td className="p-3 text-right"><Link className="text-sm underline" href={`/admin/products/${p.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={list.page} pages={list.pages} hrefFor={qs} />
    </>
  );
}
