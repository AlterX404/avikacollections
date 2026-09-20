# Avika Collection

A multi-brand fashion storefront for **Lajpat Nagar, New Delhi, India**. English and INR are the initial defaults. Avika Collection is the retailer; the manufacturer's brand is a separate product field.

**Current release: working local sandbox, not approved for live trading.** No public deployment, live payment, email delivery, courier booking, or paid subscription has been activated. All sample brands are fictional and every sample product is blocked from real checkout.

## Open the store

- Storefront: http://localhost:5173/
- Sample management: http://localhost:5173/admin
- Store content and inquiries: http://localhost:5173/operations
- The development server must be running for these links to work.

On the local preview only, **Staff sign in** uses the starter's `local_seedy` test identity. This is not a production password or a production admin bypass. The mock authentication is excluded from production builds. `.dev.vars` permits this identity locally; never copy it into hosted production configuration.

## What's implemented

| Area | Current behavior |
| --- | --- |
| Storefront | Responsive home, catalog, category/brand filtering, search, size/color/price/availability filters, sorting, shareable filter URLs, 8-item pages, product details, image enlargement, size guide and related products |
| Catalog | Product and manufacturer brand displayed separately; published/draft/archived records; variant SKU, price and stock; original illustrative sample photography |
| Bag and wishlist | Persisted in SQLite/D1, owned by an HTTP-only guest cookie or sample account; guest records transfer to the sample account at sign-in |
| Sample checkout | Guest and signed-in checkout, Indian address validation, server totals, discounts, shipping/tax test settings, stable request keys and transaction-protected inventory |
| Payment simulation | Pending, successful, failed and canceled outcomes; duplicate event protection; no browser redirect marks an order paid; live products cannot enter this simulator |
| Sample accounts | Platform sign-in/out, profile and saved address, order history/details, tracking links, cancellation and return requests |
| Management | Owner and support roles; products/variants/images, stock and price changes, orders/fulfillment, requests/refunds, discount eligibility/expiry/limits, inquiries, homepage text/collection, policies and settings |
| Audit and reports | Changes are audited; reports use stored sample records, not invented activity. Overview is limited to the latest 200 orders |
| Uploads | Owner-only PNG/JPEG/WebP uploads, 5 MB limit, signature checks, random object names, R2 storage, safe response MIME type and no SVG/HTML |
| Contact | Inquiry form stores consented messages in the staff inbox. It does not send email |
| Supporting pages | About, contact, FAQ, shipping, returns, privacy, terms, not-found and recoverable error pages. Policies remain clearly marked drafts until replaced in settings |
| Shopify adapter | Server-only Storefront API catalog, cart create/update/remove, discount validation, INR normalization, persistent cart references, hosted-checkout handoff, hosted account/admin links; locally contract-tested, not connected to a real shop |

### External services and remaining work

The Shopify connector needs a real shop, a Headless channel private Storefront token, published products, payment-provider onboarding, shipping/tax configuration, customer-account configuration and end-to-end provider testing. Configure secrets in the local ignored `.dev.vars` or the hosting provider's secret manager, never in chat or tracked source.

Production customer authentication, payment verification, confirmation emails, real orders, shipment notifications, refunds, staff roles and commerce reports are delegated to Shopify's managed services. They are **not represented as live or verified by this preview**. Passwordless customer accounts are the recommended default; this app does not store customer passwords or card details.

Other release work: approved business contacts/policies and real catalog assets; manufacturer size/material/care content; SEO launch configuration (canonical domain, public sitemap, real-product structured data and review of indexing); accessibility audit beyond the recorded checks; production backup restore drill; abuse/load testing and operational monitoring. No analytics or newsletter signup is enabled. In connected mode the wishlist is currently tied to the browser's durable guest identity, not Shopify account identity; cross-device wishlist synchronization needs Customer Account API integration.

## Architecture

- React + TypeScript, Vinext and Vite; deployable Cloudflare Worker output.
- D1/SQLite with generated Drizzle migrations and raw prepared statements for runtime access.
- R2 for uploaded product images. Original demonstration assets are optimized local WebP files.
- Platform authentication for the local/sample operations console; explicit server-side owner/support allowlists.
- Shopify for production commerce. This keeps payment collection, inventory enforcement, real order state, refunds and account recovery in an established commerce platform instead of treating the sample engine as a payment processor.

The sample data model includes products, variants, carts/items, customers, wishlists, orders with immutable item snapshots, payment events, return/cancellation requests, discounts, settings, inquiries, audit records, a sample confirmation outbox and rate limits. Connected commerce uses separate provider-cart and wishlist tables. Shipment state and tracking are stored on each sample order; live shipments belong to Shopify. Currency amounts are integer paise.

## Install and run

Use Node 22.13+ (Node 26 was used for verification), npm, and a Windows/macOS/Linux shell.

```sh
npm run install:ci
npm run build
```

