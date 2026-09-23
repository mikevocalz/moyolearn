// FD-26 — account deletion, on the server, where deletion actually happens.
//
// App Review guideline 5.1.1(v) has been unmet since the day the first account
// was created: `settings-content.tsx` offered `Sign out` and a comment saying
// the delete flow was missing, and the only `deleteUser` calls in the repo were
// `create-managed-learner.ts`'s rollback for a learner whose consent write
// failed. Sign-out is not deletion and a support address is not an in-app
// control, so this is the flow the comment was waiting for.
//
// THE SUBJECT SET IS DERIVED, NEVER NAMED. `planAccountDeletion` is pure and
// takes the ownership the repository resolved FROM `ctx` — guardianship rows,
// organisation ownership. A request may say "delete the learner with this id",
// and the plan answers by looking that id up in the ward list that came off the
// session: an id naming somebody else's child is simply not in the list, so the
// worst a hostile body can do is get a refusal. This is the same shape
// `memory.service.ts` uses for `factId`, stated once here because deletion is
// where getting it wrong is unrecoverable.
//
// WHY THE CAPABILITY IS THE FREE FLOOR AND NOT `write`. `docs/release/
// app-store-readiness.md:209` specifies `requires: 'write'`. That is wrong on
// this codebase's own rule, argued three times in `memory.service.ts`: a family
// whose card lapsed must still be able to delete what we know about their
// child. `write` is a paid capability, so `requires: 'write'` would put a
// failed payment between a parent and their COPPA erasure right — and a lapsed
// card would then produce a 402, which is an upsell surface, in answer to
// "delete my child's data". The floor (`practise`, the default) is the only
// defensible setting.
//
// WHAT A LEGAL HOLD DOES. Doc 31 §4.1 keeps S4 and abuse-disclosure incident
// reports outside every retention schedule, and `docs/design/counsel-review-s4.md`
// §4 Q5 records that whether a guardian's erasure may reach held material is an
// open question for counsel. So held reports are NOT deleted here and the count
// travels back in the receipt: retaining is the fail-closed direction, and the
// confirmation copy says so rather than letting a parent believe otherwise.
// SOT: docs/38-front-door-and-flow.md §5A FD-26 · docs/pack/06-auth-onboarding-spec.md §2 §6 · docs/pack/07-security-child-ai-safety-spec.md §4 · docs/release/app-store-readiness.md §3 · CLAUDE.md §The block
// SOT-KEYWORDS: account deletion fd-26 erasure cascade guardian managed learner ward legal hold protected operation 5.1.1 apple app store coppa withdraw consent
import 'server-only';
import type { Auth } from '@acme/auth/server';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import type { ErasedMedia } from '../memory/memory.service.ts';

export type { ErasedMedia };

/**
 * The brand. A `DeletionSubject` is the only thing the erasure ports accept,
 * and the only constructor is `subjectOf` in this file — which is reached only
 * from `planAccountDeletion`, which only ever names ids it found in the
 * ownership the session resolved.
 *
 * Identity is never a parameter (CLAUDE.md §The block), and on a deletion path
 * "never" wants to be checked by the compiler rather than by review: a string
 * cannot be passed where a subject is expected, so no future route can hand a
 * repository an id that arrived in a request body.
 */
declare const subjectBrand: unique symbol;

export type DeletionSubjectKind = 'account-holder' | 'managed-learner';

export interface DeletionSubject {
  readonly authId: string;
  readonly kind: DeletionSubjectKind;
  /** For the receipt, so a guardian is told which child by name and not by id. */
  readonly displayName: string | null;
  readonly [subjectBrand]: true;
}

/*
  The cast is the brand's whole mechanism: `subjectBrand` is `declare`d, so it
  exists in the type system and nowhere at runtime, and this is the one place
  allowed to mint the nominal type. Narrow and deliberate — not an escape hatch.
*/
const subjectOf = (
  authId: string,
  kind: DeletionSubjectKind,
  displayName: string | null,
): DeletionSubject => ({ authId, kind, displayName }) as DeletionSubject;

