# Avika Collection handoff

**Status: local working sandbox with a coded Shopify connection; not production-ready or publicly launched.**

Confirmed business location: Lajpat Nagar, New Delhi, India. Defaults: English, INR, India-only initial delivery, clothing and accessories. Exact address/contact data and actual brands/products are intentionally not fabricated.

## Implemented and checked

- Fashion storefront, catalog filters/search, product variants and stock, persistent bag and wishlist, responsive layout and visible keyboard focus.
- D1-backed product, order, customer, inquiry and management records; secure server-side owner/support access checks.
- Sample checkout, immutable purchased-item snapshots, atomic inventory reservation, retry-safe checkout, payment-event deduplication, separate payment/fulfillment/cancellation/refund states and refund inventory restoration.
- Management of products/images/variants, orders/fulfillment/tracking, discounts, cancellation/return review, inquiries, homepage settings and policy copy; audit trail and record-derived reports.
- 18 independent money/database/provider-contract tests; an end-to-end local API suite; TypeScript checks; production compilation.
- API suite includes guest/account checkout, CSRF and authorization rejection, invalid/expired discounts, pending/success/conflicting payment outcomes, duplicate events, fulfillment, return/refund, profile, safe image upload and guest-account transfer.
- Final manual browser checks: search returned the expected linen shirt; size selection enabled add-to-bag; bag persisted after navigation and quantities recalculated; phone-width checkout created an order; successful simulation showed the confirmed state; staff sign-in opened product management. Phone-width management overflow was fixed and rechecked. Desktop images loaded, and Tab reached the visible skip link. WebMCP search accepted valid input and rejected invalid input.
- Final local checks: all 18 independent tests and the API suite passed, TypeScript passed, production build passed, `robots.txt` and the empty preview sitemap returned 200, and an unknown page returned 404. These checks are not a certification of accessibility or production readiness.

## Demonstration only

- Four fictional products and labels, original AI-generated illustrative imagery, sample INR prices, shipping, tax and return rules.
- Local test staff/customer identity through the development sign-in simulator.
- Payment success/failure/pending/cancel and refunds are simulations. Messages are stored in a sandbox outbox, never emailed. No courier is booked.
- Test-created records appear in the administration area; they are actual stored sample records, not business activity.

## Coded but awaiting external verification

The Shopify adapter reads catalog/vendor/variants, manages a provider cart and discounts, and redirects to hosted checkout only behind the server checkout flag and contact/policy checks. It uses a private server token and validates checkout hosts. Its contract/error tests pass, but there is no real shop credential, provider payment test, verified email delivery, or verified customer-account/return configuration yet.

Hosted accounts and administration are used for live commerce. Live wishlist records are currently browser-linked; account-linked cross-device wishlist sync is additional integration work. The current demo remains excluded from indexing. Canonical URLs, final sitemap, real-product structured data, final content/accessibility review, monitoring and recovery verification are part of the release work before public launch.

## Owner inputs needed before launch

1. Actual product catalog and permitted photographs, manufacturer brands, prices, SKUs, stock and manufacturer size/care data.
2. Exact business address/contact details and reviewed shipping, returns, tax, privacy and terms content.
3. Approved commerce/hosting budget, domain and securely configured provider credentials. Do not paste secrets into chat.
4. Explicit approval before live payments, paid service commitments or public publication.

The local store can be explored now at http://localhost:5173/ while the development process is running. Full setup, staff instructions, migrations, deployment steps, backup approach and cost sources are in `README.md`.
