import { PrismaClient, StockStatus } from "@prisma/client";
import { demoImagesFor } from "./demo-images";

const db = new PrismaClient();

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// parent -> children. "Clearance" is deliberately empty to exercise the empty-category state.
const TREE: Record<string, string[]> = {
  Carpets: ["Living Room", "Bedroom"],
  Rugs: ["Round", "Runners"],
  Curtains: [],
  Clearance: []
};

const NAMES: Record<string, string[]> = {
  "Living Room": ["Royal Persian", "Ivory Bloom", "Midnight Medallion", "Sand Dune", "Heritage Red", "Azure Panel"],
  Bedroom: ["Soft Cloud", "Blush Haze", "Lavender Mist", "Nordic Grey", "Cream Tufted", "Sage Whisper"],
  Round: ["Sunburst", "Terracotta Ring", "Ocean Spiral", "Moss Circle"],
  Runners: ["Corridor Classic", "Kilim Stripe", "Olive Trail", "Charcoal Edge"],
  Curtains: ["Linen Drape", "Velvet Wine", "Sheer Pearl", "Blackout Navy", "Jute Weave", "Gold Jacquard"]
};

async function main() {
  const client = await db.client.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Carpets", slug: "demo", whatsappNumber: process.env.WHATSAPP_NUMBER || "919999999999", activeDesign: "grid", currency: "INR" }
  });

  // Part 2: one source row per platform. Only the non-secret store address is saved here; secrets (tokens, keys) are read from environment
  // variables at sync time. With no real address the admin panel shows a clear "credentials missing" message.
  const sources = [
    { type: "SHOPIFY" as const, name: "Shopify store", baseUrl: process.env.SHOPIFY_SHOP_DOMAIN || "your-store.myshopify.com", credentials: {} },
    { type: "WOOCOMMERCE" as const, name: "WooCommerce store", baseUrl: process.env.WOOCOMMERCE_SITE_URL || "https://your-wordpress-site.com", credentials: {} }
  ];
  for (const src of sources) {
    const exists = await db.source.findFirst({ where: { clientId: client.id, type: src.type } });
    if (!exists) await db.source.create({ data: { clientId: client.id, ...src } });
  }

  let order = 0;
  const catId: Record<string, string> = {};
  for (const [parent, kids] of Object.entries(TREE)) {
    const p = await db.category.upsert({
      where: { clientId_slug: { clientId: client.id, slug: slugify(parent) } },
      update: {},
      create: { clientId: client.id, name: parent, slug: slugify(parent), sortOrder: order++ }
    });
    catId[parent] = p.id;
    for (const kid of kids) {
      const c = await db.category.upsert({
        where: { clientId_slug: { clientId: client.id, slug: slugify(kid) } },
        update: {},
        create: { clientId: client.id, name: kid, slug: slugify(kid), parentId: p.id, sortOrder: order++ }
      });
      catId[kid] = c.id;
    }
  }

  let n = 0;
  for (const [cat, names] of Object.entries(NAMES)) {
    for (const base of names) {
      n++;
      const name = `${base} ${cat === "Curtains" ? "Curtain" : cat === "Runners" || cat === "Round" ? "Rug" : "Carpet"}`;
      const slug = slugify(name);
      const price = 1500 + ((n * 937) % 9000);
      const outOfStock = n % 7 === 0;
      const noImage = n === 5; // exercise the missing-image path (Heritage Red Carpet)
      const pics = demoImagesFor(slug); // exact photo(s) for this product
      const imgs = pics.gallery;
      const exists = await db.product.findUnique({ where: { clientId_slug: { clientId: client.id, slug } } });
      if (exists) continue;
      await db.product.create({
        data: {
          clientId: client.id,
          sku: `DEMO-${String(n).padStart(3, "0")}`,
          name,
          slug,
          description: `${name}: hand-finished, durable and easy to maintain. Demo product ${n}.`,
          price,
          compareAtPrice: n % 3 === 0 ? Math.round(price * 1.2) : null,
          stockStatus: outOfStock ? StockStatus.OUT_OF_STOCK : StockStatus.IN_STOCK,
          stockQty: outOfStock ? 0 : 5 + (n % 20),
          categoryId: catId[cat],
          thumbnailUrl: noImage ? null : pics.thumbnail,
          metadata: { material: n % 2 ? "Wool blend" : "Polyester", demo: true },
          images: noImage || !imgs.length ? undefined : { create: imgs.map((url, position) => ({ url, position, alt: name })) }
        }
      });
    }
  }
  console.log(`Seeded client "${client.slug}", ${Object.keys(catId).length} categories, ${n} demo products.`);
}

main().finally(() => db.$disconnect());
