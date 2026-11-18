# Madressa Anwaar Ul Quraan

Production: https://sgcnetwork.co.za/anwaar/

React interface deployed through the existing SGC GitHub Pages site. Source is in `src/`; committed production assets are `app.js`, `style.css`, `poster.svg`, `icon.svg` and `index.html`. The supplied poster is embedded losslessly inside an SVG wrapper.

## Build

With Node 24, run `npm ci`, `npm test`, and `npm run build` in this directory. Commit generated assets alongside edited source.

## Backend and access

The separately deployed `anwaar-hub` Supabase Edge Function verifies every bearer token with Supabase Auth. Data is isolated in `anwaar_records`. Direct anonymous/authenticated table access and direct execution of the service-only write RPC are revoked. The settings record binds the existing SGC administrator's stable user ID; only that administrator manages school settings and teacher access. Teachers can manage school records; students receive only their own personal records and shared/class-scoped learning materials. Enrolment emails are linked to a stable authenticated user ID on first access.

The browser uses a dedicated sessionStorage key and the existing SGC email/password authentication service. Signup confirmation and password recovery use SGC's existing email configuration. Adding staff does not send invitations. No test account was created and no test email was sent.

## Included workflows

Admissions and approval, student and guardian details, class groups/capacity, recurring weekly lessons, curriculum, assignments/submissions/feedback, assessments, attendance, invoices, part payments/receipts, resources, notices, messages, school settings, staff access, printable statements, reports and CSV exports.

Demo data is fictional and temporary. It is not inserted into the database. Payment recording is manual: no card processing, bank-feed verification or automatic payment reminders. Resources use HTTPS links, not file uploads.

Production uses the SGC parent-domain path above. A dedicated subdomain still requires Cloudflare routing changes. Existing SGC sites and DNS records are untouched.
