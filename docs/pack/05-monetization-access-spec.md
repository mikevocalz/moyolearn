# Monetization, Trials, Role Routing & Money Movement
**Doc 05 · Companion to the platform pack · Date:** Aug 19, 2026
**Scope:** pricing research → trial/paywall spec per shell; role-based routing + visibility matrix; the Payload internal back office (founder + tech support); Stripe Connect architecture for family → business → tutor money flow (Noto as the reference). Roster + anti-slop gates from plan §9 apply.

---

## 1. Research findings (2026 data, sourced in §8)

### 1.1 Trials & paywalls — the numbers that set the design
- **Hard paywalls beat freemium ~5×:** median Day-35 trial-to-paid is **10.7% behind a hard paywall vs 2.1% freemium** (RevenueCat 2026; hard-paywall was 12.1% in 2025). Revenue per install at day 60: **$3.09 vs $0.38 (8×)**. One-year retention is statistically identical (27% vs 28%) — the "hard paywalls hurt retention" myth is dead in the data.
- **Education specifically rewards trials:** education trial users generate **+50.4% higher 12-month LTV than direct buyers** (Adapty 2026, 16k apps/$3B revenue) — trials are the correct default in this category, and education sits among the higher-converting categories (≈6.5% median download→paid among strong performers).
- **80–90% of all trials start on Day 0** — the paywall is an onboarding screen, not a settings page. Whatever value moment precedes it decides everything.
- **Cheaper converts better through trials:** lower-priced apps convert trial→paid at 47.8% vs 28.4% for high-priced (RevenueCat 2025) — supports the $11 early-bird / $15.99 regular family pricing under Duolingo Max's $30 ceiling.
- **Anchoring works:** presenting the annual plan as its monthly equivalent lifted trial starts +30% and annual take +10% with no conversion loss (RevenueCat case).
- **Trial-structure experiments are the #2 LTV lever (59.6% uplift)**; price changes rank last — so the spec ships trial length/structure as a config, not a constant.
- **Very short trials backfire:** 3-day trials trade long-term conversion for speed; longer trials let the habit form — consistent with a month trial for a product whose value is a weekly learning rhythm.
- **Competitor norms:** TutorBird ships a **30-day free trial** at $14.95/mo; TutorCruncher a 2-week trial with pay-as-you-go pricing; Teachworks offers a trial on base + per-lesson pricing. A month trial (his instinct) is exactly the segment norm at the solo tier.
- **Noto's money model (the reference):** SaaS tiers — Basic (solo: calendar, auto-billing, CRM, direct bank payments) → **Studio (multi-instructor + Staff Payroll)** → Pro (marketing/automations) → Enterprise (3+ locations); Basic ~$49, Pro ~$199 per their own blog. On top of tiers, Noto monetizes **payment processing**: 3.0% + $0.30 per card transaction (3.3% Amex) and **0.5% for ACH**, deducted before deposit — and their marketing leans hard on ACH cutting a $50k/mo center's fees from ~$1,250–1,750 to ~$250. Payroll gated at Studio = payroll is an upsell, not a table stake.

### 1.2 The legal floor for trials/auto-renewal (changed in 2025–26)
The FTC's "click-to-cancel" Negative Option Rule was **vacated by the Eighth Circuit on July 8, 2025** on procedural grounds, days before enforcement; the FTC formally restored the narrow pre-2024 rule on Feb 12, 2026 and filed a draft ANPRM (Jan 30, 2026) to restart rulemaking. What binds us now: **ROSCA** (clear disclosure of material terms, informed consent before charging, simple cancellation), **FTC Act §5** (both major FTC subscription cases were built on ROSCA/§5, not the vacated rule), and **state auto-renewal laws** — California's ARL is the strictest, with New York, Vermont, Oregon, Minnesota, Illinois close behind. Design consequence: **build the California-grade standard once and apply it everywhere** — it's also simply the honest UX: full price/renewal terms on the paywall itself, affirmative consent, in-app cancellation as easy as signup, and a reminder email before a trial converts to a charge.

---

## 2. Pricing v2 + trial/paywall spec (supersedes plan §2.6 where different)