/** A learner this account holds an ACTIVE guardianship over. */
export interface ManagedWard {
  readonly learnerAuthId: string;
  /** The child's name as the guardian knows it; the id when there is no name. */
  readonly displayName: string;
  /**
   * False when a SECOND active guardianship covers this learner. Doc 06 §2
   * supports two guardians per learner from day one, so a household splitting
   * is an ordinary case rather than an edge one, and the two directions differ:
   * a guardian deleting their OWN account is leaving, which must not take a
   * child the other parent still has; a guardian deleting THE CHILD is
   * withdrawing consent, which stops processing whoever else consented.
   */
  readonly soleGuardian: boolean;
}

/** What else hangs off this account — resolved from `ctx`, never from input. */
export interface AccountOwnership {
  readonly wards: readonly ManagedWard[];
  /**
   * Organisations where this account is the only remaining `owner` member.
   *
   * Deleting the last owner would leave a school or tutoring business with
   * nobody able to administer it, and its records belong to the organisation
   * rather than to the person — so this refuses instead of guessing whether to
   * orphan the org or destroy a district's classes with one adult's account.
   * Ops creates organisations (`allowUserToCreateOrganization: false`), so no
   * self-serve signup can land here.
   */
  readonly soleOwnedOrgs: readonly string[];
}

export type LoadAccountOwnership = (ctx: ProtectedCtx) => Promise<AccountOwnership>;

/** Rows the educational store held for one subject, as they were deleted. */
export interface EduErasure {
  readonly transcripts: number;
  readonly facts: number;
  readonly blockedTags: number;
}

/** Rows the Payload store held for one subject, and the ones it kept. */
export interface PayloadErasure {
  /** Every learner-scoped and guardian-scoped row that went, counted together. */
  readonly rows: number;
  /**
   * Session summaries (doc 34 §3). Counted apart because they have no TTL and
   * the sweep never touches them, so an erasure is the only thing that ever
   * removes one — a zero here on an account with sessions is a bug, not a
   * quiet success.
   */
  readonly summaries: number;
  /**
   * Safety reports a legal hold KEPT (doc 31 §4.1). Not an error and not a
   * failure — the one category of record this deletion deliberately does not
   * reach, surfaced so the confirmation can say so.
   */
  readonly heldReports: number;
}

export type EraseSubjectEdu = (ctx: ProtectedCtx, subject: DeletionSubject) => Promise<EduErasure>;
export type EraseSubjectPayload = (
  ctx: ProtectedCtx,
  subject: DeletionSubject,
) => Promise<PayloadErasure>;
export type EraseSubjectMedia = (ctx: ProtectedCtx, subject: DeletionSubject) => Promise<ErasedMedia>;
/** Better Auth's own user, session and account rows, plus any org membership. */
export type DeleteAuthUser = (ctx: ProtectedCtx, subject: DeletionSubject) => Promise<void>;

/**
 * One port per store, grouped into a single argument.
 *
 * The grouping is `ForgetEverythingPorts`' reasoning applied to a longer list:
 * five optional parameters is how one of them ends up never passed, and the one
 * that gets forgotten on a deletion path is the one that leaves a child's
 * photographs on a CDN after a parent was told they were gone.
 */
export interface AccountDeletionPorts {
  readonly loadOwnership: LoadAccountOwnership;
  readonly eraseEdu: EraseSubjectEdu;
  readonly erasePayload: EraseSubjectPayload;
  readonly eraseMedia: EraseSubjectMedia;
  readonly deleteAuthUser: DeleteAuthUser;
}

/** Why a deletion did not run. Every case is actionable by the person asking. */
export type DeletionRefusal =
  /** A guardian-managed learner may not delete the account their guardian owns. */
  | 'managed-learner'
  /** The named learner is not an active ward of this account. */
  | 'not-your-learner'
  /** The account is the last owner of an organisation. */
  | 'sole-org-owner';

/**
 * 403-shaped, and it carries the reason as a discriminant rather than as a
 * sentence, so the copy lives on the screen (`account-deletion.copy.ts`) and a
 * route never has to author words a child's guardian will read.
 */
export class AccountDeletionRefused extends Error {
  readonly status = 403;
  readonly reason: DeletionRefusal;

  constructor(reason: DeletionRefusal) {
    super(`Account deletion refused: ${reason}`);
    this.name = 'AccountDeletionRefused';
    this.reason = reason;
  }
}

