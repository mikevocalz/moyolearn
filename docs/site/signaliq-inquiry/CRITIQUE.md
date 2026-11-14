# Inquiry review

The new form uses the existing schools page's tokens and keeps adult intake beside its actual CTA. The status copy describes a saved request without implying an invitation was sent or a person identified from anonymous browsing. Optional sharing starts off. Failure preserves fields and request identity for a safe retry.

The internal Payload inbox names pending, accepted and delivered separately. A subscription link is explicitly insufficient to record a sale. A booking action records a staff decision and tells the operator to send the calendar invitation through the normal scheduling tool. The UI does not expose configuration credentials or student context.

Final production review must verify the live form reaches the deployed Next API, the configured internal Payload account sees its own-sales inbox, and SignalIQ confirms processing. Static screenshots alone cannot establish those facts.

## Verification in this change

The native admin production build, Next/admin/Payload typechecks and scoped lint pass. An intentional client import of the shared private service fails the admin build at the native import-protection boundary; that probe is removed. The PostgreSQL 18 suite now passes all 19 cases, including fixed internal identity/scope checks, repeat-prospect identity, exact recoverable replay delivery/withdrawal races, exact invoice attribution, delayed subscription reconciliation, and immutable Stripe-to-ISO conversion/quarantine. The follow-up also passes 17 focused contract/transport/currency/auth/log tests, auth/Payload/web typechecks and the machine-route gate. Actual Moyo conversion and Signal formatting agree for MGA, ISK, UGX, USD, JPY, KWD, HUF, TWD, AFN and IDR under Node 24.22.1 / ICU 78.3; fractional and overflow cases are refused. These checks use isolated data and do not claim a production customer delivery.

The initial local screenshot attempt could not launch Chromium because that executor refused its process socket. The release coordinator subsequently checked the public production form in the shared cloud browser on 2026-11-14, at release `a8fc507`: school/family conditional fields worked, empty submission showed the required-details message, and optional Signal sharing and analytics were off by default. No inquiry was submitted. [The public desktop screenshot](./live-desktop.jpg) contains no contact or payment data and records that observed page; it does not prove a successful backend submission.

The authenticated Moyo inbox and SignalIQ interface remained behind sign-in and were not visually checked. No mobile screenshot, authenticated UI acceptance or submitted end-to-end customer receipt is claimed by this evidence.
