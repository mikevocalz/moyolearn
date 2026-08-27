<!--
  Sequence diagram — guardian creates a child account (doc 12 §5, flow 3 of 5).
  Why it exists: doc 12 §9.1 asks for this flow with exact operation names and
  failure branches. Doc 12 §5 specifies "one transaction, audit event, 7-day
  unlinked cleanup job scheduled". The code deliberately does NOT use one
  transaction and says why in its own comment; the audit event and the cleanup
  job do not exist. All three are drawn honestly rather than aspirationally.
  SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/06-auth-onboarding-spec.md §2 §3.1 §6
  SOT-KEYWORDS: sequence diagram guardian creates child managed learner consent guardianship restricted account rollback cleanup coppa audit
-->

# Guardian creates a child — sequence

**Date:** Aug 27, 2026 · **Status:** design of record for §9.1 flow (c)
**Scope:** the single server action of doc 06 §2 — Better Auth username user +
guardianship + consent record + restricted-account flags.

Doc 12 §5 says **"one transaction"**. The implementation is a *compensating
transaction*, and `packages/auth/src/create-managed-learner.ts` states the
reason in its own comment: the learner user lives in the Better Auth `auth`
schema and the guardianship and consent rows live in Payload's `payload` schema,
reached through a different client. There is no single transaction spanning
them. This diagram draws what runs; §5's wording is the aspiration, not the
code.

---

## The diagram

```mermaid
sequenceDiagram
    autonumber
    actor Guardian
    participant Flow as consent flow onboarding
    participant Action as createManagedLearner
    participant Validate as validateCreateLearner
    participant Writer as createPayloadLearnerWriter
    participant BA as Better Auth
    participant Adapter as ctx.internalAdapter
    participant PL as Payload
    participant Hooks as databaseHooks in createAuth

    Guardian->>Flow: completes the consent ladder
    Note over Flow: startChallenge then verifyCode or scoreKba then confirm.<br/>completeConsent stamps CONSENT_POLICY_VERSION 2026-08-01.

    rect rgb(250, 238, 238)
    Note over Flow,Action: NOT YET IMPLEMENTED. No server action or route calls this.
    Flow--xAction: createManagedLearner writer input
    Note over Action: The only references in the tree are<br/>packages/auth/index.ts re-export and the unit test.
    end

    Action->>Validate: validateCreateLearner input
    Validate->>Validate: validateLearnerUsername
    Validate->>Validate: validateLearnerPassword
    Validate->>Validate: validateConsent
    alt any check fails
        Validate-->>Action: ok false reason
        Action-->>Flow: throw CreateLearnerError reason
        Note over Flow: Nothing was written. The guardian retries the field.
    end

    rect rgb(238, 242, 250)
    Note over Action,Adapter: Step 1. The learner user, in the auth schema.
    Action->>Writer: createUser email password name username
    Note right of Action: email is learnerPlaceholderEmail randomUUID.<br/>A child account never carries a real address.
    Writer->>BA: auth.api.signUpEmail body
    Note over BA: The username plugin hooks sign-up/email,<br/>so this is the credential path for a username-only account.
    alt Better Auth returns no user id
        BA-->>Writer: undefined id
        Writer-->>Action: throw Better Auth returned no user id
    end
    BA-->>Writer: user id
    Writer->>Adapter: updateUser id isMinor true guardianManaged true
    Note over Adapter: learnerFields declares both input false,<br/>so a signup payload can never set them.<br/>They are written server-side, after.
    Writer-->>Action: id
    end

    rect rgb(238, 245, 240)
    Note over Action,PL: Steps 2 and 3. The two Payload rows, in the payload schema.
    Action->>Writer: createGuardianship guardianAuthId learnerAuthId
    Writer->>PL: payload.create guardianships status active
    Action->>Writer: createConsent learnerAuthId guardianAuthId method scope policyVersion evidenceRef grantedAt
    Writer->>PL: payload.create consents
    end

    rect rgb(250, 238, 238)
    Note over Action,Adapter: The compensating branch. NOT a rollback.
    alt guardianship or consent write throws
        PL-->>Action: cause
        Action->>Writer: deleteUser id
        Writer->>Adapter: deleteUser id
        Note over Action: The catch swallows a failed delete.<br/>If compensation itself fails, doc 06 §6's<br/>seven-day sweep is the backstop, and that<br/>sweep is NOT YET IMPLEMENTED.
        Action-->>Flow: throw CreateLearnerError Learner rolled back
    end
    end

    Action-->>Flow: learnerAuthId

    rect rgb(242, 242, 242)
    Note over Hooks: Restricted-account enforcement, on every later write.
    Guardian->>BA: any later user update on the learner
    BA->>Hooks: databaseHooks.user.update.before
    Hooks->>Hooks: isRestrictedLearnerUpdate existing incoming
    Hooks->>Hooks: isRestrictedLearnerPasswordChange owner actorId incoming
    Note over Hooks: A managed learner cannot change its own password.<br/>A guardian-initiated reset stays open.
    BA->>Hooks: databaseHooks.session.create.before
    Hooks->>Adapter: findUserById session.userId
    Note over Hooks: guardianManaged sessions get<br/>LEARNER_SESSION_MAX_AGE 7 days<br/>instead of ADULT_SESSION_MAX_AGE 30 days.
    end

    rect rgb(250, 238, 238)
    Note over Action,PL: The two tail obligations from doc 12 §5. Neither exists.
    Action--xPL: auditEvents write
    Note over PL: No auditEvents collection. NOT YET IMPLEMENTED.
    Action--xPL: schedule 7-day-unlinked cleanup job
    Note over PL: No job runner. NOT YET IMPLEMENTED.
    end
```