### 2.1 The three revenue lines
1. **SaaS subscriptions** — ops tiers + family plan (below).
2. **Payment-processing spread** (the Noto line, new to our model): businesses process family payments through us; we price card processing at market (≈2.9–3.0% + 30¢ retail) and **ACH at or below Noto's 0.5% benchmark**, keeping the spread over Stripe's cost. Exact rates set against Stripe's current published pricing at implementation — never hardcoded in product copy. ACH-first framing is the sales story it is for Noto.
3. **Marketplace take rate** — unchanged from the plan: 10–15% **only on demand we source**; never on a business's own book.

### 2.2 Who pays what — two different customers who never see each other's prices

**A) Tutoring businesses & schools — B2B software pricing. A parent never sees these numbers; they live only in the Ops shell and on the business-facing site.** Competitor frame: TutorBird $14.95, Teachworks $15–45+ plus per-lesson fees, TutorCruncher $30–240 + transaction fees, Oases up to ~$699/mo.

| Tier | Price | Trial | Gates |
|---|---|---|---|
| Ops · Solo | $19/mo | **30-day full-feature, no card** | payroll *calculation* included; payout execution is Studio+ |
| Ops · Studio | $99/mo | same trial | **Staff payroll + automated tutor payouts** (the Noto-Studio/TutorCruncher-parity gate — payroll is the upgrade trigger in this market) |
| Ops · Scale | $299/mo | same trial | multi-location, automations, custom reporting |
| Institution | $12–18/student/yr | pilot agreements, not self-serve trials | Phase 4 |

**B) Families — the only price a parent is ever asked to pay:**

| Plan | Price | Trial | Notes |
|---|---|---|---|
| Family · **Early bird** (founding families, all children included) | **$11/mo** · $110/yr *(annual = proposed 2-months-free convention, shown as "$9.17/mo billed yearly")* | **30-day, card-required** (Stripe `trial_period_days: 30`) | **Price locked for life** while the subscription stays active (its own Stripe Price on the family Product — grandfathering is automatic, no coupons). Eligibility is a real, stated limit — first N founding families or a hard date printed on the paywall — never a fake countdown |
| Family · **Regular** (all children included) | **$15.99/mo** · $159.90/yr *(annual proposed, shown as "$13.33/mo billed yearly")* | same | Anchors: Khanmigo $4/mo (launched at ~$10, cut in 2024; donation-subsidized nonprofit) · Synthesis ~$40/mo for math alone · Duolingo Max ~$30/mo |

The early-bird cohort **supersedes the earlier $9.99 A/B proposal** — it *is* the price-sensitivity read (trial→paid and retention tracked by cohort), while remote config keeps owning paywall presentation variants. Two standing rules: any future price change for existing subscribers ships with advance notice (California-ARL standard), and early-bird scarcity is honest scarcity — when the cap or date passes, the offer is gone, because a "limited" price that never ends is exactly the §5 dark pattern this product refuses.

**Why $15 can hold against a $4 nonprofit — and the honest hedge.** Khanmigo is a chat tutor subsidized by philanthropy; the family plan here bundles the embodied tutor, parent oversight + AI-activity review, the mixed plan, and the path to human/hybrid sessions — Synthesis proves families pay ~$40/mo for *feel* in a single subject. The hedge: direct-to-consumer at a premium is deliberately **Phase 3**. In Phases 1–2, most families meet the AI tutor **through their tutoring business's plan** — the business bundles it into packages families already buy at $50–100+/hr, and the family pays the business, not us. The $15.99 regular consumer price is a later fight, entered with the early-bird cohort's conversion and retention data already in hand.

