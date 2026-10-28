# Visa Services workspace

Production: https://visaservices.sgcnetwork.co.za/

Static assets are served through the existing `sgc-customer-websites` Cloudflare Worker from SGC's GitHub Pages origin. No ChatGPT hosting or sign-in is used. Supabase provides individual logins, company-scoped records, private client documents and transactional signed handovers.

## Initial setup

Sign in with the existing SGC owner account. In **Users & access**:

1. Add companies if needed, including their delivery address, contact and telephone. GVM, GVS, VL and GovDocs are already present. Company codes remain stable; names and delivery details can be updated.
2. Add each person's exact email, full name, role and companies. A new email requires a temporary password of at least 12 characters. Existing Supabase accounts retain their current password. No invitation email is sent by this screen.
3. New accounts must change their temporary password before any private records become available. Distribute credentials securely to the intended user.
4. Give Pretoria staff the **Pretoria office** role and the companies they process. A consultant's case remains attached to its company even if their later company assignments change.

Roles: Administrator (all companies and account administration), Company manager (company operations and finances), Consultant (company sales/documents and assigned consultant sign-offs), Pretoria office (PTA handovers), Finance (invoices/expenses; no identity files), Read only (company case/document viewing).

## Client references and documents

Create a client reference from **Client files**, optionally linked to an existing quotation. A saved quotation also provides **Create client file**. The assigned consultant must be active and belong to the company. References are generated on the server, for example `GVM-PCC-000123`.

Uploads require a real reference and document type. Storage keys include company, case UUID and immutable document-version UUID. PDF, JPG, PNG, WebP and Word are supported up to 10 MB. Files are private; search is performed on the server using reference, client name, company, type and filename, with paginated results. Open a reference to see its exact document versions and sign-off history. Uploaded versions cannot be overwritten or removed after they are registered. **Open / print** opens the authenticated copy; printing is performed by the user's browser or document application.

## Signed PCC workflow

1. Required ID/fingerprint review copies uploaded under the client reference.
2. Assigned consultant (or manager/admin) signs verification; company-scoped PTA users receive an in-app notification.
3. Pretoria verifies the pack, records receipt of originals, prints the review paperwork and signs the print step. Corrections can be returned to the consultant with a signed reason.
4. Pretoria signs the actual submission date. PCC submission is blocked without the original-fingerprints declaration. Review scans are not a substitute for originals.
5. Save SAPS enquiry number and the 13-digit SA ID or 8-digit YYYYMMDD DOB. The app attempts an immediate check; a database scheduler queues submitted PCC checks every six hours until finalised.
6. Pretoria collects the PCC, uploads **PCC certificate** under the same reference and signs collection. The consultant receives **Confirm PCC retrieved**.
7. The assigned consultant signs **Confirmed, send to client** after a matched finalised SAPS result or a signed manual verification supported by **SAPS status evidence**.
8. Pretoria receives **Book waybill to [company]**. Open Parcel Perfect or The Courier Guy, make the actual booking there, then record the issued waybill and client delivery charge.
9. Recording the waybill creates one unpaid delivery invoice for this client atomically. Company address/contact/phone are required; duplicate dispatches cannot create duplicate invoices. Delivery receipt has its own dated sign-off.

Ordinary document services use the same handovers with **Completed document** as the collected file and do not require SAPS checks. Staff must select appropriate required document types for those services.

Signatures are typed-name attestations linked to the authenticated account, role, exact document-version IDs and server timestamp. This is an operational sign-off log, not a claim of an advanced/certified electronic signature. Event history has no client-side update/delete permissions. Notifications are inside the app and refresh while it is open; this release does not send workflow emails or SMS.

## External-service limits

The SAPS checker only recognises a matching enquiry/client row with a valid finalised date. Generic “successful” text, a different identifier, no results, CAPTCHA, network failure or an unknown page format never count as success. Finalised means processing completion, not a determination about the certificate's contents. Results are retained with source/status/timestamp, excluding raw identity numbers from audit messages.

Live SAPS connectivity was not established during verification: a server-side HTTPS probe failed certificate validation. Certificate verification was not disabled. The production checker attempts HTTPS normally and reports unavailable results; staff can open SAPS themselves and sign a manual check with uploaded evidence. Its parser is covered by positive and negative fixture tests, but a live real-client result has not been tested.

Courier links open the requested provider portals. This release does not hold courier API credentials, purchase courier services or claim an external booking succeeded. The staff member records the real issued waybill and delivery charge; the app creates the delivery invoice record. It does not automatically email invoices to clients. Accounting continues to use gross ZAR amounts; VAT, payroll, bank feeds and tax filing are not integrated.

## Security and backend

- `visa_users`, `visa_user_companies`, `visa_companies`: server-enforced membership and roles. No user-editable metadata is used for authorisation.
- `visa_cases`, `visa_documents`, `visa_case_events`, `visa_notifications`: company-scoped RLS; no direct client writes to cases, document metadata or signed history.
- `visa_service_records`: company/role-scoped sales and financial records; delivery invoices also have a case/company foreign key.
- `visa-service-documents`: private storage, company/case paths, immutable versions and restricted download policies.
- Privileged transactional implementations live in `sgc_private` with empty search paths and explicit actor/role checks; exposed API wrappers use SECURITY INVOKER. Provisioning and automatic-result functions are service-role-only.
- `visa-operations` Edge Function validates user sessions itself. Its scheduled-job path uses a short-lived, single-use random capability token stored only as a hash. No service credential is sent to the browser. Public gateway JWT verification is disabled for the scheduler, while every normal action calls Auth getUser and checks active application membership.
- Suspending a user denies subsequent database/storage operations even with an old JWT. The app clears cached records if the account is no longer active.

