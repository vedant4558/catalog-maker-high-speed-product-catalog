// Safe, repeatable repair of DEMO product photos in an existing database (e.g. your Supabase DB).
//   npm run db:fix-images            -> apply
//   npm run db:fix-images -- --dry   -> only report what would change
// Rules:
//  * Only products whose SKU, URL slug AND name all match an entry in prisma/demo-images.ts are touched,
//    and only manual (non-imported) products: Shopify/WooCommerce products are never modified.
//  * Only image URLs that the demo seed itself produced (picsum.photos, or the demo Unsplash photos) are replaced.
//    If an admin has put their own image on a demo product, that product is left alone.
//  * Only the product's image rows and thumbnail change. Name, price, SKU, stock, category, variants: untouched.
//  * Idempotent: a second run reports 0 changes.
import { PrismaClient } from "@prisma/client";
import { DEMO_IMAGES, demoImagesFor, isManagedDemoUrl } from "../prisma/demo-images";

const db = new PrismaClient();
const dry = process.argv.includes("--dry");

async function main() {
  const products = await db.product.findMany({
    where: { sku: { startsWith: "DEMO-" }, sourceId: null, slug: { in: Object.keys(DEMO_IMAGES) } },
    select: { id: true, sku: true, slug: true, name: true, thumbnailUrl: true, images: { orderBy: { position: "asc" }, select: { id: true, url: true } } }
  });
  let changed = 0, same = 0, skipped = 0;
  for (const p of products) {
    const spec = DEMO_IMAGES[p.slug];
    if (spec.sku !== p.sku || spec.name !== p.name) { skipped++; console.log(`skip ${p.sku} ${p.name}: identity does not match the demo mapping`); continue; }
    const custom = p.images.some((i) => !isManagedDemoUrl(i.url)) || (p.thumbnailUrl != null && !isManagedDemoUrl(p.thumbnailUrl));
    if (custom) { skipped++; console.log(`skip ${p.sku} ${p.name}: has an image set by an admin`); continue; }
    const target = demoImagesFor(p.slug);
    if (JSON.stringify(p.images.map((i) => i.url)) === JSON.stringify(target.gallery) && p.thumbnailUrl === target.thumbnail) { same++; continue; }
    changed++;
    console.log(`${dry ? "would update" : "update"} ${p.sku} ${p.name}: ${p.images.length} -> ${target.gallery.length} photo(s)`);
    if (dry) continue;
    await db.$transaction([
      // overwrite existing rows in place, drop surplus demo rows, add missing ones
      ...target.gallery.slice(0, p.images.length).map((url, i) => db.productImage.update({ where: { id: p.images[i].id }, data: { url, position: i, alt: p.name } })),
      ...(p.images.length > target.gallery.length ? [db.productImage.deleteMany({ where: { id: { in: p.images.slice(target.gallery.length).map((i) => i.id) } } })] : []),
      ...target.gallery.slice(p.images.length).map((url, k) => db.productImage.create({ data: { productId: p.id, url, position: p.images.length + k, alt: p.name } })),
      db.product.update({ where: { id: p.id }, data: { thumbnailUrl: target.thumbnail } })
    ]);
  }
  console.log(`\nDemo products checked: ${products.length}. ${dry ? "Would update" : "Updated"}: ${changed}. Already correct: ${same}. Skipped: ${skipped}.`);
  if (changed && !dry) console.log("Changes show on the site within 60 s, or immediately after saving Settings once in /admin.");
}
main().finally(() => db.$disconnect());
