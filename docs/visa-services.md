# Visa Services workspace

Production address: https://visaservices.sgcnetwork.co.za/

The existing `sgc-customer-websites` Cloudflare Worker serves the four explicitly allowed assets from the repository's `visaservices/` directory on SGC's GitHub Pages origin. Existing DJP, Al-Habib, Higher for Purpose and generic website routes retain their existing behavior. No ChatGPT hosting or authentication is used by this deployment.

## Data and sign-in

Public visitors can explore fictional sample data. Saving records or downloading documents requires the existing SGC owner Supabase account (same account as DJP). An isolated tab session is refreshed through Supabase Auth; sign-out clears it. Database RLS and the private storage bucket enforce access independently of the browser.

`public.visa_service_records` stores enquiries, quotations, invoices, expenses and document metadata, with a business key constrained to GVM, GVS, VL or GovDocs. `visa-service-documents` is a private bucket with a 10 MB file limit and approved MIME types. Paths begin with the business key. No real DJP data is copied or modified. Local preview test records from the original portal were not copied.

Accounting remains a demonstration of gross ZAR invoices, paid/unpaid tracking, expenses and cash summaries; it does not integrate bank feeds, payroll, VAT filing or QuickBooks.

## Build and deploy

From `visaservices/`: `npm ci` then `npm run build`. Commit the source, package lock and built `app.js` / `style.css`. GitHub Pages publishes the static directory; the existing Cloudflare Git deployment publishes `cloudflare/website-router.js` using its existing configuration. No DNS change is required for the existing wildcard route.

The applied database schema is recorded in `supabase/sql/visa-services-workspace.sql`. It was applied remotely with migration name `visa_services_workspace`; do not replay it.

## Verification

- Static bundle build and Worker syntax check passed.
- Four new routing tests passed, including isolation, credential stripping, asset MIME types and existing DJP/CFHP route preservation.
- Two existing Cloudflare routing tests passed. The broader legacy publishing file has unrelated failures in the existing storefront renderer (null product selector and an outdated `innerHTML` assertion); its renderer was not changed.
- A rolled-back live database test verified owner insert/read/update and storage metadata access, denied other accounts, and confirmed anonymous read privileges are absent and the bucket is private.
- Browser preview verified dashboard rendering and the SGC owner sign-in gate. An authenticated browser upload/download still requires the owner's normal sign-in.
