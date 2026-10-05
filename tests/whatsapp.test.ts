// Part 4: WhatsApp click-to-chat URL/message generation (pure functions; no database).
import test from "node:test";
import assert from "node:assert/strict";
import { buildEnquiry, buildEnquiryMessage, buildWhatsAppUrl, normalizeWhatsAppNumber, productUrl } from "../lib/whatsapp";

const O = "https://shop.example.com";
const decode = (url: string) => decodeURIComponent(new URL(url).searchParams.get("text")!);

test("number normalisation: digits only, 8-15 long, else unusable", () => {
  assert.equal(normalizeWhatsAppNumber("+91 98765-43210"), "919876543210");
  assert.equal(normalizeWhatsAppNumber("919876543210"), "919876543210");
  for (const bad of ["", "  ", null, undefined, "abc", "123", "1".repeat(16)]) assert.equal(normalizeWhatsAppNumber(bad as string), null);
});

test("single product: wa.me URL with product name + catalog URL in the message", () => {
  const r = buildEnquiry("919876543210", [{ name: "Blue Rug", slug: "blue-rug" }], O);
  assert.ok(r.ok);
  if (!r.ok) return;
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, "https://wa.me/919876543210");
  assert.equal(decode(r.url), "Hi, I am interested in the following product:\n1. Blue Rug - https://shop.example.com/p/blue-rug\nPlease share more details and pricing.");
});

test("multiple products: ONE message listing every product name + URL", () => {
  const items = [{ name: "Blue Rug", slug: "blue-rug" }, { name: "Silk Runner", slug: "silk-runner" }, { name: "Wool Mat", slug: "wool-mat" }];
  const r = buildEnquiry("919876543210", items, O + "/");
  assert.ok(r.ok);
  if (!r.ok) return;
  const text = decode(r.url);
  assert.match(text, /following products:/);
  items.forEach((p, i) => assert.ok(text.includes(`${i + 1}. ${p.name} - ${O}/p/${p.slug}`)));
  assert.equal(r.url.split("wa.me").length, 2, "exactly one link");
});

test("encoding: special characters, unicode, newlines and ampersands survive the round trip", () => {
  const items = [{ name: "Rug & Mat 50% \"Deluxe\" #1 – कालीन", slug: "rug mat/ü?x=1" }];
  const msg = buildEnquiryMessage(items, O);
  const url = buildWhatsAppUrl("+91 98765 43210", msg)!;
  assert.ok(!/[ \n"<>]/.test(url), "no raw spaces/newlines/quotes in the URL");
  assert.equal(new URL(url).searchParams.get("text"), msg);
  assert.equal(new URL(url).searchParams.size, 1, "the & inside the name did not split the query");
  assert.equal(productUrl(O, "rug mat/ü?x=1"), `${O}/p/rug%20mat%2F%C3%BC%3Fx%3D1`);
});

test("edge cases: nothing selected, number missing or invalid → clear reasons, never a dead link", () => {
  assert.deepEqual(buildEnquiry("919876543210", [], O), { ok: false, reason: "no-products" });
  assert.deepEqual(buildEnquiry(null, [{ name: "A", slug: "a" }], O), { ok: false, reason: "no-number" });
  assert.deepEqual(buildEnquiry("12", [{ name: "A", slug: "a" }], O), { ok: false, reason: "no-number" });
  assert.equal(buildWhatsAppUrl("", "hi"), null);
});
