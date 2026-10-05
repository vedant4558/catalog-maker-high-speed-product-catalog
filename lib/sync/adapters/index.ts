import type { Source } from "@prisma/client";
import { ShopifyAdapter, type ShopifyCredentials } from "./shopify";
import { WooCommerceAdapter, type WooCredentials } from "./woocommerce";
import { SourceError, type SourceAdapter } from "../types";

// Values left over from templates/seeds must never be mistaken for real credentials.
const PLACEHOLDER = /placeholder|your-store|your-wordpress|your_|change-me/i;
const real = (v?: string | null) => (v && v.trim() && !PLACEHOLDER.test(v) ? v.trim() : undefined);

type SourceLike = Pick<Source, "type" | "baseUrl" | "credentials">;
const creds = (source: SourceLike) => (source.credentials ?? {}) as Record<string, string | undefined>;

/**
 * Admin-friendly credential check (never returns secret values). Secrets come from environment variables
 * (or from credentials stored through the Part 2 API); the UI only ever shows whether they are present.
 */
export function credentialStatus(source: SourceLike): { ok: boolean; missing: string[]; hint: string } {
  const c = creds(source);
  if (source.type === "SHOPIFY") {
    const missing = real(c.shopDomain) ?? real(source.baseUrl) ?? real(process.env.SHOPIFY_SHOP_DOMAIN) ? [] : ["Shopify store domain"];
    return { ok: !missing.length, missing, hint: "Set the store address on this source (or SHOPIFY_SHOP_DOMAIN). SHOPIFY_ACCESS_TOKEN is optional: without it the public product feed is used." };
  }
  const missing: string[] = [];
  if (!(real(c.siteUrl) ?? real(source.baseUrl) ?? real(process.env.WOOCOMMERCE_SITE_URL))) missing.push("WooCommerce site URL");
  if (!(real(c.consumerKey) ?? real(process.env.WOOCOMMERCE_CONSUMER_KEY))) missing.push("consumer key");
  if (!(real(c.consumerSecret) ?? real(process.env.WOOCOMMERCE_CONSUMER_SECRET))) missing.push("consumer secret");
  return { ok: !missing.length, missing, hint: "Set the site URL on this source, and add WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET as environment variables." };
}

/** Builds the right adapter from a Source row. Credentials live in Source.credentials (env fallback for single-store setups). */
export function createAdapter(source: SourceLike): SourceAdapter {
  const c = creds(source);
  switch (source.type) {
    case "SHOPIFY":
      return new ShopifyAdapter({
        shopDomain: real(c.shopDomain) ?? real(source.baseUrl) ?? real(process.env.SHOPIFY_SHOP_DOMAIN) ?? "",
        accessToken: real(c.accessToken) ?? real(process.env.SHOPIFY_ACCESS_TOKEN),
        storefrontDomain: c.storefrontDomain,
        apiVersion: c.apiVersion,
        pageSize: c.pageSize ? Number(c.pageSize) : undefined
      } satisfies ShopifyCredentials);
    case "WOOCOMMERCE":
      return new WooCommerceAdapter({
        siteUrl: real(c.siteUrl) ?? real(source.baseUrl) ?? real(process.env.WOOCOMMERCE_SITE_URL) ?? "",
        consumerKey: real(c.consumerKey) ?? real(process.env.WOOCOMMERCE_CONSUMER_KEY) ?? "",
        consumerSecret: real(c.consumerSecret) ?? real(process.env.WOOCOMMERCE_CONSUMER_SECRET) ?? ""
      } satisfies WooCredentials);
    default:
      throw new SourceError(`Source type ${source.type} cannot be synchronised.`);
  }
}
