// CLI: npx tsx scripts/sync.ts [sourceId|all] [--import]
// Handy for first imports, demos and debugging without going through HTTP.
import { db } from "../lib/db";
import { syncSource } from "../lib/sync/engine";

async function main() {
  const target = process.argv[2] ?? "all";
  const trigger = process.argv.includes("--import") ? "import" : "manual";
  const sources = target === "all" ? await db.source.findMany({ where: { type: { in: ["SHOPIFY", "WOOCOMMERCE"] } } }) : await db.source.findMany({ where: { id: target } });
  if (!sources.length) throw new Error("No matching source. Run `npm run db:seed` or create one via POST /api/admin/sources.");
  for (const s of sources) {
    console.log(`\n▶ ${s.type} "${s.name}"`);
    try {
      console.log(await syncSource(s.id, { trigger }));
    } catch (e) {
      console.error("  failed:", (e as Error).message);
    }
  }
}
main().finally(() => db.$disconnect());
