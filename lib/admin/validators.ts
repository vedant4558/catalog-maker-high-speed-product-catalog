import { z } from "zod";
import { ValidationError } from "./results";
import { DESIGN_KEYS } from "../designs";

const trimmed = (max: number) => z.string().trim().max(max, `Max ${max} characters`);
const optText = (max: number) => trimmed(max).optional().transform((v) => (v ? v : null));

const money = (label: string, required: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (v == null || v === "") {
        if (required) ctx.addIssue({ code: "custom", message: `${label} is required` });
        return null;
      }
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 9_999_999.99) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number between 0 and 9,999,999.99` });
        return null;
      }
      return Math.round(n * 100) / 100;
    });

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL");

const optUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(httpUrl.nullable());

export const STOCK = z.enum(["IN_STOCK", "OUT_OF_STOCK", "ON_BACKORDER"]);

const imageRow = z.object({ url: httpUrl, alt: trimmed(300).optional().transform((v) => v || null) });
const variantRow = z.object({
  externalId: trimmed(100).optional().transform((v) => v || null),
  title: trimmed(200).min(1, "Variant name is required"),
  sku: trimmed(100).optional().transform((v) => v || null),
  price: money("Variant price", false),
  stockStatus: STOCK,
  options: trimmed(500).optional().transform((v) => v || "")
});

/** "Size=M; Color=Red" -> {Size:"M", Color:"Red"} */
export function parseOptions(text: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const part of text.split(/[;\n]/)) {
    const i = part.indexOf("=");
    if (i > 0) {
      const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
      if (k && v) out[k.slice(0, 50)] = v.slice(0, 100);
    }
  }
  return Object.keys(out).length ? out : null;
}
export const optionsToText = (o: unknown) => (o && typeof o === "object" ? Object.entries(o as Record<string, string>).map(([k, v]) => `${k}=${v}`).join("; ") : "");

const jsonArray = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return [] as unknown[];
      try {
        const a = JSON.parse(v);
        if (!Array.isArray(a) || a.length > max) throw new Error();
        return a as unknown[];
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} is invalid (max ${max} rows)` });
        return [] as unknown[];
      }
    });

const metadataField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const t = (v ?? "").trim();
    if (!t) return null;
    try {
      const o = JSON.parse(t);
      if (!o || typeof o !== "object" || Array.isArray(o) || t.length > 10_000) throw new Error();
      return o as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: "custom", message: 'Metadata must be a JSON object, e.g. {"material":"Wool"} (max 10 KB)' });
      return null;
    }
  });

export const productSchema = z
  .object({
    name: trimmed(200).min(1, "Name is required"),
    slug: optText(100),
    sku: optText(100),
    description: optText(10_000),
    price: money("Price", true),
    compareAtPrice: money("Compare-at price", false),
    stockStatus: STOCK,
    stockQty: z.string().trim().optional().transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) ctx.addIssue({ code: "custom", message: "Stock quantity must be a whole number (0 or more)" });
      return Number.isInteger(n) ? n : null;
    }),
    categoryId: optText(60),
    sourceUrl: optUrl,
    isActive: z.string().optional().transform((v) => v === "on" || v === "true"),
    metadata: metadataField,
    images: jsonArray("Images", 20),
    variants: jsonArray("Variants", 100),
    lock: z.string().optional().transform((v) => v === "on" || v === "true"),
    unlock: z.string().optional().transform((v) => (v ? v.split(",").filter(Boolean) : []))
  })
  .transform((v, ctx) => {
    const images: { url: string; alt: string | null }[] = [];
    v.images.forEach((r, i) => {
      const p = imageRow.safeParse(r);
      if (!p.success) ctx.addIssue({ code: "custom", path: ["images"], message: `Image ${i + 1}: ${p.error.issues[0]?.message}` });
      else images.push(p.data);
    });
    const variants: z.infer<typeof variantRow>[] = [];
    v.variants.forEach((r, i) => {
      const p = variantRow.safeParse(r);
      if (!p.success) ctx.addIssue({ code: "custom", path: ["variants"], message: `Variant ${i + 1}: ${p.error.issues[0]?.message}` });
      else variants.push(p.data);
    });
    if (v.compareAtPrice != null && v.price != null && v.compareAtPrice <= v.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Compare-at price must be higher than the price (or leave it empty)" });
    }
    return { ...v, price: v.price as number, images, variants };
  });
export type ProductInput = z.output<typeof productSchema>;

const slugRule = z.string().trim().toLowerCase().max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");
const optSlug = z.string().trim().optional().transform((v) => (v ? v : undefined)).pipe(slugRule.optional());

export const categorySchema = z.object({
  name: trimmed(100).min(1, "Name is required"),
  slug: optSlug,
  parentId: optText(60),
  imageUrl: optUrl,
  isVisible: z.string().optional().transform((v) => v === "on" || v === "true")
});
export type CategoryInput = z.output<typeof categorySchema>;

export const settingsSchema = z.object({
  name: trimmed(120).min(1, "Catalog name is required"),
  whatsappNumber: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      const digits = (v ?? "").replace(/[\s\-().+]/g, "");
      if (!digits) return null;
      if (!/^\d{8,15}$/.test(digits)) ctx.addIssue({ code: "custom", message: "Enter the number with country code, 8-15 digits (e.g. 919876543210)" });
      return digits;
    }),
  activeDesign: z.enum(DESIGN_KEYS, { errorMap: () => ({ message: "Choose one of the available designs" }) }),
  domain: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      const d = (v ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!d) return null;
      if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) ctx.addIssue({ code: "custom", message: "Enter a valid domain such as catalog.example.com" });
      return d;
    })
});
export type SettingsInput = z.output<typeof settingsSchema>;

export const sourceSchema = z.object({
  type: z.enum(["SHOPIFY", "WOOCOMMERCE"]),
  name: trimmed(100).min(1, "Name is required"),
  baseUrl: trimmed(300).min(1, "Store address is required")
});

/** Parses FormData-like input with a zod schema and raises a ValidationError carrying per-field messages. */
export function parseInput<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.output<S> {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const i of r.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  throw new ValidationError(fieldErrors);
}
export const formToObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