If the Windows npm launcher cannot locate its JavaScript entrypoint, use:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run install:ci
node scripts/run-framework.mjs build
```

Create an ignored `.dev.vars` with local sample configuration:

```ini
COMMERCE_MODE=sandbox
STAFF_USER_IDS=local_seedy
SUPPORT_USER_IDS=
LIVE_CHECKOUT_ENABLED=false
```

The Vite configuration loads this file only for development. It does not put these values in the production bundle. Hosted values must be configured separately.

### Database setup

After the build has created `dist/server/wrangler.json`, apply migrations **once, in order**, to a fresh local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_familiar_hairball.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_commerce_guards.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_melted_timeslip.sql
node scripts/seed-demo.mjs
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file db/demo-seed.sql
npm run dev
```

The delivered local database is already migrated and seeded. Do not replay schema migrations against it. `db/demo-seed.sql` is separate from schema migrations and uses `INSERT OR IGNORE`; re-running it does not erase orders or reset stock. Apply future schema changes through new migrations, not by editing migrations already applied. The custom transaction triggers in `0001_commerce_guards.sql` are intentional.

The preview uses `.wrangler/state` for durable local D1/R2 data. Keep the directory between sessions. Do not expose the development server beyond loopback: its sign-in is a deliberate local test mock.

## Managing the preview

1. Open `/admin`, choose **Staff sign in**, and enter the local test console.
2. **Products:** add a draft, enter the actual manufacturer brand, category and collection, save, add variants with distinct SKUs, sizes/colors, prices and stock, then publish. Upload only images you own or are permitted to use. The current environment keeps all these products as demo items.
3. **Orders:** select a stored order; after simulated payment, mark it shipped or delivered and add an HTTPS tracking link. Do not use a real shipping label for a sample order.
4. **Returns:** review cancellation/return requests. Approval records a simulated refund and restores sample stock once. This does not move real money.
5. **Discounts:** create or edit percentage codes with minimum spend, expiry, limit and active status. `DEMO10` gives 10% off sample bags of at least ₹1,000; `EXPIRED` exists to test rejection. They are not real promotions.
6. **Settings:** edit the announcement, featured collection, contact details and delivery information. The policy section replaces the draft pages with owner-approved text. Sample shipping is ₹99 or free from ₹2,999 after discounts; sample tax is 0%, which is a test value, **not a tax determination**.
7. **Inquiries:** review stored messages and mark them resolved. **Email outbox** shows sample confirmations only; no delivery occurs.
8. **Audit trail:** inspect who changed stock/prices, fulfilled an order, approved a refund, uploaded an image or updated settings.

Support identities can read the console, fulfill orders and handle inquiries. Owner identities can additionally edit catalog/settings/discounts, upload images and decide refund requests. All checks occur on the server. Production allowlist changes require deployment-secret access; log and review those changes through your hosting platform's access audit.

## Connecting Shopify without taking live orders

Keep `LIVE_CHECKOUT_ENABLED=false` throughout configuration and sandbox verification.

1. Obtain the owner's approval for a Shopify subscription, then create/configure the shop. No subscription was purchased by this build.
2. Install/configure Shopify's Headless channel. Create a **private Storefront API token**, with the catalog/cart scopes required by the queries in `lib/shopify.mjs`. Store it only as `SHOPIFY_STOREFRONT_TOKEN` on the server.
3. Set `COMMERCE_MODE=shopify`, the `*.myshopify.com` domain, API version `2026-07`, and the approved customer-account URL. If checkout/accounts use a custom domain, configure that exact host as `SHOPIFY_CHECKOUT_DOMAIN`.
4. Publish the real catalog to the Headless channel. Put the manufacturer's brand in Shopify's vendor field. Use product types Women, Men and Accessories for the default navigation, or adjust navigation to your actual categories. The collection names drive the home edit. Product option names Size and Color/Colour are recognized.
5. Tag demonstration products `demo` or `sample`; the adapter excludes those products and rechecks those tags before hosted checkout. It never sends local `DEMO-` orders to Shopify.
6. Configure Shopify's hosted customer accounts, order confirmations, return/cancellation practices, shipping zones, stock tracking, tax settings and chosen India-supported payment gateway. Verify all options with a provider test transaction. No particular gateway is asserted to be approved for your business.
7. Configure local content and inquiry staff identities and use `/operations`. Real product/order management opens Shopify administration from `/admin`. The local content console and sample orders do not control live Shopify orders.
8. Add approved contact and policy text in `/operations`. The handoff endpoint refuses checkout while required contact/policy fields are empty or the checkout flag is false.
9. Run the launch checklist below. Enable live checkout only after explicit owner approval. Provider cart mutations may create test carts during integration, but the hosted-checkout handoff remains disabled by default.

Shopify is the source of truth for live payment/order state. The app does not ingest live payment webhooks, duplicate payments into local orders, or trust a return URL as payment evidence. Payment-event retries and order notifications remain inside the configured commerce/payment services. Shopify's documented hosted-checkout flow: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage

