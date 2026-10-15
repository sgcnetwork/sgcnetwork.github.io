# Automatic payment access — 15 October 2026

Verified Stitch payments now automatically activate the purchased SGC entitlement:

- R150 once-off SGC Start: entry membership, with no expiry.
- R450 Academy Full Access: one month of premium Academy eligibility, retaining existing module unlock rules.
- R199 Website Builder: one month of editor access, independent of Academy Full Access. Public site publication remains unfinished.

The R150 purchase is required before either monthly checkout. Both legacy checkout links and catalogue products use server-selected entitlement keys and server-side prices. Existing tracked checkouts retain their recorded amount; historical orders are not repriced.

Paid transaction state and activation commit atomically through a database trigger. A private activation ledger keyed by checkout ID makes webhook retries idempotent. Per-buyer advisory locks serialise concurrent renewals. A new verified monthly payment extends from the later of the payment date or existing paid-through date; a repeated event for the same checkout cannot extend access again. Academy and builder periods remain separate.

Only service_role can execute activation; normal clients cannot mutate the private ledger. Website write policies require entry membership and a currently active, unexpired builder subscription, except for the existing demo entitlement. The recorded original activation logic is preserved privately for named membership compatibility.

## Deployed backend

Migration: automatic_verified_payment_access.
create-stitch-payment: version 32.
rapid-task: version 31.
Catalogue: R150 once-off / R450 monthly / R199 monthly.

## Verification

The proposed schema/functions and test data were first exercised in a rolled-back transaction. The installed implementation then passed the same assertions as both postgres and service_role:

- Builder payment without entry rejected; paid-state mutation rolled back.
- R150 payment activates entry without unlocking builder.
- R199 activates builder without an Academy premium membership.
- R450 activates Academy without changing builder expiry.
- Duplicate paid notifications and repeated activation calls do not extend periods.
- A second R199 payment extends exactly one month.
- Builder expiry removes builder access without affecting Academy.
- Normal anon/authenticated roles cannot call payment activation.

Fixtures are rolled back after each run; no customer payments, memberships or subscriptions were altered by testing. Local Node/jsdom suite: 19 tests passed, including the earlier review branch tests. The focused release contains 15 catalogue/checkout/payment tests and the SQL activation assertions. No real charge, payment link or customer email was created.

## Limits

This connects verified payments to access. It does not create automatic card-debit mandates, provider-side recurring charges, refunds or cancellation screens. Customers currently renew with another payment; each verified renewal extends access automatically. Unpaid access expires through existing time checks. Stitch production approval, real signed sandbox events and a real customer purchase-to-access browser journey remain to be verified. The builder still provides private previews rather than public website publishing.
