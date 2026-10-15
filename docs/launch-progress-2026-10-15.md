# SGC launch implementation — 15 October 2026

Status: approved backend fixes deployed; frontend changes remain in draft PR #4. The whole platform is not launch-ready.

## Baseline and rollback

Repository: sgcnetwork/sgcnetwork.github.io; CNAME confirms sgcnetwork.co.za.
Base: fa5a24ffe145075e5f218d510a718e463d012fe6.
Remote backup: backup/pre-launch-2026-10-15. Work branch: launch/2026-10-15.
Supabase: bxpexanyoyubxeqqlggh, ACTIVE_HEALTHY, PostgreSQL 17.
Recorded public columns/defaults, policies, functions, constraints, indexes, grants and non-internal triggers in a separate private structure snapshot. This is a schema inventory, not a full database/data backup. No customer data export was made.

## Implemented in the review branch

- Checkout excludes soft-deleted products and named membership plans before requesting a payment link.
- Signed and amount/link-checked R1, preview and legacy kit/lay-by payment events now update their tracked transaction. These events do not grant membership or claim digital fulfilment. Unknown/untracked references fail closed.
- Removed an unreachable legacy membership fallback that parsed a buyer UUID from merchant references; the earlier tracked membership branch remains authoritative.
- Payment logs no longer print complete webhook or token response payloads. Supabase imports in the two changed functions are pinned to 2.117.3.
- Shop refresh detects changes to category/settings, images and variants as well as product records. Existing active/deleted filters remain. A single dropdown outside-click listener replaces accumulating listeners during refresh.
- My SGC preserves a false demo-status result, correctly filtering locked modules. Removed its reference to the absent demo-access.js file.
- My SGC keeps quiz scores in Quiz Results and displays submission status with lesson notes.
- First incoming private message after an empty-inbox baseline now triggers the existing in-page alert. This is not push delivery while the app is closed.

Pages changed: shop.html, dashboard.html. Backend source: create-stitch-payment, rapid-task.

## Prepared access-control correction — not permanently applied

The current sgc_extra_student_can_read function contains a condition allowing the R150 entry purchase to satisfy build-level lesson entitlement. The proposed supabase/sql/launch_premium_lesson_access.sql removes that bypass while preserving entry lessons, demo access, existing entitlements and unlock timing.

Validated inside one transaction followed by ROLLBACK:
1. A non-demo student with a temporary R150 purchase retains entry lesson access and cannot access premium lessons.
2. A temporary active build membership grants premium access.
3. Expiring that membership removes premium access.

Post-test verification: zero fixture lessons, zero fixture transactions, membership table restored to its original zero rows, production function unchanged. No permanent database changes made. This script requires approval because the brief reserves security-sensitive changes for approval.

## Validation and its limits

Run: npm --prefix tests ci --ignore-scripts && npm --prefix tests test (Node 24).
15 tests cover existing builder catalogue workflows, dashboard lock/result/message behavior, shop presentation/deletion refresh, missing local assets and payment handler behavior.
Payment tests execute the actual TypeScript handlers using Node type stripping and mocked Supabase, Stitch and signature-verifier boundaries. They do not validate real Svix signing, deployed Deno behavior or payment-provider production readiness.
The local link traversal covers 17 reachable HTML pages. Live browser checks verified that the Business Kits catalogue loads anonymously, Academy routes signed-out visitors to login, Community requests sign-in and Website Builder denies signed-out access. No site-generated error appeared in the sampled shop console; an unrelated browser-extension error was present.

No charges, checkout links, customer messages, customer uploads or production deployments were created. Signed-in customer journeys A–G have not been fully run. Test fixtures existed only within the rolled-back transaction.

## Prioritised remaining work

1. Apply the reviewed premium entitlement correction and deploy payment handlers, then verify in the deployed runtime with signed sandbox events. Approval required for payment/security changes.
2. Align catalogue and legacy checkout pricing: live SGC Build is still R250/month; confirmed Academy Full Access is R450/month. R199 builder is absent from the product catalogue. No prices changed in this batch.
3. Verify Stitch production approval and recurring-payment capabilities with provider evidence. Existing code creates payment links and ignores non-PAID events; it does not establish automatic recurring mandates, cancellation, refund or failed-renewal workflows. Do not advertise automatic billing as complete.
4. Implement verified builder-subscription activation independently of Academy Full Access and require the entry purchase. Existing website-subscription RLS checks active/expiry status but does not enforce the entry purchase itself.
5. Implement public customer-site publication using versioned public snapshots and an SGC path-based address first; current builder has private previews only. Subdomains need DNS/hosting configuration. Protect private draft settings, digital paths and tenant data; do not publicly expose the draft JSON.
6. Finish customer storefront checkout/orders/digital delivery, enquiry forms, domain verification and remaining content section CRUD. The existing builder audit documents prior partial implementation.
7. Complete shop variants, combined-order cart, discount redemption, order history and protected digital fulfilment. Existing shop cart checks out individual kits; standard kit variant checkout is explicitly unfinished.
8. Review Academy content availability using sgc_extra_lessons (28 existing rows), rather than assuming the empty legacy lessons table means no content. Verify videos/resources and optional quiz progression with a signed-in student/admin.
9. Complete Admin Studio end-to-end product lifecycle, reporting, bookings/calendar, community moderation and messaging tests with authorised test sessions. Existing delete RPC already soft-deletes and disables linked kits; do not replace it without reproducing a remaining failure.
10. Review security advisor findings function by function. RLS is enabled on all listed public tables, but that alone does not prove correct authorisation. SECURITY DEFINER warnings require call-site and grant review; do not indiscriminately revoke functions used by the app. Leaked-password protection is currently disabled.
11. Finish mobile visual QA, keyboard/accessibility checks and supported notification delivery. Current service worker only installs/claims clients; it does not provide offline caching or background push.
12. Run journeys A–G with sandbox payments, renewal/cancellation/expiry cases, tenant isolation and real Storage API checks before launch approval.

## Release plan

Keep this branch isolated until reviewed. Merge frontend changes only after browser QA of the branch preview. Deploy each Edge Function separately from GitHub Pages. Apply the access correction explicitly and verify entry-only/active/expired cases again. Revert changed frontend files to the recorded base for rollback; restore the recorded original function for a database rollback, preserving all customer data.

## Approved backend deployment — 15 October 2026

The owner approved applying the premium-access correction and deploying the payment fixes. Supabase migration launch_premium_lesson_access succeeded. create-stitch-payment version 31 and rapid-task version 30 are ACTIVE; downloaded deployed source exactly matches the tested source in the review branch. Existing verify_jwt=false settings are preserved: checkout performs its own user checks and the webhook verifies Svix signatures.

Post-deployment checks passed against the installed database function: entry lesson allowed, entry-only premium denied, active premium allowed, expired premium denied. Fixtures were rolled back; zero fixture lessons/transactions remain and membership row count is unchanged. The entry-to-premium bypass is absent from the installed function.

Live HTTP smoke checks: checkout OPTIONS 200; checkout GET 405; unauthenticated product checkout POST 401; unsigned webhook POST 400. No payment link or real charge was created. All 15 local regression tests passed again before deployment. Security advisors were retrieved after deployment; the pre-existing advisor findings still require a broader review. Real signed sandbox events, provider approval and complete customer journeys remain outstanding.

This note supersedes the earlier pending-backend-deployment statements. Shop/dashboard frontend changes have not been merged or deployed. Pricing, recurring billing, builder publication and other remaining work are unchanged.
