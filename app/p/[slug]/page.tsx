import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cachedProduct, cachedRelated } from "@/lib/catalog/cached";
import { getDesign } from "@/designs/registry";
import { loadShop } from "@/lib/shop";
import { NotConfigured } from "@/components/shop/States";

export const revalidate = 60;
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const shop = await loadShop();
  if (!shop) return {};
  const p = await cachedProduct(shop.client.id, decodeURIComponent((await params).slug));
  if (!p) return { title: "Product not found" };
  return { title: `${p.name} | ${shop.client.name}`, description: (p.description ?? p.name).slice(0, 160), openGraph: { title: p.name, images: p.thumbnail ? [p.thumbnail] : undefined } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const shop = await loadShop();
  if (!shop) return <NotConfigured />;
  const slug = decodeURIComponent((await params).slug);
  const [product, related] = await Promise.all([cachedProduct(shop.client.id, slug), cachedRelated(shop.client.id, slug)]);
  if (!product) notFound();
  const design = getDesign(shop.client.activeDesign);
  return (
    <design.Shell client={shop.client} categories={shop.categories} activeCategory={product.category?.slug}>
      <design.Detail client={shop.client} product={product} related={related ?? []} />
    </design.Shell>
  );
}