/** What the caller asked to delete. `self` names nothing, on purpose. */
export type DeletionRequest =
  | { readonly target: 'self' }
  | { readonly target: 'learner'; readonly learnerAuthId: string };

/**
 * The acting account, as the plan needs it. Both fields come off `ProtectedCtx`
 * at the boundary below; the plan is pure so the decision can be held by a test
 * without a session, a database or a clock (`safetyStatusFrom`'s reasoning).
 */
export interface AccountHolder {
  readonly authId: string;
  readonly isLearner: boolean;
}

export type DeletionPlan =
  | {
      readonly ok: true;
      /** Wards first, holder last — see `executeDeletionPlan`. */
      readonly subjects: readonly DeletionSubject[];
      /** Children left standing because another guardian is still active. */
      readonly keptWards: readonly string[];
    }
  | { readonly ok: false; readonly refusal: DeletionRefusal };

/**
 * Who gets deleted, decided from ownership alone.
 *
 * A GUARDIAN DELETING THEMSELVES TAKES THE CHILDREN ONLY THEY HOLD. A managed
 * learner exists because a guardian consented — `create-managed-learner.ts`
 * enforces that invariant at creation and rolls the account back if the consent
 * write fails — so a child whose only consenting guardian is gone has no
 * standing consent, and leaving the account behind would be operating on a
 * minor's data with nobody to answer for it. A child the other parent still
 * holds is NOT taken: that guardianship and that consent are untouched.
 *
 * A GUARDIAN DELETING ONE CHILD TAKES THAT CHILD WHOEVER ELSE HOLDS THEM.
 * Withdrawal by a verified parent stops processing; it is not a vote.
 */
export function planAccountDeletion(
  holder: AccountHolder,
  ownership: AccountOwnership,
  request: DeletionRequest,
): DeletionPlan {
  if (holder.isLearner) return { ok: false, refusal: 'managed-learner' };

  if (request.target === 'learner') {
    const ward = ownership.wards.find((w) => w.learnerAuthId === request.learnerAuthId);
    /*
      The whole authorisation check, and it is a lookup rather than a comparison
      on purpose: `ownership.wards` came off the session, so an id that is not
      in it belongs to nobody this account is responsible for — including the
      case where it belongs to a real child of a different family.
    */
    if (ward === undefined) return { ok: false, refusal: 'not-your-learner' };
    return {
      ok: true,
      subjects: [subjectOf(ward.learnerAuthId, 'managed-learner', ward.displayName)],
      keptWards: [],
    };
  }

  if (ownership.soleOwnedOrgs.length > 0) return { ok: false, refusal: 'sole-org-owner' };

  const taken = ownership.wards.filter((ward) => ward.soleGuardian);
  const kept = ownership.wards.filter((ward) => !ward.soleGuardian);

  return {
    ok: true,
    subjects: [
      ...taken.map((ward) => subjectOf(ward.learnerAuthId, 'managed-learner', ward.displayName)),
      subjectOf(holder.authId, 'account-holder', null),
    ],
    keptWards: kept.map((ward) => ward.displayName),
  };
}

/** What one subject's deletion did, as the confirmation screen needs to hear it. */
export interface SubjectReceipt {
  readonly kind: DeletionSubjectKind;
  /** Null for the account holder — they are reading the screen. */
  readonly displayName: string | null;
  readonly edu: EduErasure;
  readonly payload: PayloadErasure;
  readonly media: ErasedMedia;
}

export interface DeletionReceipt {
  readonly subjects: readonly SubjectReceipt[];
  readonly keptWards: readonly string[];
  /**
   * True when any subject's uploads could not be PROVEN gone — a school
   * account with no per-child prefix (`presign.rules.ts:learnerMediaScope`), or
   * Bunny refusing. The record went either way; this is the sentence the screen
   * owes, because "everything is deleted" said over surviving files is this
   * feature's failure wearing a success message.
   */
  readonly mediaIncomplete: boolean;
  /** Safety reports a legal hold kept, across every subject. */
  readonly heldReports: number;
}

const incomplete = (media: ErasedMedia): boolean => !media.scoped || media.failed.length > 0;