---

## Ordering, and why it is this order

The file's own header states it: *"Ordered so that a failure can never leave a
child account standing without the consent that authorised it."* The user is
created first because it is the only step that yields the id the other two rows
need; the compensation deletes it if either dependent write fails. The failure
mode being engineered against is a COPPA one — a live child account whose
consent record was never written.

The residual risk is named rather than hidden: if `deleteUser` also fails, the
`.catch(() => {})` swallows it and the orphan survives until a sweep that does
not exist runs. That makes the 7-day cleanup job (below) a **correctness**
requirement here, not just hygiene.

## Seams this diagram relies on

| Seam | File : symbol |
|---|---|
| The action | `packages/auth/src/create-managed-learner.ts` : `createManagedLearner`, `LearnerWriter`, `CreateLearnerError` |
| Input validation | `packages/auth/src/create-learner.ts` : `validateCreateLearner`, `validateLearnerUsername`, `validateLearnerPassword`, `validateConsent`, `CreateLearnerInput`, `ConsentMethod` |
| Placeholder identity | `packages/auth/src/create-learner.ts` : `learnerPlaceholderEmail`, `isPlaceholderEmail` |
| Port binding to the two real systems | `packages/auth/src/payload-learner-writer.ts` : `createPayloadLearnerWriter` |
| Better Auth instance, flags, session policy | `packages/auth/src/server.ts` : `createAuth`, `learnerFields`, `ADULT_SESSION_MAX_AGE`, `LEARNER_SESSION_MAX_AGE`, `Auth` |
| Restricted-account enforcement | `packages/auth/src/server.ts` : `isRestrictedLearnerUpdate`, `isRestrictedLearnerPasswordChange` (wired through `databaseHooks.user.update.before` / `databaseHooks.account.*`) |
| Consent ladder | `packages/auth/src/consent-flow.ts` : `availableMethods`, `startChallenge`, `verifyCode`, `scoreKba`, `confirm`, `completeConsent`, `ConsentRecord`, `CONSENT_POLICY_VERSION`, `needsReconsent`, `KBA_PASS_MARK`, `CODE_TTL_MINUTES`, `MAX_CODE_ATTEMPTS` |
| Consent UI state | `packages/app/features/onboarding/consent/consent.store.ts` · `consent-channel.ts` · `kba.data.ts` · `consent-flow-content.tsx` |
| Guardianship row | `packages/payload/src/collections/Guardianships.ts` : `slug: 'guardianships'`, fields `guardianAuthId`, `learnerAuthId`, `relationship`, `status` |
| Consent row | `packages/payload/src/collections/Consents.ts` : `slug: 'consents'`, fields `learnerAuthId`, `guardianAuthId`, `method`, `scope`, `policyVersion`, `evidenceRef`, `grantedAt` |
| Barrel | `packages/auth/index.ts` : re-exports `createManagedLearner`, `CreateLearnerError`, `createPayloadLearnerWriter` |
| Auth HTTP surface | `apps/web/app/api/auth/[...all]/route.ts` : `auth.handler` · `apps/web/lib/auth.ts` : `auth` |

## NOT YET IMPLEMENTED

1. **One transaction.** By design it is a compensating sequence, not a
   transaction; the source comment explains the two-schema reason. Doc 12 §5's
   "ONE transaction" is not achievable without moving the guardianship and
   consent writes onto the same connection as the Better Auth pool, which is a
   real design decision nobody has taken. Flagging it rather than drawing a
   `BEGIN` that does not exist.
2. **The audit event.** No `auditEvents` collection exists in
   `packages/payload/src/collections/` and none appears in
   `payload-types.ts` `Config['collections']`. `createManagedLearner` writes no
   audit row. Doc 07 §3 layer 10 and doc 05 PR-10 both depend on this store.
3. **The 7-day-unlinked cleanup job.** Doc 06 §3.1 copies Khan's hygiene rule
   ("unlinked child accounts deleted in a short window — 7 days"). There is no
   job runner in the repo at all: no `pg-boss` dependency, no `jobs` schema, no
   queue module. The only scheduled work that exists is a Vercel Cron GET at
   `apps/web/app/api/media/sweep/cron/route.ts`, which is media retention and
   nothing else. See `docs/design/seq-pay-run.md` for the full finding.
4. **The call site.** No server action, route handler, or screen calls
   `createManagedLearner`. The guardian onboarding steps
   (`packages/app/features/onboarding/guardian/steps.ts`, `store.ts`) and the
   consent flow are surfaces without a terminal write.
5. **Consent evidence storage.** `createConsent` accepts an optional
   `evidenceRef: string`. Doc 12 §3 puts consent evidence in a private Supabase
   Storage bucket; media in this product goes to Bunny
   (`apps/web/lib/bunny.repository.ts`). Neither is wired to consent evidence,
   so `evidenceRef` currently has no producer.
6. **Guardian-side password reset.** `isRestrictedLearnerPasswordChange` blocks
   the learner acting on itself and explicitly leaves the guardian-initiated
   path open, but no guardian-initiated reset operation exists to use it.
