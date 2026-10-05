// Demo product photos that actually match the product type (free Unsplash photos, served by images.unsplash.com).
// Used by prisma/seed.ts for new databases and by scripts/fix-demo-images.ts to repair already-seeded databases.
const POOLS: Record<string, string[]> = {
  carpet: [
    "1660394585016-508f949df960", // red Persian rug, geometric medallion
    "1572123979839-3749e9973aba", // large multicoloured rug
    "1652634213812-f0deeb1de78e", // red patterned carpet
    "1534889156217-d643df14f14a", // living room with red area rug
    "1545078194-2ec3c4e53ed1", // brown area rug
    "1600166898405-da9535204843", // rug with fringes
    "1594040226829-7f251ab46d80", // area rug on floor
    "1671576563965-23993d69eb17" // floral rug
  ],
  round: [
    "1732516405240-da1ba9c7282b", // round yellow rug
    "1745905308908-25f35bacd146", // colourful circular rug with fringe
    "1762758889413-64d717f81b0d", // circular rug with scalloped edge
    "1575414003591-ece8d0416c7a", // round area rug in living room
    "1766405831946-2b7f1653ed8f" // braided round rug
  ],
  runner: [
    "1766052409111-0bd046af4be1", // patterned runner on wooden floor
    "1765802536365-e2267a489a2c", // long geometric runner
    "1759146464279-af282e1d2c73", // striped runner on wooden floor
    "1762356317094-5826049a3641" // striped runner
  ],
  curtain: [
    "1528822855841-e8bf3134cdc9", // white panel curtains
    "1628428988931-14bc33099075", // floral window curtain
    "1519035350952-38d18a3848cf", // rod-pocket curtain close-up
    "1616434602533-32fcefcc3621", // yellow curtain
    "1473252812967-d565c3607e28", // window with curtain
    "1570427224050-b080ad19e3c4" // white curtain
  ]
};

/** Category slug (as created by the seed) -> photo pool. */
export function poolFor(categorySlug: string | null | undefined): string[] {
  switch (categorySlug) {
    case "curtains": return POOLS.curtain;
    case "round": return POOLS.round;
    case "runners": return POOLS.runner;
    case "rugs": return [...POOLS.round, ...POOLS.runner];
    default: return POOLS.carpet; // living-room, bedroom, carpets
  }
}

const url = (id: string, size: number) => `https://images.unsplash.com/photo-${id}?w=${size}&h=${size}&fit=crop&auto=format&q=80`;

/** 3 gallery images + thumbnail for the n-th demo product (rotates through the pool so neighbours differ). */
export function demoImages(categorySlug: string | null | undefined, n: number) {
  const pool = poolFor(categorySlug);
  const ids = [0, 1, 2].map((k) => pool[(n + k) % pool.length]);
  return { gallery: ids.map((id) => url(id, 900)), thumbnail: url(ids[0], 400) };
}
