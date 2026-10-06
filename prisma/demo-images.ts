// Demo product photos: ONE explicit, hand-checked mapping per demo product (no rotation, no sharing between products).
// Source: free Unsplash photos (Unsplash License, embedding allowed), served from images.unsplash.com.
// Each entry was chosen from Unsplash's own description of the photo, and every URL was checked to return an image.
// Used by prisma/seed.ts (new databases) and scripts/fix-demo-images.ts (repairs an already-seeded database).

export interface DemoImageSpec { sku: string; name: string; photos: { id: string; about: string }[] }

export const DEMO_IMAGES: Record<string, DemoImageSpec> = {
  // ---- Carpets: Living Room
  "royal-persian-carpet": { sku: "DEMO-001", name: "Royal Persian Carpet", photos: [
    { id: "1660394585016-508f949df960", about: "red Persian rug, geometric patterns, central diamond motif" },
    { id: "1652634213812-f0deeb1de78e", about: "red carpet with a colourful traditional design" }] },
  "ivory-bloom-carpet": { sku: "DEMO-002", name: "Ivory Bloom Carpet", photos: [
    { id: "1671576563965-23993d69eb17", about: "rug with a floral design" },
    { id: "1531162805941-58330188d75c", about: "intricately designed rug with blue and green flowers" }] },
  "midnight-medallion-carpet": { sku: "DEMO-003", name: "Midnight Medallion Carpet", photos: [
    { id: "1761849450843-4ce9e6560b94", about: "dark traditional oriental carpet with light accents" },
    { id: "1753100410452-ba4b5426908a", about: "navy blue patterned carpet" }] },
  "sand-dune-carpet": { sku: "DEMO-004", name: "Sand Dune Carpet", photos: [
    { id: "1545078194-2ec3c4e53ed1", about: "brown area rug" },
    { id: "1564444247765-a377a8bfd0b8", about: "brown and white rug" }] },
  "heritage-red-carpet": { sku: "DEMO-005", name: "Heritage Red Carpet", photos: [] }, // deliberately no image: shows the missing-image placeholder
  "azure-panel-carpet": { sku: "DEMO-006", name: "Azure Panel Carpet", photos: [
    { id: "1766663769869-359d473a0f37", about: "blue and pink geometric patterned rug on a wooden floor" }] },
  // ---- Carpets: Bedroom
  "soft-cloud-carpet": { sku: "DEMO-007", name: "Soft Cloud Carpet", photos: [
    { id: "1538476336763-16a34df6f3de", about: "white fluffy sheepskin rug" }] },
  "blush-haze-carpet": { sku: "DEMO-008", name: "Blush Haze Carpet", photos: [
    { id: "1764832898653-cca3787fb1a1", about: "pink rug with a repeating floral pattern on the floor" }] },
  "lavender-mist-carpet": { sku: "DEMO-009", name: "Lavender Mist Carpet", photos: [
    { id: "1774250100354-3067b5b748ad", about: "floral Persian rug with central medallion" }] },
  "nordic-grey-carpet": { sku: "DEMO-010", name: "Nordic Grey Carpet", photos: [
    { id: "1644775130118-cc70d0f58728", about: "black-and-white (grey) photo of a carpet" }] },
  "cream-tufted-carpet": { sku: "DEMO-011", name: "Cream Tufted Carpet", photos: [
    { id: "1767159601823-96d0295344ce", about: "hand-tufted carpet with traditional pattern" },
    { id: "1634582470872-58ab8f4173a4", about: "close-up of a white and brown rug" }] },
  "sage-whisper-carpet": { sku: "DEMO-012", name: "Sage Whisper Carpet", photos: [
    { id: "1752568583323-92145f90e6a8", about: "green block-printed cotton rug, geometric and floral" }] },
  // ---- Rugs: Round (all photos are round rugs)
  "sunburst-rug": { sku: "DEMO-013", name: "Sunburst Rug", photos: [
    { id: "1732516405240-da1ba9c7282b", about: "round yellow braided cotton rug" }] },
  "terracotta-ring-rug": { sku: "DEMO-014", name: "Terracotta Ring Rug", photos: [
    { id: "1745905308908-25f35bacd146", about: "colourful circular jute/cotton rug with fringe" }] },
  "ocean-spiral-rug": { sku: "DEMO-015", name: "Ocean Spiral Rug", photos: [
    { id: "1768218983339-0415a4ca932d", about: "round braided chindi cotton rug" }] },
  "moss-circle-rug": { sku: "DEMO-016", name: "Moss Circle Rug", photos: [
    { id: "1762758889413-64d717f81b0d", about: "round braided jute rug with scalloped edge on a wooden floor" }] },
  // ---- Rugs: Runners (long rugs)
  "corridor-classic-rug": { sku: "DEMO-017", name: "Corridor Classic Rug", photos: [
    { id: "1765802536365-e2267a489a2c", about: "long hand-tufted runner rug, geometric pattern" }] },
  "kilim-stripe-rug": { sku: "DEMO-018", name: "Kilim Stripe Rug", photos: [
    { id: "1594124715273-29591dabdd17", about: "red, blue and yellow striped rug on a wooden floor" }] },
  "olive-trail-rug": { sku: "DEMO-019", name: "Olive Trail Rug", photos: [
    { id: "1764581186205-b26952a1f507", about: "green Moroccan-style runner rug" }] },
  "charcoal-edge-rug": { sku: "DEMO-020", name: "Charcoal Edge Rug", photos: [
    { id: "1762356317094-5826049a3641", about: "rug with vertical stripes and black rectangles" }] },
  // ---- Curtains (all photos are curtains / drapes)
  "linen-drape-curtain": { sku: "DEMO-021", name: "Linen Drape Curtain", photos: [
    { id: "1539208175673-6b9149754096", about: "closed grey curtain" },
    { id: "1599280611965-bef72efc48fb", about: "white and grey window curtain" }] },
  "velvet-wine-curtain": { sku: "DEMO-022", name: "Velvet Wine Curtain", photos: [
    { id: "1519035350952-38d18a3848cf", about: "red rod-pocket curtain, close-up" },
    { id: "1659282386282-d7145e593bad", about: "window with red curtains" }] },
  "sheer-pearl-curtain": { sku: "DEMO-023", name: "Sheer Pearl Curtain", photos: [
    { id: "1573507811472-909cd17e834d", about: "white sheer window curtains" },
    { id: "1528822855841-e8bf3134cdc9", about: "white panel curtains" }] },
  "blackout-navy-curtain": { sku: "DEMO-024", name: "Blackout Navy Curtain", photos: [
    { id: "1607506286825-fba695a93212", about: "blue window curtain" },
    { id: "1655137673627-2ed098d729bf", about: "blue curtain, close-up" }] },
  "jute-weave-curtain": { sku: "DEMO-025", name: "Jute Weave Curtain", photos: [
    { id: "1593909840438-48825492a8b7", about: "white and brown window curtain" }] },
  "gold-jacquard-curtain": { sku: "DEMO-026", name: "Gold Jacquard Curtain", photos: [
    { id: "1774916701233-7da2d4ef1bad", about: "ornate golden drapes framing a window" },
    { id: "1638006353284-eca071dd9238", about: "yellow-gold curtain, close-up" }] }
};

