# SGC Network — Complete Ecosystem Setup

This package is the consolidated SGC Network website + private client ecosystem.

## Architecture

PUBLIC WEBSITE
- index.html
- kits.html
- start.html
- build.html
- business.html
- enquiry.html
- login.html
- signup.html

CUSTOMER ACCOUNT
- dashboard.html
- payments.html

PRIVATE ACADEMY
- academy.html
- course.html?id=COURSE_ID
- community.html

The Academy is a separate private section on the SAME domain. It is not intended to be a second domain.

## Access model

Supabase Auth identifies the signed-in customer.
Supabase database records memberships and customer kit ownership.
The Academy UI checks those records before presenting access.

The database should remain protected by Row Level Security. Never put a Supabase secret/service-role key in this website.

## Current status

WORKING / CONNECTED
- GitHub Pages static website structure
- Supabase browser connection
- Email/password authentication
- Customer account shell
- Academy shell and access-aware UI
- Membership/kit/payment database reads
- Course/lesson access-aware UI
- Premium private-area styling

READY FOR FINAL SERVER-SIDE PAYMENT INTEGRATION
- Paystack checkout
- Paystack webhook/verification
- Automatic payment records
- Automatic lay-by balance updates
- Automatic kit unlock at R0
- Automated invoices/receipts
- Admin payment/customer controls

Important: GitHub Pages is static hosting. Paystack secret keys and webhook verification must run in a secure server-side environment such as a Supabase Edge Function; never place a secret key in browser JavaScript.

## Existing Supabase project

The JavaScript config in this package contains the project's PUBLIC Supabase URL and PUBLISHABLE key supplied for this project. The publishable key is intended for browser use with proper RLS.

## Database

The existing supabase/schema.sql is retained as the foundation. If you use this package against the existing project, do not randomly recreate tables. Apply only new migrations needed for future features.

## Intended customer journey

Visitor
→ Public SGC Network
→ chooses a membership or Business Kit
→ creates/signs into account
→ completes payment
→ account records purchase
→ eligible Academy access becomes available
→ customer uses My SGC for account/payments
→ customer uses SGC Academy for learning/community

## Product separation

SGC Start and Business Kit lay-by remain separate products.
A Start subscription does not automatically count toward a Business Kit balance unless a future business rule explicitly says so.

## Security

This package uses Supabase Auth and database policies. Supabase recommends combining Auth with Row Level Security for browser-based authorization. Keep any secret/service-role key server-side only.