/**
 * Runs a plan. Exported for the test that proves the ORDER, and not re-exported
 * from `@acme/app/server`: the boundary is `deleteOwnAccount` /
 * `deleteManagedLearner`, and a route reaching past them would be handing a
 * `ProtectedCtx` it built itself.
 *
 * ORDER IS PART OF THE CONTRACT, twice over.
 *
 * Between subjects: wards before the holder. The ward list is reachable only
 * through the holder's guardianship rows, so deleting the holder first would
 * cut every remaining child loose mid-cascade — rows nothing can trace to
 * anybody, which is the exact failure `sweep.sql` describes for orphaned
 * version rows.
 *
 * Within a subject: rows, then summaries, then objects, then the auth user.
 * `memory.service.ts` argues the rows-before-objects half — a Bunny outage must
 * not leave a child's transcripts in the database — and the auth user goes last
 * for the same reason in the other direction: the id on every one of those rows
 * is the user row's id, so deleting it first turns the rest of the cascade into
 * a scan with no key.
 */
export async function executeDeletionPlan(
  ctx: ProtectedCtx,
  plan: Extract<DeletionPlan, { ok: true }>,
  ports: AccountDeletionPorts,
): Promise<DeletionReceipt> {
  const receipts: SubjectReceipt[] = [];

  for (const subject of plan.subjects) {
    const edu = await ports.eraseEdu(ctx, subject);
    const payload = await ports.erasePayload(ctx, subject);
    const media = await ports.eraseMedia(ctx, subject);
    await ports.deleteAuthUser(ctx, subject);
    receipts.push({ kind: subject.kind, displayName: subject.displayName, edu, payload, media });
  }

  return {
    subjects: receipts,
    keptWards: plan.keptWards,
    mediaIncomplete: receipts.some((receipt) => incomplete(receipt.media)),
    heldReports: receipts.reduce((total, receipt) => total + receipt.payload.heldReports, 0),
  };
}

async function deleteInsideBlock(
  auth: Auth,
  headers: Headers,
  request: DeletionRequest,
  ports: AccountDeletionPorts,
  op: string,
): Promise<DeletionReceipt> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const ownership = await ports.loadOwnership(ctx);
      const plan = planAccountDeletion(
        { authId: ctx.learnerId, isLearner: ctx.isLearner },
        ownership,
        request,
      );
      if (!plan.ok) throw new AccountDeletionRefused(plan.refusal);
      return executeDeletionPlan(ctx, plan, ports);
    },
    { telemetry: { op, resource: 'users', action: 'delete' } },
  );
}

/**
 * Deletes the signed-in account and every child only it holds.
 *
 * IT TAKES NO SUBJECT. `POST /api/account/delete` reads no body at all, for the
 * reason `forget-all` states: there is nothing a caller could legitimately say,
 * and an endpoint that could name whose account to destroy is the worst-shaped
 * request in a children's product. The absence is the security property.
 */
export async function deleteOwnAccount(
  auth: Auth,
  headers: Headers,
  ports: AccountDeletionPorts,
): Promise<DeletionReceipt> {
  return deleteInsideBlock(auth, headers, { target: 'self' }, ports, 'account.deleteOwn');
}

/**
 * Deletes one managed learner — the control the consent screen has been
 * promising since `consent-flow-content.tsx:82` told a guardian they could
 * "withdraw it any time from the family screen".
 *
 * The id is the only thing a caller may name, and it is checked against the
 * ward list the session resolved rather than trusted.
 */
export async function deleteManagedLearner(
  auth: Auth,
  headers: Headers,
  learnerAuthId: string,
  ports: AccountDeletionPorts,
): Promise<DeletionReceipt> {
  return deleteInsideBlock(
    auth,
    headers,
    { target: 'learner', learnerAuthId },
    ports,
    'account.deleteLearner',
  );
}

/**
 * The children this account may delete, for the screen that lists them.
 *
 * The same `loadOwnership` port the deletion uses, so the list a guardian is
 * shown and the set the server will act on cannot disagree — a second read
 * would be a second answer to "whose children are these".
 */
export async function managedLearners(
  auth: Auth,
  headers: Headers,
  loadOwnership: LoadAccountOwnership,
): Promise<readonly ManagedWard[]> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => (ctx.isLearner ? [] : (await loadOwnership(ctx)).wards),
    { telemetry: { op: 'account.managedLearners', resource: 'users', action: 'read' } },
  );
}
