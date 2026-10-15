# Customer website publishing

The builder can publish a separate, public snapshot of its saved design. Draft changes remain private until republished. The public URL is `https://sgcnetwork.co.za/published-site.html?site=<slug>`. The prepared Cloudflare Worker adds `https://<slug>.sgcnetwork.co.za` after account-side deployment and DNS activation.

## Implemented

- Publish latest saved design, read publication status and unpublish with a Yes/No dialog.
- Service-authenticated publishing: Edge Function validates the user's access token with `getUser`. The user ID is never accepted from the request body. Database functions are service-role only, security invoker, empty search path.
- Snapshots are stored in private `sgc_private.website_publications`, with RLS and no client table privileges. Draft website RLS is retained.
- R150 verified entry plus an active, unexpired R199 builder subscription is required; existing demo entitlement is also supported. Publishing and every public lookup check current entitlement. Unpublish is available even after expiry.
- Public projection excludes hidden products/services, custom-code notes, customer records, digital-file paths and downloads. Public pages render text safely and accept only HTTPS image/external URLs.
- Business name, description, theme/font, logo, announcement, navigation, homepage copy, products and variants, services, about/team, gallery, news, media links and contact/social links.
- Contact, email and booking links are usable; product orders use enquiries. Online checkout, order processing and paid digital delivery are not implemented by this release.
- Share links use the published main-domain URL, so they do not depend on pending subdomain routing.

## Deployment

Supabase migration: `website_publication_snapshots`. Edge Function: `website-publication` v1. The public GET endpoint intentionally permits anonymous visitors. POST independently validates the supplied user JWT before calling the service-only publish function. No secret appears in the repository, browser or Worker.

GitHub Pages serves `published-site.html`, `business.js`, `business.css` and `builder-publishing.js`. Existing `business.html` homepage redirect is preserved.

Cloudflare account login could not be completed by the remote browser. Its Worker and wildcard DNS have **not** been deployed by the assistant. Nameserver activation was pending in the owner's latest screenshot.

### Cloudflare account steps

1. When `sgcnetwork.co.za` is Active, create a Worker named `sgc-customer-websites` under Workers & Pages. Use the existing Free plan; no paid upgrade is required by this implementation. Paste the complete module from `cloudflare/website-router.js` into its code editor and deploy.
2. Add a proxied DNS `A` record: name `*`, value `192.0.2.1`, TTL Auto. Do not replace the existing apex, www or email DNS records. This reserved placeholder is intercepted by the Worker, not used as a web server.
3. In the Worker's Settings → Domains & Routes, add a **Route** `*.sgcnetwork.co.za/*` for the `sgcnetwork.co.za` zone. Do not select Custom Domain for the wildcard. Route failure mode: **Fail closed** so requests do not bypass the router when its free limit is reached.
4. Confirm Cloudflare's edge certificate is active for `sgcnetwork.co.za` and `*.sgcnetwork.co.za`. Keep the existing main-site SSL mode secure; this change does not require disabling encryption.
5. Publish a permitted demo website through Website Studio. Verify both public URLs, product/service detail navigation, anonymous visibility, Unpublish returning 404, and the main website/www/email remaining unchanged. No customer site is published automatically by this release.

The Worker ignores reserved service hostnames, allows only its own public HTML/JS/CSS paths, never forwards visitor cookies/authorization to the main site, returns CSP/security headers and does not cache published availability. Subdomains do not use or read SGC sign-in sessions. Custom customer domains remain request-only and are not connected by this release.

## Validation

`node --test tests/*.test.cjs`: 21 tests passed, including six new publishing/router tests. `tests/publishing-access.sql` passed in rolled-back transactions, including under the actual `service_role`: paid-access enforcement, private-field exclusion, snapshot isolation, republish, expiry, unpublish and reserved hostnames. All fixture writes were rolled back. Security advisors show no new externally exposed publication table/function findings; the private RLS table intentionally has no client policies.

Release PR #6 was merged as `b94ca8ba50859f4b51bb04ab0bf486adfcdb5859`. GitHub Pages run `38728660754` completed successfully. The live public page successfully called the deployed service and displayed its expected unavailable response for a nonexistent site. The live builder enforced sign-in. A real signed-in Publish → anonymous page journey still needs live UI verification; subdomain verification requires the Cloudflare account steps above. Direct navigation to the Supabase endpoint was restricted by browser network controls; calling it from the site worked.

## Rollback

Revert only this release's builder/public/Worker files; retain payment changes. To stop publishing without deleting data, stop routing the Worker and revoke execution of the service-only publication functions from `service_role`. Retain private snapshots and existing drafts. No customer records need deletion.