### 2.3 Paywall & trial rules per shell
- **The child never sees a paywall. Ever.** Payment surfaces exist only in Family (parent) and Ops shells. On family trial expiry the **parent** hits the paywall; the **learner** degrades gracefully to a small free daily practice set — a child is never punished mid-streak for a guardian's billing state, and win-back messaging goes to the guardian only. (Consistent with plan §7's no-dark-patterns-near-children rule; engagement pressure aimed at kids is the FTC §5 pattern we refuse.)
- **Family paywall placement:** end of onboarding, *after* the first value moment (child profile created + first tutor interaction preview) — Day-0 reality means this screen carries most conversions. Contents required by the ARL-grade standard: full price, renewal cadence, trial end date, "cancel anytime in the app," one-tap plan compare, annual-as-monthly anchor.
- **Trial conversion hygiene (all shells):** reminder email ≥3 days before first charge (Stripe's trial-ending webhook drives it); in-app Cancel is one tap from Billing and never behind chat/support; cancellation confirms in-product and by email; Stripe `trial_settings.end_behavior.missing_payment_method = 'cancel'` for any no-card variant so nobody is silently converted.
- **Ops trial expiry:** business data is never hostage — read-only grace mode with export always available; the convert screen shows *their* trial's activation stats ("14 sessions scheduled, 3 invoices paid through the trial") because the product's own usage is the sales pitch.
- **iOS note:** consumer family subscription purchase flow follows the App Store external-purchase policy **as verified at implementation time** (plan ADR-004 rule) — no policy assumption is baked into designs; the paywall renders both IAP and web-checkout variants behind a flag.

---

## 3. Role-based routing & visibility

### 3.1 Shell resolution (routing)
Resolution chain, verified against the repo's stack: **Better Auth session → memberships (org × role) → persisted `activeContext` (MMKV) → root layout selects the shell route group.** Expo Router's `Stack.Protected` (SDK 53+/Router v5+, present in the repo's Router 57) is the enforcement primitive: guards accept booleans, **nest for hierarchical checks** (signed-in → role → org-feature), **apply to deep links**, redirect to the anchor route on denial, and **purge history entries when a guard flips false** — exactly the multi-role context-switch behavior we need (switching context flips guards; the router cleans up the previous shell's history).

```tsx
// apps/mobile/app/_layout.tsx (shape — real guards come from the auth store)
<Stack>
  <Stack.Protected guard={!session}>
    <Stack.Screen name="(auth)" />
  </Stack.Protected>
  <Stack.Protected guard={!!session}>
    <Stack.Protected guard={ctx.kind === 'learner'}><Stack.Screen name="(student)" /></Stack.Protected>
    <Stack.Protected guard={ctx.kind === 'guardian'}><Stack.Screen name="(family)" /></Stack.Protected>
    <Stack.Protected guard={ctx.kind === 'tutor'}><Stack.Screen name="(tutor)" /></Stack.Protected>
    <Stack.Protected guard={ctx.kind === 'teacher'}><Stack.Screen name="(teacher)" /></Stack.Protected>
    <Stack.Protected guard={ctx.kind === 'ops'}><Stack.Screen name="(ops)" /></Stack.Protected>
  </Stack.Protected>
</Stack>
```
Web mirrors this with server-side checks in each route group's `layout.tsx` (session read on the server; no flash of the wrong shell). **Route guards are UX, never security** — every read/write is authorized again in Payload access control (plan ADR-003); the guard tree only decides what a role is *offered*.

### 3.2 Visibility matrix (who sees what of whom — relationship-scoped, deny by default)
A role sees other people **only through an active relationship** (guardianship, session, class enrollment, org membership) and only the fields that relationship justifies:

| Viewer ↓ / Subject → | Students | Parents | Tutors/Teachers | Money | Child AI data |
|---|---|---|---|---|---|
| **Student** | self only | own guardians (name) | *their* tutors/teachers: name, avatar, subject | **nothing** — no prices, invoices, or paywalls | own sessions (age-appropriate view) |
| **Parent** | own children (progress, plan, schedule) | self | children's tutors/teachers: profile, credentials, messaging | family invoices, payment methods, plans; **never tutor pay rates** | children's AI activity review + permissions (derived observations; transcripts per retention window) |
| **Tutor** | assigned students: learning context, prep, notes | guardians of assigned students: messaging only | self + org colleagues (name/subject) | **own earnings/pay runs only**; never family card data or org finances | assigned students' derived observations only — never raw transcripts |
| **Teacher** | class rosters: mastery, assignments | guardians: messaging | department colleagues | **none** | class-level AI usage aggregates |
| **Ops staff (scheduler/manager)** | org students: scheduling + enrollment data | org families: contact, billing status | org tutors: schedule, utilization | invoices/payments per role; payroll = finance/owner roles | **none** — operational staff never see learning conversations |
| **Owner** | org-wide | org-wide | org-wide incl. pay rates | full org finances | aggregates only; per-child AI content requires guardian-visible justification |
| **Institution admin** | school-level aggregates → drill-down per FERPA role | — | staff | contract/invoice level | policy + aggregate usage; moderation alerts per policy |

Enforcement is one implementation, three layers: Payload collection+field access functions (source of truth) → API projections that never over-fetch (a tutor's student payload physically lacks family billing fields) → `Stack.Protected`/UI gating. Cross-tenant and cross-relationship attempts are CI test cases per collection (extends plan §7.2's tenancy tests to relationships).

---

## 4. Payload: the internal back office (founder + tech support)

The repo already has the right bones: Payload's `Users` collection is the **admin login**, separate from platform identities (which live in Better Auth). Formalize that split — `Users` = internal staff only, with a `role` of `superadmin` (founder) or `support`.

### 4.1 What support can see / change (field-level, deny by default)
| Domain | Support READ | Support WRITE | Hidden from support |
|---|---|---|---|
| Orgs & memberships | org profile, plan, member list, activation stats | resend invites, unlock accounts | — |
| Subscriptions/billing | subscription state, invoice status, payment *status* | fix stuck subscription state, trigger refund **≤ amount cap**, extend trial ≤14d | card/bank numbers (Stripe-vaulted; only last4 renders) |
| Scheduling | session metadata (who/when/status) | re-send notifications, repair stuck states | — |
| Consent & privacy | consent record status + timestamps | re-issue consent request | consent evidence documents (superadmin only) |
| Learning/AI | aggregate usage per org | — | **AI transcripts, message bodies (redacted previews only), mastery detail beyond aggregates, child PII beyond name/grade band** |
| Audit | full audit log | — | — |

Mechanics, all on the stable (non-admin-UI) Payload surface per ADR-002's canary rule: collection `access` + **field-level `access` functions** keyed on the internal role; `admin.hidden` per collection for support; a Payload hook writes **every internal mutation to `auditEvents`** (actor, target, before/after, ticket ref). Two hard rules: **no impersonation** — instead a read-only "support view" of a user's account that requires a ticket ID + the user's consent flag and is itself audit-logged; and **support actions on child-linked records always notify the guardian** (an entry in the parent's Action Needed feed: "Support corrected a billing issue on your account").

