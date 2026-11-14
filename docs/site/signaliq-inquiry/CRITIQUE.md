# Inquiry review

The new form uses the existing schools page's tokens and keeps adult intake beside its actual CTA. The status copy describes a saved request without implying an invitation was sent or a person identified from anonymous browsing. Optional sharing starts off. Failure preserves fields and request identity for a safe retry.

The internal Payload inbox names pending, accepted and delivered separately. A subscription link is explicitly insufficient to record a sale. A booking action records a staff decision and tells the operator to send the calendar invitation through the normal scheduling tool. The UI does not expose configuration credentials or student context.

Final production review must verify the live form reaches the deployed Next API, the configured internal Payload account sees its own-sales inbox, and SignalIQ confirms processing. Static screenshots alone cannot establish those facts.

## Verification in this change

The native admin production build, Next/admin/Payload typechecks and scoped lint pass. An intentional client import of the shared private service fails the admin build at the native import-protection boundary; that probe is removed. The PostgreSQL 18 suite passes all 12 cases, including fixed internal identity/scope checks, repeat-prospect identity, exact recoverable replay and delivery/withdrawal races. Contract/transport and billing projection diagnostics pass.

A local screenshot attempt could not launch Chromium because this executor refuses its process socket. No desktop/mobile screenshots or live authenticated UI interaction are claimed here. Production browser review and deployed end-to-end receipt verification remain release gates.
