# Catalog Maker

A reusable, **mobile-first product catalog platform**. It imports products from **Shopify** and **WooCommerce** into its own **PostgreSQL** database, serves them through a fast **internal API**, and shows them to customers in **two selectable designs** with a browser-side **wishlist** and real **WhatsApp click-to-chat enquiries** (no cart, no checkout). An **admin panel** manages products, categories, imports/sync and settings.

> Status: all four assignment parts are implemented. **Not deployed yet** (Vercel deployment is a separate, final step). See [Requirement audit](#18-requirement-audit-honest-status) for exactly what is and is not finished.

## Contents
1. [Overview](#1-overview) · 2. [Architecture](#2-architecture) · 3. [Tech stack](#3-tech-stack) · 4. [Folder structure](#4-folder-structure) · 5. [Database](#5-database-structure) · 6. [Internal API](#6-internal-api) · 7. [Shopify](#7-shopify-integration) · 8. [WooCommerce](#8-woocommerce-integration) · 9. [Sync process](#9-sync-process) · 10. [Admin usage](#10-admin-panel-usage) · 11. [Customer catalog](#11-customer-catalog-usage) · 12. [Design switching](#12-design-switching) · 13. [Wishlist](#13-wishlist) · 14. [WhatsApp enquiry](#14-whatsapp-enquiry) · 15. [Speed](#15-speed-the-primary-goal) · 16. [Environment variables](#16-environment-variables) · 17. [Setup](#17-setup-on-windows--vs-code) · 18. [Requirement audit](#18-requirement-audit-honest-status) · 19. [Testing](#19-testing) · 20. [Security](#20-security) · 21. [Deploying to Vercel](#21-deploying-to-vercel-later) · 22. [Known limitations](#22-known-limitations) · 23. [Demo script](#23-demo-instructions-for-the-examiner)

---
## 1. Overview
| Part | Delivered |
|---|---|
| 1 | Project foundation, PostgreSQL/Prisma schema, seed data, internal catalog API |
| 2 | Shopify + WooCommerce import and synchronisation engine |
| 3 | Admin panel (password login, products, categories, sources/sync, settings) |
| 4 | Customer catalog (2 designs), product detail + gallery/lightbox, wishlist, WhatsApp enquiry, performance work, tests, documentation |

## 2. Architecture
```
Shopify  ──┐                                          ┌──────────────┐
           ├─ adapters ─> NormalizedProduct ─> Sync ─>│  PostgreSQL  │<── Admin panel (server actions + services)
WooCommerce┘  (only code that knows their formats)    │  (Prisma)    │
                                                      └──────┬───────┘
                                       lib/catalog/queries.ts (ONE query layer)
                                 ┌────────────────────┴─────────────────────┐
                        /api/v1/* (JSON API)                 Server Components (SSR pages)
                        used by wishlist, "load more"        designs/grid  or  designs/showcase
                                                             chosen by Client.activeDesign
```
* Customers **never** call Shopify/WooCommerce. They only read our database, so the catalog keeps working when a store is down.
* Pages and API share one query layer, so every design and the API always agree.
* A tagged data cache (`unstable_cache`, 60 s, tag `catalog`) is cleared (`invalidateCatalog()`) after every admin edit, sync or cron run, so changes appear immediately.
* Designs only *present* data (`designs/<key>/{Shell,Home,Detail,Card}`); the backend is not duplicated. A new design = a new folder + one line in `designs/registry.ts`.

## 3. Tech stack
Next.js 15 (App Router, React 19, Server Components) · TypeScript (strict) · Tailwind CSS · Prisma 6 + PostgreSQL · zod · `next/image` · Node's built-in test runner (`tsx --test`) · Vercel (hosting + cron).

## 4. Folder structure
```
app/                 pages and routes
  page.tsx           customer home (category / search / sort / filter via URL)
  p/[slug]/          product detail page
  wishlist/          wishlist page
  admin/             admin panel (login + panel pages + server actions)
  api/v1/            public internal API      api/admin/  protected admin API      api/cron/  scheduled sync
designs/             grid/ and showcase/ (Shell, Home, Detail, Card) + registry.ts + types.ts
components/shop/     shared customer UI: Gallery(lightbox), Buttons, Lists(wishlist/enquiry panels), MoreProducts, WhatsAppButton, SafeImage
components/admin/    admin UI
lib/catalog/         queries.ts (single query layer) + cached.ts (tagged cache)
lib/sync/            Shopify/Woo adapters, normaliser types, sync engine
lib/admin/           validators + services (products, categories, settings, sources)
lib/whatsapp.ts      pure WhatsApp URL/message builder      lib/shop.ts  page helpers
prisma/              schema.prisma, seed.ts                 tests/  integration tests
scripts/             sync CLI, env checker                  vercel.json  cron + framework
```

## 5. Database structure
`Client` (name, slug, domain, `whatsappNumber`, `activeDesign`, currency) → `Source` (SHOPIFY / WOOCOMMERCE / MANUAL), `Category` (tree via `parentId`, `sortOrder`, `isVisible`), `Product` (sku, slug, price, compareAtPrice, stockStatus, stockQty, `thumbnailUrl`, `contentHash`, `manualOverrides`, unique `(sourceId, externalId)`), `ProductImage`, `Variant`, `SyncRun`, `SyncError`.
Every row belongs to a `Client`, so the same platform can serve other clients later (one deployment per client, or several clients by custom domain).

## 6. Internal API
Public, read-only, no login (`/api/v1`):
| Endpoint | Purpose |
|---|---|
| `GET /config` | name, WhatsApp number, active design, currency |
| `GET /categories` | visible categories, tree-ordered, with `productCount` / `totalCount` |
| `GET /products?category=&q=&inStock=&minPrice=&maxPrice=&sort=&cursor=&limit=` | list, search, filter, cursor pagination (minimal card payload) |
| `GET /products/:slug` | full detail: images, variants, availability, metadata |
| `GET /products/:slug/related` | related products |
| `GET /products/by-ids?ids=a,b,c` | wishlist/enquiry: returns `items` (requested order) and `missing` (deleted/unavailable ids) |

Responses never contain Shopify/WooCommerce shapes. Errors are `{error:{code,message}}`, never raw server text.

## 7. Shopify integration
Adapter: `lib/sync/adapters/shopify.ts`. Uses the Admin API with an access token (custom app, scope `read_products`, Link-header pagination) or, without a token, the public `/products.json` feed. Maps products, variants, images, `product_type` (as the category), prices, compare-at price and stock into the normalised format.

## 8. WooCommerce integration
Adapter: `lib/sync/adapters/woocommerce.ts`. REST API v3 with consumer key/secret (WooCommerce → Settings → Advanced → REST API, read permission; site must be HTTPS). Maps products, variations, category hierarchy, sale price and stock status.

## 9. Sync process
### Connect your stores
Put values in `.env` (see `.env.example`) **or** store them per source via the API (secrets are masked when read back):

```bash
# Shopify: Admin API token (custom app, scope read_products). Without a token the public /products.json feed is used.
curl -X POST $URL/api/admin/sources -H "Authorization: Bearer $ADMIN_PASSWORD" -H "content-type: application/json" \
  -d '{"type":"SHOPIFY","name":"Shopify","credentials":{"shopDomain":"my-store.myshopify.com","accessToken":"shpat_..."}}'
# WooCommerce: WooCommerce > Settings > Advanced > REST API (read key). Site must be HTTPS.
curl -X POST $URL/api/admin/sources -H "Authorization: Bearer $ADMIN_PASSWORD" -H "content-type: application/json" \
  -d '{"type":"WOOCOMMERCE","name":"Woo","credentials":{"siteUrl":"https://shop.example.com","consumerKey":"ck_...","consumerSecret":"cs_..."}}'
```
`npm run db:seed` also creates one placeholder source per platform (filled from the env vars if set).

### Trigger import / sync (also available as buttons in the admin panel)
All admin API calls need `Authorization: Bearer $ADMIN_PASSWORD` (scripts) or the admin session cookie from the Part 3 login (browser).

| Call | Purpose |
|---|---|
| `POST /api/admin/sync` body `{"type":"SHOPIFY" or "WOOCOMMERCE" or "ALL","trigger":"import" or "manual"}` | import or sync by platform |
| `POST /api/admin/sources/:id/sync` | sync one source |
| `GET /api/admin/sources` | sources, product counts, last sync time/status |
| `GET /api/admin/sources/:id/runs` | sync history with per-product errors |
| `PATCH /api/admin/sources/:id` | update name / credentials |
| `GET /api/cron/sync` (`Bearer $CRON_SECRET`) | scheduled sync of all sources (daily via `vercel.json`) |
| `npm run sync -- [sourceId or all] [--import]` | CLI equivalent |

The first run of a source is the import; later runs are synchronisations (same engine, no duplicates).

### Safety guarantees
- The whole catalog is fetched **before** anything is written: an outage, bad credentials or half-finished pagination change nothing and are recorded as `FAILED` (`lastSyncAt` keeps the last *successful* time).
- A source suddenly returning 0 products for a known catalog is refused.
- One transaction per product: a bad product can't half-update itself or affect others (status `PARTIAL`, error stored in `SyncError`).
- Identity is `(sourceId, externalId)`: re-runs never duplicate. Unchanged products (content hash) aren't rewritten.
- Products removed at the source are hidden (`isActive=false`), never deleted, and reappear automatically.
- Admin edits are protected: set `Product.manualOverrides = {"price": true}` (fields: name, description, price, compareAtPrice, stockStatus, stockQty, sku, category, images, variants, metadata, isActive) and sync leaves them alone. The Part 3 product editor sets this automatically for the fields you change.
- Missing images give `thumbnailUrl = null`; out-of-stock products and empty categories flow through the Part 1 API unchanged.
- One run per source at a time; stuck runs are closed after 15 minutes.


## 10. Admin panel usage
Open `/admin` and sign in with `ADMIN_PASSWORD`.
| Area | What you can do |
|---|---|
| Dashboard | counts, source status, recent syncs, setup warnings |
| Products | search/filter/paginate; create, edit, delete; price, availability, stock, description, SKU, category/subcategory, images, variants, metadata, visibility; see source + product URL |
| Categories | tree, create/edit/delete, subcategories, show/hide, move up/down (all reflected on the customer site immediately) |
| Sources / Sync | import and sync Shopify/WooCommerce, status, history, per-product errors, "credentials missing" messages |
| Settings | catalog name, **WhatsApp number**, **active design**, custom domain |

Editing a synced product locks the changed fields so the next sync keeps your edits (unlock on the product page). Secrets are only ever read from environment variables; the UI shows whether they are present, never their values.

## 11. Customer catalog usage
* `/` : browse. Category chips/tree (with subcategories), search box, sort, "in stock only". First 24 products are server-rendered; more load automatically while scrolling (or via a button).
* `/p/<slug>` : product detail: name, price, availability, SKU, category, description, variants, image gallery with thumbnails and **lightbox** (keys ← → Esc, swipe), related products, wishlist, WhatsApp.
* `/wishlist` : saved products. No login anywhere.
* Missing image → neat placeholder. Out of stock → badge, still viewable. Empty category / no search results → helpful empty state. Unknown product → friendly "not available" page. Server problems → friendly retry page (never raw errors).

## 12. Design switching
Admin → **Settings → Active design** (`grid` or `showcase`). The next customer page load uses it (cache is cleared on save).
* **Design 1 "Grid"**: sticky header with search, category *chips*, 2–4 column square-image cards, product page with image on top and thumbnails below, big green WhatsApp button, related as a card grid.
* **Design 2 "Showcase"**: editorial serif masthead, persistent category *tree sidebar* (collapsible on mobile), wide *row* cards, split product page with *vertical* thumbnails and a *sticky* info panel, related as an image-tile strip.
Both use the same API, database, wishlist and WhatsApp code. To add Design 3: create `designs/<key>/` exporting `{Shell, Home, Detail}`, register it in `designs/registry.ts` and `lib/designs.ts`.

## 13. Wishlist
Stored in the browser (`localStorage`, key `cm:wishlist:v1`), no account needed. Add/remove with the heart, view at `/wishlist`, survives refresh and switching designs. The page resolves ids through `GET /products/by-ids`; deleted or unavailable products are reported ("no longer available") and can be removed with one click.

## 14. WhatsApp enquiry
Standard click-to-chat `https://wa.me/<number>?text=<url-encoded message>` (opens the WhatsApp app on phones, WhatsApp Web on desktop).
* **Single product**: "Enquire on WhatsApp" on the product page.
* **Multiple products**: "+ Enquire" on any card builds a selection; a bar appears → review panel (remove individual items) → **one** message listing every product:
```
Hi, I am interested in the following products:
1. Blue Rug - https://your-site.com/p/blue-rug
2. Silk Runner - https://your-site.com/p/silk-runner
Please share more details and pricing.
```
* The number comes from **Admin → Settings** (database), never from code. No number → "enquiries are not set up yet" message; nothing selected → "select at least one product". The link is built at click time with the real site origin. Logic: `lib/whatsapp.ts` (unit-tested).

## 15. Speed (the primary goal)
Server Components + SSR (minimal client JS: only wishlist/enquiry/gallery/load-more are client components, ~118 kB first-load JS on catalog pages); `next/image` (AVIF/WebP, responsive `sizes`, lazy loading, priority for the first row, placeholders); skeleton loading states; list payload has no description/images/variants (denormalised `thumbnailUrl`); **cursor pagination** (never OFFSET, never "load everything"); indexed queries through one Prisma query layer; tagged data cache + `Cache-Control: s-maxage, stale-while-revalidate` on API reads; plain GET forms for search/sort (work without JavaScript); product links use normal navigation with a loading skeleton.

## 16. Environment variables
See `.env.example` (placeholders only). Required: `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD`, `CRON_SECRET`, `DEFAULT_CLIENT_SLUG`. Optional: `WHATSAPP_NUMBER` (seed only), `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN`, `WOOCOMMERCE_SITE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`. `npm run check:env` verifies them (names only). Never commit `.env`.

## 17. Setup on Windows / VS Code
1. Install **Node.js 20 or 22 LTS** and **PostgreSQL 16** (or use a free Supabase/Neon database, below) and **VS Code**.
2. Unzip, open the `Catalog-Maker` folder in VS Code, open a terminal (PowerShell).
3. Create the database (local): in *pgAdmin* or `psql` run `CREATE DATABASE catalog_maker;`
4. Copy the env file: `copy .env.example .env`, then edit `.env`:
   `DATABASE_URL` and `DIRECT_URL` = `postgresql://postgres:YOUR_PASSWORD@localhost:5432/catalog_maker`, `ADMIN_PASSWORD` = any long password, `CRON_SECRET` = any random text.
5. Install and create tables (first time only):
```powershell
npm install
npx prisma migrate dev --name init   # creates prisma/migrations (or: npx prisma db push)
npm run db:seed                      # demo client, categories and DEMO products (clearly labelled demo)
npm run dev                          # http://localhost:3000   admin: http://localhost:3000/admin
```
**Supabase instead of local Postgres:** create a project → *Project Settings → Database → Connection string*. Put the **pooler** string (port 6543, add `?pgbouncer=true&connection_limit=1`) in `DATABASE_URL` and the **direct** string (port 5432) in `DIRECT_URL`; then run the same `prisma migrate dev` / `db:seed` commands.
**Production build locally:** `npm run build` then `npm start`.

## 18. Requirement audit (honest status)
| Requirement | Status |
|---|---|
| Own PostgreSQL database + internal API; customers never hit Shopify/Woo | ✅ done |
| Shopify import + sync | ✅ implemented and tested against a **mock Shopify server** (pagination, tokens, changes, outages). ⚠️ **Not yet run against a real Shopify store** |
| WooCommerce import + sync | ✅ implemented and tested against a **mock WooCommerce server**. ⚠️ **Not yet run against a real store** |
| **50+ products from Shopify AND 50+ from WooCommerce** | ❌ **NOT done.** It needs *your own* store accounts. The integration is ready (tests import 55 mock products per platform to prove capacity), but no real Shopify/Woo products are in this project. The demo seed products are **fake demo data and are labelled as such**; they did not come from Shopify/Woo |
| Admin panel (CRUD, categories, sync UI, settings) | ✅ done and browser-tested |
| Two selectable designs, admin controls the active one | ✅ done (Grid, Showcase) |
| Product detail, gallery, thumbnails, lightbox, related | ✅ done |
| Wishlist (browser) | ✅ done |
| WhatsApp single + multi-product enquiry | ✅ done; URL/message tested, and the click was tested in a browser with `window.open` intercepted. ⚠️ Actually sending a message in the WhatsApp app was not possible in the test environment |
| Speed work (SSR, next/image, cursor pagination, caching, minimal JS) | ✅ done. ⚠️ Real-world speed (Lighthouse on the deployed site, real remote images) is not yet measured |
| Reliability (outages, missing images, out-of-stock, empty categories) | ✅ done and tested |
| Vercel-ready | ✅ build/config verified. ❌ **Not deployed** (waiting for your instruction). No live URL yet |
| Demo video of import/sync (if your assignment requires it) | ❌ your action: record it with your real stores |

## 19. Testing
`npm test` runs **40 tests** against a real PostgreSQL (`DATABASE_URL`) using throwaway clients and local mock Shopify/Woo servers: sync engine (13), admin auth/validation/services (9), WhatsApp URL/message (5), customer catalog queries + admin→customer propagation + outage resilience (13). `npm run lint` = TypeScript check. Browser checks (Playwright, 108 assertions on mobile 375 px / tablet 768 px / desktop 1280 px, both designs): no horizontal scroll, SSR, progressive loading, search/empty states, wishlist persistence, WhatsApp URL from the admin-set number, design switching, missing number, unknown product, admin API blocked for customers. Test commands never delete real data.

## 20. Security
Secrets only in environment variables (none in code, none in the client bundle, `.env` git-ignored, `.env.example` placeholders only). Admin: signed `httpOnly` `SameSite=Lax` cookie, middleware + per-route/action re-check, same-origin check on cookie mutations, generic login errors, rate limiting. Customer routes are read-only and need no auth; the public config exposes only name, WhatsApp number, design and currency. Input is validated with zod; Prisma parameterises all queries.

## 21. Deploying to Vercel (later)

> Everything below is preparation. Nothing has been deployed. Follow these steps when you are ready to go live.

### What is already prepared in the project
- `npm run build` = `prisma generate && next build`; `postinstall` also runs `prisma generate`, so the Prisma Client always exists on Vercel.
- `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in `prisma/schema.prisma` bundles the engine Vercel's serverless runtime needs.
- One shared `PrismaClient` (`lib/db.ts`); the database URL comes **only** from `DATABASE_URL`. No credentials are in the code.
- The build needs **no** environment variables and never touches the database.
- `vercel.json` only declares the framework and the daily sync cron (`/api/cron/sync`, 02:00 UTC).
- `.gitignore` excludes `.env*` (except `.env.example`) and `.vercel`.
- `npm run check:env` verifies your variables are set and not placeholders (prints names only, never values).

### 1. Put the project on GitHub
```bash
git init && git add . && git commit -m "Catalog Maker"
git remote add origin <your-repo-url> && git push -u origin main
```
Before pushing run `git status` and confirm no `.env` file is listed.

### 2. Create the PostgreSQL database
Any PostgreSQL works. Easiest on Vercel: **Storage / Marketplace -> Neon** (or Supabase). Create a database in a region close to your Vercel Functions region (for an Indian audience, Mumbai `bom1` for both is a good choice; set the function region under *Project Settings -> Functions*).

You need two connection strings:
| Variable | Which string |
|---|---|
| `DATABASE_URL` | the **pooled** string (Neon: host contains `-pooler`; Supabase: pooler port 6543 with `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | the **direct** (non-pooled) string. If your provider has no pooler, use the same value as `DATABASE_URL` |

### 3. Create the schema in the production database (once, from your own computer)
Use the **direct** URL and never run anything destructive.

**Recommended (versioned migrations)**
```bash
# 1. On your PC against a local/dev database, create the initial migration and commit it:
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "Add initial migration" && git push
# 2. Apply it to production (only adds what is missing, never drops data):
DATABASE_URL="<production direct url>" DIRECT_URL="<production direct url>" npx prisma migrate deploy
```
**Alternative for a brand-new empty database:** `npx prisma db push` (with the production URLs in your environment).

Never run `prisma migrate reset`, `prisma db push --force-reset` or `--accept-data-loss` against production. The Vercel build deliberately does **not** run migrations, so a deploy can never alter your database by itself.

Then create the client record (once). `npm run db:seed` is idempotent and non-destructive: it adds the demo client, categories and demo products only if missing. Without a client row the public API answers `503 not_configured`.

### 4. Import the project in Vercel
1. Vercel dashboard -> **Add New... -> Project** -> import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave Build/Install/Output commands at their defaults.
3. Add the environment variables below **before** the first deploy (Settings -> Environment Variables, enable Production and Preview as needed).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | pooled connection string |
| `DIRECT_URL` | yes | direct connection string (used by Prisma CLI) |
| `ADMIN_PASSWORD` | yes | long random value (`openssl rand -base64 32`) |
| `CRON_SECRET` | yes | long random value; Vercel Cron sends it automatically |
| `DEFAULT_CLIENT_SLUG` | yes | slug of the client the site serves (`demo` for the seed) |
| `WHATSAPP_NUMBER` | seed only | the live number is edited in the admin panel (stored in the database) |
| `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` | optional | or save credentials per source via `POST /api/admin/sources` |
| `WOOCOMMERCE_SITE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` | optional | same |

Run `npm run check:env` locally first. Any variable added or changed later needs a **redeploy** to take effect.

### 5. Deploy
Click **Deploy** (or push to `main`). Then verify:
```bash
curl https://<your-app>.vercel.app/api/v1/config
curl https://<your-app>.vercel.app/api/v1/products?limit=2
curl -H "Authorization: Bearer $ADMIN_PASSWORD" https://<your-app>.vercel.app/api/admin/sources
```
Import your stores with `POST /api/admin/sync` (see Part 2 above).

### Notes
- **Scheduled sync:** Vercel Cron runs once a day on the Hobby plan; change the schedule in `vercel.json` on paid plans. Cron only runs on the production deployment.
- **Function time:** sync routes declare `maxDuration = 300` seconds. If your plan allows less, lower it in `app/api/admin/sync/route.ts`, `app/api/admin/sources/[id]/sync/route.ts` and `app/api/cron/sync/route.ts`.
- **Custom domain:** add it under *Settings -> Domains*. For a single client nothing else is needed. For multi-client, set `Client.domain` to the hostname.
- **Images:** `next.config.mjs` allows remote https images for optimisation. Restrict `remotePatterns` to your real image hosts before launch.

### Troubleshooting
| Symptom | Fix |
|---|---|
| `Prisma Client could not locate the Query Engine` | confirm `binaryTargets` is in the schema and the build ran `prisma generate` (clear build cache and redeploy) |
| `Too many connections` / timeouts | `DATABASE_URL` must be the pooled string |
| `503 not_configured` from `/api/v1/*` | no `Client` row with `DEFAULT_CLIENT_SLUG` yet: run the seed, or insert one |
| `503` from `/api/admin/*` or `/api/cron/sync` | `ADMIN_PASSWORD` / `CRON_SECRET` not set in Vercel |
| `prisma migrate deploy` asks for `DIRECT_URL` | set `DIRECT_URL` in your shell (same as `DATABASE_URL` if no pooler) |


## 22. Known limitations
* No real Shopify/WooCommerce data yet (see audit); no `prisma/migrations` folder is shipped: create it once with `npx prisma migrate dev --name init` (or use `db push`).
* Wishlist/enquiry are per browser/device (by design: no login).
* A product page for a removed product shows a friendly "not available" page with HTTP 200 (streamed page; marked `noindex`).
* Search is a simple case-insensitive token match over name/SKU/description (fine for hundreds to low thousands of products; add PostgreSQL full-text/trigram for much larger catalogs).
* Admin login rate limiting is best-effort on serverless. Use a long random password.
* The catalog cache lasts up to 60 s on its own; admin saves and syncs clear it immediately.

## 23. Demo instructions for the examiner
1. `npm run dev`, open `/` (customer) and `/admin` (log in).
2. Admin → Sources → import Shopify/WooCommerce (needs credentials) or browse the demo products.
3. Admin → Settings: set the WhatsApp number and choose **Showcase**; reload `/` to see the other design.
4. On `/`: search, open a category, scroll (more products load), open a product, open the lightbox.
5. Tap the heart on two products, open `/wishlist`, refresh (they persist).
6. Tap **+ Enquire** on three products → review panel → remove one → **Enquire on WhatsApp**: one pre-filled message with the remaining products.
7. Admin → edit a product's price/availability or hide a category, reload `/`: the change is visible immediately.
