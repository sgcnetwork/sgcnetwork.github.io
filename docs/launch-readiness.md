# SGC launch implementation tracker

Updated 19 October 2026. Status refers to the named checks, not blanket production readiness.

| Feature | Status | Evidence / remaining checks |
| --- | --- | --- |
| One storefront renderer for every builder preview and published pages | TESTED — WORKING | DOM integration test compares the exact markup; dedicated preview accepts parent messages only; mobile uses the iframe viewport. Visual browser QA outstanding. |
| Consistent fonts, menu, logo, announcement, header media and colours | TESTED — WORKING | Shared-renderer integration tests; publication allowlist migration applied and verified in the database. |
| Persistent base fields plus section preferences | TESTED — WORKING | Base form fields saved atomically with preferences; unit coverage of database save calls, merge rules and retries. Real account logout/login journey outstanding. |
| Prevent conflicting saves overwriting another editor | TESTED — WORKING | Independent edits merge; overlapping changes show a conflict; saves use a row-version condition and a serial queue. |
| Product variant media, price and description | TESTED — WORKING | Existing product-media, catalogue and purchase tests pass against shared renderer. |
| Subdomain router product assets and media/font security policy | IMPLEMENTED — NOT TESTED | Automated router tests pass. Requires actual Cloudflare deployment and anonymous customer-subdomain verification. |
| Cart, multi-item checkout, persistent orders and owner status updates | TESTED — WORKING | Model, Edge and rolled-back SQL tests pass: quantities, variants, retries, server prices, stock, cancellation and ownership. Browser acceptance and frontend deployment pending. Checkout records unpaid orders; card/payment collection remains a separate integration. |
| Dashboard memberships, Library and Website Builder entitlements | TESTED — WORKING | Joining fee, Academy and builder shown separately; demo access preserved; billing includes builder expiry; locked states covered by UI tests. Download delivery still under review. |
| Academy, submissions, progress and two-module monthly access | IN PROGRESS | Release/RLS tests pass; direct completion bypass blocked; video-field fallback and lesson resume repaired. Practical assessment workflow still to verify. |
| SGC shop, checkout, digital delivery and bookings | NOT STARTED | Existing implementations to inspect and verify. |
| Admin Studio integration and reports | NOT STARTED | Existing implementations to inspect and verify. |
| Community, messages, media and permissions | NOT STARTED | Existing implementations to inspect and verify. |
| Full customer/admin acceptance journeys | NOT STARTED | No blanket launch-ready claim. |

## First repair set

Problem: editor and public renderers differed, base settings and preferences were saved separately, custom menu styles targeted obsolete spans, and the customer router did not serve required product assets.

Changes: `builder-draft-store.js` reconciles and saves drafts; `builder-live-preview.js` embeds `builder-storefront-preview.html`, which runs the same `business.js` and styles as public storefronts. Existing legacy hooks remain hidden for editor compatibility. Appearance fields are explicitly included by `supabase/sql/builder_preview_parity.sql`; draft-only and protected download fields remain excluded. Customer inventory and gateway configuration are unchanged by this set.

Tests: 43 Node/JSDOM checks pass, including renderer parity, parent-message isolation, blank headline handling, variant selection, draft merge/conflict/retry, catalogue, payment validation, publication and router checks. The old publishing fixture now loads the media/purchase dependencies used by the real public document. Browser navigation limitations in JSDOM are not real-browser verification.

Deployment: appearance projection migration applied to the existing Supabase project and tested with a synthetic composite record (no customer records changed). Frontend and Worker deployment tracked in PR #8. Cloudflare account deployment remains unverified.

## Cart and order repair set

The old Buy now action generated a contact enquiry. The existing `sgc_builder_orders` and `sgc_builder_order_items` tables now support atomic multi-item orders, a checkout retry key, customer fulfilment details and server-owned pending payment state. SQL recalculates all prices from the published snapshot, serialises stock updates, and applies inventory changes to published and draft stock. Owner-only completion/cancellation runs through the authenticated Edge action; cancellation returns stock once. A receipt key exposes only order reference, items, totals and statuses.

`storefront-cart.js` persists carts independently per customer subdomain. Uncertain network outcomes retain the same key and lock cart edits until confirmation; preview checkout sends no order. `business.js` renders cart, checkout, order history and search through the same public/preview document. Owner reports include customer details, variant lines, payment state and fulfilment actions.

Tests: 52 Node/JSDOM checks pass; `tests/builder-checkout.sql` passes in an explicit transaction that rolls back every fixture. Tested server totals, missing variants, duplicate retries, stock decrement, oversell rejection, cross-owner denial and idempotent cancellation/restocking. The additive SQL migration and existing `website-publication` Edge Function v2 are deployed. No gateway provider, credentials or live financial settings changed; payment collection and paid digital delivery remain outstanding.

## Dashboard and Academy access repair set

Replaces the misleading joining-fee Academy unlock state with separate Academy and Website Builder subscription states. Adds a My Web Build card, verified published-site link and builder access expiry in billing. Removes a reference to a missing `js/demo-access.js` file; the existing authenticated demo RPC remains authoritative.

The Academy now checks one authenticated release summary. General Academy content needs an active qualifying Academy membership or grant; two modules release each membership month, up to twelve. Paid kit access and the verified demo/admin paths are preserved. Expiry is enforced in lesson/resource RLS. A trigger prevents direct student writes changing completion; existing quiz and completion RPCs retain that authority. SQL fixtures verify entry-only denial, active access, month-two release, expiry, notes and completion protections with actual authenticated role impersonation.

The player previously ignored the `video_url` stored on all 27 currently published lessons; it now loads it when no settings override exists. Saved lesson position and My Library lesson links restore the selected available lesson, while quiz progression remains gated and results stay on My SGC. Actual video availability at each external URL still requires browser playback testing.