### 4.2 Founder (superadmin) extras
Feature flags/remote config (trial length, paywall variants per §1.1's experiment lever), fee configuration per org (processing spread, take rate), canary-bump dashboards (Payload version, webhook health), consent-evidence access, and destructive operations (org deletion) behind a typed confirmation + 24h delay job.

---

## 5. Money movement: family → business → tutor (Stripe Connect, phased)

### 5.1 The verified Stripe facts this design stands on
- Three charge patterns: **direct charges** (connected account is merchant), **destination charges** (platform charges the customer, funds route to the connected account, platform keeps `application_fee_amount`), and **separate charges & transfers (SCT)** — platform charges the customer, then splits via multiple transfers; Stripe's own canonical SCT example is a delivery platform splitting one payment between **the restaurant and the deliverer** — structurally identical to splitting a family's payment between **the business and the tutor**.
- Under destination charges and SCT the **platform is merchant of record and owns negative balances** (refunds/disputes debit the platform); Stripe recommends SCT only when the platform accepts that responsibility. Transfers ride `transfer_group`; cross-border transfers are constrained (US/CA/UK/EEA/CH payments balance), so v1 is US-only money movement.
- **Accounts v2:** the legacy Standard/Express/Custom account *types* are deprecated; new integrations compose **configurations — Merchant, Customer, Recipient — plus a dashboard level (full / express / none)**. Businesses = Merchant config with the express dashboard; tutors = **Recipient** config (the recommended v2 path for payout recipients).
- **Tax:** Stripe automates **1099-NEC/1099-K** for US connected accounts including TIN collection/validation; for SCT, reportable amounts derive from the **transfers**, not the charge — which is exactly right for tutor earnings.
- Payout cost to connected accounts is on the order of 0.25% + $0.25 (third-party figure — **verify against Stripe's current pricing page in the implementation PR**, like every fee number in this doc).

### 5.2 Phase M1 — revenue first, minimal money-transmission surface (ships with ops wedge)
Families pay the business; we monetize the spread; tutor pay is *calculated*, not yet moved:
1. Business onboards as a connected account (Merchant config, express dashboard) during ops onboarding — embedded, Noto-style, not a "go create a Stripe account" link-out.
2. Family invoices/checkouts are **destination charges**: platform charges the family (card or **ACH debit** — the fee story from §2.1), `transfer_data.destination` = business, `application_fee_amount` = our processing spread. Refunds/disputes flow per Stripe's destination model; policy engine holds a reserve rule per org.
3. **Payroll v1 = TutorBird-killer, Teachworks-parity:** `payRates` (per tutor × service: hourly / per-student / per-session / revenue-share — the flexibility Tutorbase markets) + `payRuns` computed from completed session records (the $75 billed / $42 tutor-pay fields already in the session inspector). Output: approval flow + statement per tutor + export. No funds move to tutors yet.

### 5.3 Phase M2 — automated tutor payouts (the Noto-Studio/TutorCruncher leapfrog, gated at Studio tier)
1. Tutors onboard as **Recipient-config** connected accounts from the Earnings screen (W-9/TIN via Stripe's hosted flow).
2. Family payment for a session becomes **SCT**: one charge on the platform; transfers in the same `transfer_group` — tutor share → tutor account, business share → business account, platform retains fee. Approved pay runs execute as batched transfers; instant-payout option for tutors where eligible (fee passed through, clearly labeled).
3. **Stripe 1099 automation** covers tutor earnings (transfer-derived amounts); the business's payroll screen becomes approve-and-done.
4. Schools/institutions: invoiced via Stripe Invoicing (ACH credit/debit); their tutor payouts ride the same transfer rail.
5. Risk engineering that comes with SCT: platform-owned negative balances ⇒ per-org rolling reserve + dispute playbook; payout holds until session `completed` + dispute-window policy per org; employee-vs-contractor is the **business's** classification (product ships contractor rails + W-2 export for businesses running real payroll elsewhere — we are not a payroll provider of record in v1/v2).

### 5.4 Collection deltas (adds to plan §7.1)
`subscriptions` (org/family, tier, trial state, Stripe ids) · `connectedAccounts` (org/tutor, config, requirements status) · `payRates` · `payRuns` (+ line items) · `transfers` (Stripe transfer refs per session split) · `feeConfigs` (per-org processing spread, take-rate scope) · `refundsDisputes` (state machine + reserve effects). All server-only via `domain-services`; webhook handlers idempotent per plan §7.2.

---

## 6. New screen briefs (S16–S20, same skill-bound format as doc 04)

### S16 · Family paywall / trial start
**Job:** convert at the Day-0 value moment without a single dark pattern. **Research:** §1.1 (hard paywall 10.7% vs 2.1%; Day-0; annual-as-monthly anchor; +50.4% trial LTV), §1.2 (ARL-grade disclosure). **Layout:** Focus, one screen; plan compare = two cards (monthly / annual-anchored), trial terms inline — price, renewal date, "cancel anytime in the app," reminder-email promise. **Design:** hot dial; the only highlighter block is the trial end date — the thing regulators and parents both care about. **Copy:** button says the truth: "Start 30-day free trial"; early-bird card states the real terms plainly — "$11/mo founding price, locked for as long as you stay subscribed" with the actual cap or end date, no countdown theater; secondary link "Continue with free practice" (the child's floor is never hostage). **A11y:** terms are real text at AA contrast, never gray-on-gray fine print. **Metric:** trial-start rate; D35 trial→paid; cancellation-flow completion time (target <30s — the ARL test).

### S17 · Ops trial status & convert
**Job:** sell the subscription with the business's own trial data. **Research:** §1.1 (activation milestones drive B2B conversion; TutorBird 30d norm), §2.3. **Layout:** banner chip in the rail (days left + milestone progress) → convert screen: their stats ("14 sessions, 3 invoices, 2 tutors onboarded") above the tier cards; payroll gated at Studio is stated on the card, not discovered later. **Design:** cool dial. **Copy:** "Your trial ends Friday — everything you've set up stays." Read-only grace + export always visible post-expiry. **Metric:** trial→paid by milestone count (the causal chart).

### S18 · Tutor Earnings & payout onboarding
**Job:** a tutor sees what they've earned, why, and gets paid without leaving the app. **Research:** §5 (Recipient onboarding, 1099 automation), R12 (trust in the platform = tutor supply). **Layout:** Duet — earnings list (per session: rate rule applied, in the tabular mono) · detail/statement; payout onboarding is a checklist card until Stripe requirements clear. **Design:** cool dial; grade-green for paid, ink for pending — never red for "processing." **Copy:** every line item explains itself: "Algebra II · 60 min · $42 (hourly rate)." **A11y:** amounts always text + SR-labeled with period context. **Metric:** payout onboarding completion; earnings-page WAU (supply retention).

### S19 · Ops payroll run
**Job:** approve a correct pay run in minutes (the Studio upsell made real). **Research:** §1.1 (payroll is the tier trigger market-wide), §5.3, R7. **Layout:** Triptych — pay period list · run detail table (per tutor: sessions, rule, amount, exceptions) · tutor line inspector; exceptions (disputed session, missing rate) block only their own lines. **Design:** cool dial; redpen reserved for true blockers. **Copy:** "Approve & pay 12 tutors · $3,184" — one button states the whole action. **A11y:** the run table is a real table (headers, per-cell SR labels). **Metric:** time-to-approve; exception rate trend.

### S20 · Internal support console (Payload)
**Job:** fix the user's problem while structurally unable to violate their privacy. **Research:** §4 (field-level access, audit, guardian notification), R9/R10. **Layout:** Payload admin views scoped by role — this is deliberately *not* a custom app in v1 (canary rule: no admin-UI customization; scoping via access functions + hidden collections). **Design:** stock admin; the design work here is the **absence** of data. **Copy:** support-facing field descriptions state why data is hidden ("Transcripts are guardian-visible only"). **Metric:** median resolution time; % actions with ticket refs (target 100%); zero access-policy violations in audit review.

---

## 7. PR additions (extends the tailoring doc's Phase-0 list)
- **PR-8 · Subscriptions & trials:** `subscriptions` collection, Stripe Billing + Better Auth Stripe plugin (org per-seat), trial config as remote flag, ARL-grade cancel flow + reminder emails, S16/S17.
- **PR-9 · Role guards & visibility:** `Stack.Protected` shell tree + server layout checks on web; relationship-scoped API projections; cross-relationship CI tests (matrix §3.2 as fixtures).
- **PR-10 · Internal back office:** internal `Users.role`, collection/field access functions, `admin.hidden` maps, audit hook, guardian-notification hook, refund/trial-extension caps.
- **PR-11 · Connect M1:** Merchant-config onboarding embedded in ops setup, destination charges + `application_fee_amount`, ACH debit enablement, `feeConfigs`, webhook handlers.
- **PR-12 · Payroll v1:** `payRates`/`payRuns`, run computation from session records, S19 approve flow, statements/export.
- **PR-13 · Connect M2:** Recipient-config tutor onboarding (S18), SCT with `transfer_group` splits, batched payout execution, 1099 wiring, reserve/dispute policy engine.

## 8. Source register
- RevenueCat State of Subscription Apps 2025 & 2026 (+ 10-minute summary, Apr 2026): hard paywall vs freemium (10.7%/2.1%, was 12.1%), RPI 8×, Day-0 trials 80–90%, price-tier conversion, anchoring case, trial-length effects — revenuecat.com.
- Adapty education benchmarks (Apr 2026): +50.4% 12-mo LTV for education trial users; category LTV $45.10 — adapty.io. Experiment-lever ranking (trial structure 59.6%) — Adapty/RevenueCat roundup.
- Click-to-cancel: Eighth Circuit vacatur 7/8/25 (Custom Communications v. FTC), FTC pre-2024 restoration 2/12/26 (91 Fed. Reg. 6507), draft ANPRM 1/30/26; ROSCA + CA/NY/VT/OR/MN ARLs remain binding — Latham & Watkins, WilmerHale, Purchy state-law survey, Crowell.
- Stripe docs: Connect charge types + SCT restaurant/deliverer example, destination-charge mechanics + negative-balance liability, SCT cross-border constraints, 1099 calculation from transfers, Accounts v2 deprecating legacy types (Merchant/Customer/Recipient configs) — docs.stripe.com (+ 2026 integration guides for v2 recipient recommendation; payout fee figure third-party, verify).
- Tutoring competitors: TutorBird 30-day trial/$14.95, TutorCruncher 2-week trial + payroll/split payments, Teachworks base+per-lesson, Tutorbase payroll engine — pinlearn, wise.live, tutorcruncher.com, tutorbase.com (2025–26).
- Noto: fees page (3.0% + $0.30 card, 3.3% Amex, 0.5% ACH, deducted pre-deposit), pricing tiers (Basic/Studio incl. Staff Payroll/Pro/Enterprise), ACH savings positioning — withnoto.com.
- Expo Router protected routes: `Stack.Protected` guards, nesting, deep-link enforcement, anchor redirect, history purge on guard flip — docs.expo.dev (May 2026).
