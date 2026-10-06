// Demo photo mapping integrity: every demo product has its own photo(s) of the right product type.
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_IMAGES, LEGACY_PHOTO_IDS, demoImagesFor, isManagedDemoUrl, photoUrl } from "../prisma/demo-images";

const entries = Object.entries(DEMO_IMAGES);

test("one entry per demo product, unique SKUs, slug matches name", () => {
  assert.equal(entries.length, 26);
  assert.equal(new Set(entries.map(([, s]) => s.sku)).size, 26);
  for (const [slug, s] of entries) assert.equal(slug, s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
});

test("photo type matches product type (by Unsplash's own description)", () => {
  for (const [, s] of entries) {
    for (const p of s.photos) {
      if (/Curtain$/.test(s.name)) assert.match(p.about, /curtain|drape/i, `${s.name}: ${p.about}`);
      else assert.match(p.about, /rug|carpet/i, `${s.name}: ${p.about}`);
      assert.doesNotMatch(p.about, /couch|sofa|chair|person|plant|bed\b|pillow/i, `${s.name}: not a furniture/room photo`);
    }
    const n = Number(s.sku.slice(5));
    if (n >= 13 && n <= 16) for (const p of s.photos) assert.match(p.about, /round|circular/i, `${s.name} is a round rug`);
    if (n >= 17 && n <= 20) for (const p of s.photos) assert.match(p.about, /runner|stripe|long/i, `${s.name} is a runner`);
  }
});

test("no photo is shared between two products; known-bad v1 photos are gone", () => {
  const ids = entries.flatMap(([, s]) => s.photos.map((p) => p.id));
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  for (const bad of ["1534889156217-d643df14f14a", "1594040226829-7f251ab46d80", "1575414003591-ece8d0416c7a", "1473252812967-d565c3607e28", "1766405831946-2b7f1653ed8f", "1766052409111-0bd046af4be1"]) assert.ok(!ids.includes(bad), bad);
});

test("helpers: gallery/thumbnail, missing-image product, and which URLs the repair may replace", () => {
  assert.deepEqual(demoImagesFor("heritage-red-carpet"), { gallery: [], thumbnail: null });
  const r = demoImagesFor("royal-persian-carpet");
  assert.equal(r.gallery.length, 2); assert.match(r.thumbnail!, /w=400/);
  assert.ok(isManagedDemoUrl("https://picsum.photos/seed/x-1/900/900"));
  assert.ok(isManagedDemoUrl(photoUrl(LEGACY_PHOTO_IDS[3], 900)));
  assert.ok(isManagedDemoUrl(r.gallery[0]));
  assert.ok(!isManagedDemoUrl("https://cdn.shopify.com/s/files/rug.jpg"), "imported/admin images are never replaced");
  assert.ok(!isManagedDemoUrl("https://images.unsplash.com/photo-1111111111111-aaaaaaaaaaaa?w=1"), "unknown unsplash photo = admin choice");
  assert.ok(!isManagedDemoUrl(null));
});
