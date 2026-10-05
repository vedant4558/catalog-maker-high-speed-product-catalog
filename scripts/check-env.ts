// Pre-deploy sanity check: `npm run check:env` (reads .env locally; in CI/Vercel use real env).
// Prints only variable NAMES and problems, never values. Exits 1 if a required variable is missing/placeholder.
import { existsSync, readFileSync } from "node:fs";

// Minimal .env loader so the check works locally without extra dependencies.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const PLACEHOLDER = /(change-me|USER:PASSWORD|your[-_ ]|\bHOST\b|xxx)/i;
const required = ["DATABASE_URL", "DIRECT_URL", "ADMIN_PASSWORD", "CRON_SECRET", "DEFAULT_CLIENT_SLUG"];
const optional = ["WHATSAPP_NUMBER", "SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ACCESS_TOKEN", "WOOCOMMERCE_SITE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"];

let bad = 0;
for (const k of required) {
  const v = process.env[k];
  if (!v) { console.error(`✗ ${k} is missing`); bad++; }
  else if (PLACEHOLDER.test(v)) { console.error(`✗ ${k} still looks like a placeholder`); bad++; }
  else console.log(`✓ ${k}`);
}
for (const k of ["ADMIN_PASSWORD", "CRON_SECRET"]) {
  const v = process.env[k];
  if (v && v.length < 16) { console.error(`✗ ${k} is too short (use 16+ random characters)`); bad++; }
}
if (process.env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) { console.error("✗ DATABASE_URL must be a postgres:// or postgresql:// URL"); bad++; }
for (const k of optional) console.log(`${process.env[k] && !PLACEHOLDER.test(process.env[k] as string) ? "✓" : "·"} ${k} (optional)`);
if (bad) { console.error(`\n${bad} problem(s). Fix them before deploying.`); process.exit(1); }
console.log("\nEnvironment looks ready.");