/** Photo ids used by the FIRST image fix (v1). Only these, picsum.photos and the current ids are ever replaced by the repair script. */
export const LEGACY_PHOTO_IDS = [
  "1660394585016-508f949df960", "1572123979839-3749e9973aba", "1652634213812-f0deeb1de78e", "1534889156217-d643df14f14a",
  "1545078194-2ec3c4e53ed1", "1600166898405-da9535204843", "1594040226829-7f251ab46d80", "1671576563965-23993d69eb17",
  "1732516405240-da1ba9c7282b", "1745905308908-25f35bacd146", "1762758889413-64d717f81b0d", "1575414003591-ece8d0416c7a",
  "1766405831946-2b7f1653ed8f", "1766052409111-0bd046af4be1", "1765802536365-e2267a489a2c", "1759146464279-af282e1d2c73",
  "1762356317094-5826049a3641", "1528822855841-e8bf3134cdc9", "1628428988931-14bc33099075", "1519035350952-38d18a3848cf",
  "1616434602533-32fcefcc3621", "1473252812967-d565c3607e28", "1570427224050-b080ad19e3c4"
];

export const photoUrl = (id: string, size: number) => `https://images.unsplash.com/photo-${id}?w=${size}&h=${size}&fit=crop&auto=format&q=80`;

/** Gallery (900 px) + thumbnail (400 px) for a demo product slug; empty gallery / null thumbnail when it has no photo. */
export function demoImagesFor(slug: string) {
  const spec = DEMO_IMAGES[slug];
  const ids = spec?.photos.map((p) => p.id) ?? [];
  return { gallery: ids.map((id) => photoUrl(id, 900)), thumbnail: ids.length ? photoUrl(ids[0], 400) : null };
}

/** True when a URL was produced by the demo seed (random picsum photo, v1 or current demo mapping): safe to replace. */
export function isManagedDemoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes("picsum.photos")) return true;
  const m = url.match(/^https:\/\/images\.unsplash\.com\/photo-([0-9a-f-]+)\?/);
  if (!m) return false;
  const current = Object.values(DEMO_IMAGES).flatMap((s) => s.photos.map((p) => p.id));
  return LEGACY_PHOTO_IDS.includes(m[1]) || current.includes(m[1]);
}