The initial adapter supports up to 1,000 products and the first 100 variants per product, with at most 20 units per bag line. Extend provider pagination before using a larger catalog. Connected-cart and provider-error behavior needs real-provider sandbox verification. The local store simulator has no automatic pending-payment expiry; cancel pending sample orders explicitly to release their stock.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
node --test tests/commerce.test.mjs tests/shopify.test.mjs
node --test tests/api.test.mjs
npm run build
```

The API suite requires the running local demo and test owner. It deliberately creates sample orders, inquiries, image objects and audit records. It refuses non-loopback targets. Tests are not intended for a live Shopify store. Independent logic/database tests use temporary in-memory SQLite.

Coverage: integer money, taxes/shipping, minimum/invalid/expired/exhausted discounts, invalid addresses, unavailable variants, stock/price changes after quote, overselling, duplicate order keys, pending/paid/failed/canceled transitions, conflicting/duplicate payment events, refund restocking, immutable purchase snapshots, demo-only checkout guards, credential destination restrictions, provider errors, manufacturer brand normalization, unauthorized admin writes, CSRF, guest and account checkout, record transfer at login, fulfillment, cancellation/return review, saved profile and upload type checks.

## Deploy and operate

This repository has Sites-compatible Worker output, `DB` and `BUCKET` binding declarations in `.openai/hosting.json`, and generated migration artifacts. Public publication is intentionally pending approval. Reuse this source; do not create a second store with divergent records.

1. Build and inspect the output. Keep real secrets out of source and client assets.
2. Register a private hosted project after owner authorization of any costs. Provision D1 and R2 and configure verified staff identity IDs in server environment settings. Never set `local_seedy` as a production staff ID.
3. Apply the generated migrations through the hosting deployment flow. Initialize store settings separately using `db/store-settings.sql`, then replace its owner-review defaults through the protected operations console; **do not seed demo products into a real shop**. For a private sandbox deployment, demo seeding is an explicit separate step.
4. Configure Shopify in its test environment. The platform authentication dispatcher must strip user-supplied identity headers and inject verified identities; deploying this Worker directly behind arbitrary proxies without that authentication boundary is not supported.
5. Perform a private release smoke test, then obtain approval before enabling live payments, incurring charges or publishing publicly.
6. Point the approved domain at the host, verify HTTPS, update canonical metadata/sitemap/real-product structured data, and enable indexing only after removing drafts and checking every published route. The current release deliberately sends `noindex,nofollow` and disallows crawlers.

Logs currently capture server failures without printing credentials; add monitored alerts for sustained 5xx failures and commerce-provider errors before launch. Review D1/R2 usage and provider notifications. Enable hosting access logs and maintain an on-call owner/contact.

For backups, export D1 using the hosting platform/Wrangler and back up uploaded R2 objects and the source/migrations. Keep exports outside public assets and source control because they contain customer data. Back up live catalog/order data through the commerce provider's approved export/backup facilities. Take a backup before migrations. Test restoration into a **separate private empty environment**, run integrity and workflow checks, then document recovery time and retention. Do not overwrite a live database as a restore experiment. No production backup schedule or restore drill has been performed yet.

## Launch checklist

- [ ] Confirm exact business name, address, opening hours, phone, support email and any required business/tax identifiers; no unverified details are invented.
- [ ] Replace fictional manufacturers, photos, prices, stock and size/material/care data; confirm asset rights and any reseller claims.
- [ ] Owner/legal review of privacy, terms, delivery and returns; configure region-specific tax and payment practices.
- [ ] Approve service budget, configure hosted project, domain, secure secrets, staff identities and least-privilege permissions.
- [ ] Verify real provider sandbox checkout: guest/account, shipping/tax/discounts, success/failure/cancel/pending, out-of-stock, duplicate/retried events, confirmation email and refunds.
- [ ] Verify live account registration/sign-in/recovery, order history, tracking and enabled return workflow.
- [ ] Test mobile/keyboard/form errors, screen-reader paths, 200% text enlargement, contrast and image performance with final content.
- [ ] Complete real-product SEO, canonical/sitemap/indexing and policy consistency work.
- [ ] Set monitoring, abuse controls, retention, backup schedule and a successful isolated restore drill.
- [ ] Obtain explicit approval to publish publicly and enable live checkout.

## Recurring costs and dependencies

No charges have been incurred by this build. Prices below were checked on 20 September 2026 and are not a quote for the owner's business.

- Shopify Basic India: ₹1,994/month paid monthly, or ₹1,499/month equivalent when billed yearly. Additional staff accounts are not included in Basic; Grow lists up to five staff accounts and costs ₹7,447/month paid monthly or ₹5,599/month equivalent billed yearly. Choose a plan after confirming staff needs. Source: https://www.shopify.com/in/pricing
- Payment gateway processing charges and applicable Shopify third-party payment-provider fees are additional; they depend on provider/plan and approval. Source: https://help.shopify.com/en/manual/payments/third-party-providers
- Custom storefront Worker/D1/R2 hosting, domain registration, courier charges and optional email/backup/apps are separate. None is selected or purchased; confirm current pricing and limits before committing.
- Sample runtime dependencies are locked in `package-lock.json`. Production commerce depends on Shopify and the chosen provider; local persistence depends on D1/R2-compatible bindings and the platform authentication dispatcher.

See `HANDOFF.md` for the concise status and verification record.
