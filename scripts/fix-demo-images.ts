// One-off, NON-destructive repair for databases seeded before the demo photos were fixed.
// Only touches DEMO products (SKU "DEMO-xxx", not from Shopify/Woo) whose images still point at picsum.photos
// (random stock photos). It rewrites those URLs in place; nothing is deleted, nothing else is changed.
// Usage: npm run db:fix-images
import { PrismaClient } from "@prisma/client";
import { demoImages } from "../prisma/demo-images";

const db = new PrismaClient();

async function main() {
  const products = await db.product.findMany({
    where: { sku: { startsWith: "DEMO-" }, sourceId: null },
    select: { id: true, sku: true, name: true, thumbnailUrl: true, category: { select: { slug: true } }, images: { orderBy: { position: "asc" }, select: { id: true, url: true } } }
  });
  let fixed = 0;
  for (const p of products) {
    const n = Number(p.sku!.slice(5)) || 1;
    const pics = demoImages(p.category?.slug, n);
    const stale = p.images.filter((i) => i.url.includes("picsum.photos"));
    const thumbStale = p.thumbnailUrl?.includes("picsum.photos") ?? false;
    if (!stale.length && !thumbStale) continue;
    await db.$transaction([
      ...p.images.map((img, i) => (img.url.includes("picsum.photos") ? db.productImage.update({ where: { id: img.id }, data: { url: pics.gallery[i % 3] } }) : null)).filter((x) => x !== null),
      ...(thumbStale ? [db.product.update({ where: { id: p.id }, data: { thumbnailUrl: pics.thumbnail } })] : [])
    ]);
    fixed++;
    console.log(`updated ${p.sku} ${p.name}`);
  }
  console.log(`Done. ${fixed} demo product(s) now use matching photos. Clear the catalog cache by saving Settings in /admin (or wait 60 s).`);
}
main().finally(() => db.$disconnect());