The applied schema releases are recorded in `supabase/sql/visa-services-team-workflow.sql`, `visa-services-workflow-refinements.sql`, `visa-services-private-workflow-implementations.sql`, `visa-services-document-workflow-hardening.sql`, and `visa-services-document-search.sql`, in that order. Do not replay them as a single initial setup; they correspond to already-applied remote migrations.

## Build, deploy and validation

From `visaservices/`: `npm ci`, then `npm run build`. Commit source, package lock, generated `app.js` and `style.css`. GitHub Pages and the existing Cloudflare workflow publish the changed assets. The router and other SGC websites are unchanged by this feature release. The Edge Function source is in `supabase/functions/visa-operations/` and was deployed separately.

Validation:

- `node --test tests/visa-saps-parser.test.cjs tests/visa-router.test.cjs`: 12 tests passed.
- `tests/visa-workflow-access.sql`: a rolled-back live database test exercised company/document isolation, signed handovers, original-fingerprint submission gate, notifications, SAPS completion gate, one delivery invoice, immutable audit and immediate suspension. No test users, cases, files, notifications or invoices were retained. Sequence gaps from rolled-back reference generation are expected.
- `tests/visa-generic-document-workflow.sql`: rolled-back generic handover, reference search, anonymous denial and service-only provisioning checks passed.
- Live unauthenticated Edge Function request rejected with HTTP 401.
- Browser QA with fictional local fixtures checked user role/company controls, reference search, document cards, client workflow timeline and Pretoria signature form. The full application preview checked navigation and sign-in gates.
- Private tables intentionally have deny-by-default RLS. No anonymously executable privileged Visa functions are exposed. Security advisors retain expected INFO notices for the private job/audit tables having no client policies.
- A real-user authenticated browser upload/sign-off and actual courier booking remain to be exercised by staff with their own credentials. No police lookup using a real client's identifiers or courier purchase was performed during development.


## Service checklists, indexing and Grokbot (2026-10-28)

The applied migrations `visa-services-checklists-indexing-allocation.sql` and `visa-services-review-standards-hardening.sql` add versioned administrator standards, immutable suggested extractions, immutable signed field indexes and transactional round-robin assignment. PCC always starts with ID / Passport and Fingerprints. Visa requires country and category, with bank statements, flight reservation, identity, PCC and passport photo as the internal baseline. Country/category templates can extend that baseline; these are company requirements, not an exhaustive official consulate checklist. Existing case snapshots are retained.

Open **Documents → Review index** or upload under a client reference. The private original is displayed beside indexing fields, source evidence and findings. PDF processing uses a locally served PDF.js worker: at most 12 pages of selectable text and 4 rendered pages per analysis. Image processing requires the Grok connection for visual extraction; without it, only local labelled text extraction and manual indexing are available. DOCX plain text uses Mammoth with archive-size guards; legacy DOC is manual. The full original must be reviewed by a person. Extraction does not constitute verification. Signed review requires the current field profile version, required fields, valid ISO dates, own-name signature and all-pages acknowledgement. Checklist handover requires a signed index for each requirement. PCC dispatch additionally requires human-confirmed matching visible ID/passport fields against identity; birth dates are compared where available.

Grokbot uses an actual xAI Responses API integration, not a simulated model. In **Document standards**, an administrator can test a company API key, choose an available vision-capable model, enable processing, set automatic upload analysis and set a daily request cap. The company must supply its own funded xAI key. It is encrypted in Supabase Vault and retrievable only through service-only functions. No key was supplied or connected during development. Selected document text/images and source translation documents are sent to xAI only when enabled, using `store:false`, no tools and bounded structured output. This flag disables response-object storage; it is not a claim about a zero-retention provider agreement. Rate limits and daily quotas apply. API keys are not saved in client/browser persistent storage or returned by status APIs. Anonymous agent requests return 401; all actions authenticate and check current role/company access.

Rules compare normalized ID/passport numbers, visible names and YYYY-MM-DD dates across identity and PCC, flag missing fields and reversed/ambiguous dates, and pair source/translation fields. Sworn translation confirmation requires a linked same-client source, visible translator signature and a qualified human attestation. AI cannot establish sworn-translator admission, legal certification, authenticity, completeness or visa eligibility. Saudi tourist eVisa checks use the official six-calendar-month passport window and measurable photo specifications; work/business/other Saudi categories are explicitly routed to category-specific human review. Official links are embedded in findings and templates. Date and format checks do not imply visa approval.

**Lead allocation** shows the company rotation and consultant availability. Each company has a locked allocation counter. New enquiries or standalone cases go to the eligible active consultant with the oldest last assignment; paused users and accounts awaiting password change are excluded. A quotation linked to an enquiry and its subsequent client file inherit the original consultant rather than consuming another turn. Manager/admin case overrides require an audit reason. Request IDs prevent a repeated case save from consuming another turn. No fictional named employees have been created; add the real accounts and companies in Users & access before allocating enquiries.

Validation: 21 Node tests cover routing, SAPS parsing and indexing/date/comparison rules; three rolled-back live SQL suites cover signed handovers, company isolation, lead rotation, pause exclusion, source inheritance, idempotency, required checklist enforcement, ISO/all-pages review gates and service-only secrets. Real staff browser upload/signing, a funded xAI request and real external service transactions were not performed. Fictional local browser fixtures validate admin standards, required checklist selection, review layouts and sign-in gates. No test client records or document files are retained.

Build also produces `pdf.worker.mjs`; commit it along with app.js/style.css. Cloudflare allows this worker asset and same-origin/blob workers. Deploy `visa-document-agent` separately with its index.ts, rules.ts, standards.json and deno.json. Its gateway JWT flag is disabled for publishable-key compatibility, but every route explicitly calls Auth getUser and validates the active application profile before accessing any data.
