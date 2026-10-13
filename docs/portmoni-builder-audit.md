# SGC Website Builder — first implementation stage

Reference inspected using the owner's authenticated Portmoni account on 13 October 2026. No Portmoni records, subscription or payment settings were changed. This is an initial audit and catalogue implementation, not a claim of complete Portmoni parity.

## Rollback and scope

Development branch: `builder/portmoni-rebuild-20261013`.
Base commit: `f7e425654ce7bb6b28d0b084cc32b020146cebe6`.
Only `website-builder.html` is modified among existing pages. Added catalogue, preview, test and documentation files are independent of Academy, Community, Shop, payments and the main SGC Studio.

Existing catalogue data remains in `sgc_student_websites.builder_preferences`; existing ownership RLS and subscription/demo entitlements are reused. Existing catalogue rows are not migrated or deleted. No persistent Supabase migration has been applied.

## Observed reference behavior

The Portmoni dashboard reports its public page as deactivated. Private editor and preview remain accessible. Products and Services have no existing items in this account. Event management contains an existing event; it was viewed without modification.

- Products: name; rich description; visibility; price blank for Ask for details; sale/compare-at price; physical/digital type; weight; SKU and stock; custom customer details; categories; pictures; product options; SEO title, description and URL. Options hide base inventory controls. Accessing picture/option management on an unsaved item requires a valid name and can save the item; no such reference record was created. SEO customisation is disabled by the current Portmoni plan. AI descriptions have no remaining credits.
- Services: name; rich description; service image; image optimisation choice; SEO panel. Section preferences cover title, mobile 1/2 columns, desktop 3/4 columns, menu visibility/name/hide-empty behavior, homepage visibility, section header visibility, colors, text size, alignment, margins and description.
- Branding: text/image/hidden logo, text logo size/spacing/color, menu alignment/font/colors, sticky and collapsed menu, hamburger alignment, search and favicon.
- Homepage header: headline/subheadline alignment and size, CTA target/custom URL and styling, one/two columns, color/image/slideshow backgrounds, separate text box, height and image optimisation.
- Other inspected lists/settings: pictures, media, news, events, forms, partners, about, contact details, donations, newsletter and footer. These still need individual full CRUD implementation and deeper reference inspection.
- Remaining reference audits include payment/shipping methods, product options and categories, reviews, inventory, reports, protected digital links, customer accounts, domain and billing workflows, custom code and data feeds. The main editor exposes these links; their workflows are not yet fully verified.

## Implemented in this branch

- Product and service create/edit/duplicate/delete with direct cloud-save behavior. Delete uses a Yes/No dialog; duplicates are initially hidden.
- Rich descriptions with an HTML allowlist, multiple picture uploads and picture reordering/removal.
- Blank/zero prices, normal/sale pricing validation, product type, weight, SKU, stock, customer-input labels, categories and collections.
- Cartesian product options with up to 100 combinations and variant-specific price, SKU, stock and picture URL. Existing variant values are preserved when regenerating matching combinations.
- Service enquiry/contact/booking configuration; no actual booking is submitted by private preview.
- Product/service SEO fields, duplicate page-URL checks, immediate form preview and clickable private detail views with variant price/stock changes.
- Desktop/tablet/mobile preview sizing. Existing unrelated builder settings are retained.
- Protected digital upload integration and an additive storage setup script. The bucket is not provisioned yet, so uploads require deployment of the accompanying SQL setup.

## Validation

Seven automated Node/jsdom tests cover variant combinations, prices/stock, product create/save/reload/edit/duplicate/delete, failed cloud saves, HTML sanitisation, integrated preview navigation and view modes, and service persistence. Run `npm --prefix tests ci` followed by `npm --prefix tests test`.

Database checks executed using the authenticated role show the demo user can read/save/reload its own draft and a different user cannot read it. The test write was rolled back and the absence of the test field was verified. The private bucket/policy script parsed and passed private-bucket/owner-policy assertions in a rolled-back transaction. Its absence after rollback was verified.

These checks do not replace browser visual QA, real Storage API upload tests, concurrency checks, or customer checkout tests. No real charges, customer order changes or domain purchases were made.

## Release and outstanding work

The code is staged in GitHub only. There is no newly deployed preview or live release URL. Production deployment approval is required by the owner's attached instructions before merging into the live branch or permanently applying the private storage setup. After approval, run visual and real upload checks with the demo account and verify the existing Academy/Community/Shop navigation.

Publishing, SGC subdomain routing, domain verification/SSL, payment-verified cart/checkout/orders/digital delivery, remaining content CRUD, analytics collection, real social sharing and all-customer administration are unfinished. Product and service dedicated views are currently private preview views, not public pages. Do not label the platform production-ready.

To roll back the code release, restore only the changed builder files to the base commit. Retain existing website JSON data. The additive private bucket should remain private; do not purge uploaded files as part of a rollback.


## Approved deployment — 13 October 2026

The owner approved this first release and private storage setup in chat. PR #3 was merged as `d580eebdf6eb3f7c4f0e22cb47ee69cf73b3333b`. Supabase migration `builder_private_digital_storage` was applied successfully; the digital bucket is private with a 50 MiB file limit. Follow-up commits `2c2045a52d55ceb85198f3046a302362d2ce566b` and `47ffdc3ae0105a5d52fafeeb1fdb5b37de8434ba` fix hidden preview elements and stylesheet caching. All three GitHub Pages deployments succeeded.

Live demo-account verification covered picture upload, protected digital-file upload, create/save/reload/edit/duplicate/delete for a product, variant-specific price and stock, service save and dedicated preview, booking-action preview without submitting a booking, and Yes/No deletion. Temporary catalogue records were removed and their absence was confirmed in the database. Tiny disposable upload fixtures remain in Storage; no customer records were used.

Anonymous public access to the uploaded digital file was rejected. Authenticated-role checks verified that another user cannot read its Storage metadata. Mobile/tablet/desktop preview widths were measured as 390/768/1154 px in the desktop test browser. Academy lessons, Shop categories, Community and the signed-in dashboard loaded successfully.

Live builder: https://sgcnetwork.co.za/website-builder.html?v=47ffdc3

This release still does not provide public customer-site publishing, checkout, paid digital fulfilment, custom domains, or all remaining content-management sections. The earlier pre-release observations above are retained as historical audit evidence; this deployment note supersedes their pending-release status.
