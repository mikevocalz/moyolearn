// The per-learner daily VOICE budget (doc 32 §5, riding doc 12 §7's model).
//
// TTS costs money per character, so voice joins the per-learner-day cost model
// as ITS OWN line — doc 32 §6 names the shed order: "voice degrades to text
// before tutoring degrades at all". That order is why this is a separate
// counter rather than a debit against `edu.inference_budget.usd`: a shared
// ceiling would let a chatty afternoon of audio spend a child's TUTORING
// allowance, ending the lesson to pay for the narration. Same table, same row,
// same retention sweep — separate column, separate ceiling (see
// `packages/payload/migrations/edu_inference_budget_voice.sql`).
//
// Exhaustion is SILENT. It is not an error, not a `CoachEvent`, and never a
// surface: the egress returns `text-only`, the route answers 204, and the
// child keeps reading the same words they would have heard. A limit a child
// can see is a limit a child is being blamed with (CLAUDE.md §Children's
// surfaces), and text-only IS the product's stated degraded mode (doc 32 §2).
//
// Same port-and-seam shape as `packages/inference/src/budget.ts`, for the same
// reason: this package must not be able to read the educational store
// (`tooling/check-voice-egress.mjs` fails the build if it grows the import),
// so the durable implementation lives in
// `apps/web/lib/budget-ledger.repository.ts` and is installed from the
// composition root (`apps/web/lib/voice.ts`).
// SOT: docs/pack/32-tutor-voice-tone.md §5 §6 · packages/inference/src/budget.ts · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: voice budget daily characters usd ceiling per band shed order text only silent degradation ledger port install
import 'server-only';
import type { VoiceBand } from '@acme/student-model';

/** What the ledger holds for one learner's voice on one day. */
export interface VoiceLedgerDay {
  readonly chars: number;
  readonly usd: number;
}

/**
 * Storage for the counters. A port for the same reason `BudgetLedger` is one:
 * only repositories touch the database, and this package must not be able to.
 */
export interface VoiceBudgetLedger {
  read(learnerId: string, day: string): Promise<VoiceLedgerDay>;
  /** Adds one utterance's characters and cost. Charged at dispatch. */
  record(learnerId: string, day: string, chars: number, usd: number): Promise<void>;
}

/**
 * Flash v2.5's per-character price, as modelled for the v1 budget. Derived
 * from the current Creator-tier credit price with Flash's half-credit-per-
 * character rate; doc 32 §5 notes pricing moves often and pins it at PR — a
 * change here is a budget review, not a constant tweak.
 */
export const FLASH_USD_PER_CHAR = 0.00011;

export const estimatedUsdFor = (chars: number): number => chars * FLASH_USD_PER_CHAR;

/**
 * Doc 32 §5: the budget is PER BAND, because K-2 runs voice-on-by-default —
 * the voice is that band's primary interface (a six-year-old can't read the
 * chat), which roughly doubles spoken volume. "Budget it, don't discover it."
 * The ceilings model three spoken sessions a day at each band's verbosity,
 * with K-2 given the always-on headroom. Never rendered anywhere.
 */
export const VOICE_BUDGETS: Record<VoiceBand, { readonly dailyUsdCeiling: number }> = {
  'k-2': { dailyUsdCeiling: 2 },
  '3-5': { dailyUsdCeiling: 1.2 },
  '6-8': { dailyUsdCeiling: 0.8 },
  '9-12': { dailyUsdCeiling: 0.8 },
};

/**
 * A union rather than a boolean so the spent arm carries nothing a surface
 * could accidentally render — same shape discipline as `SessionBudgetState`.
 */
export type VoiceBudgetState = { readonly kind: 'open' } | { readonly kind: 'spent' };

export function voiceBudgetStateFor(day: VoiceLedgerDay, band: VoiceBand): VoiceBudgetState {
  return day.usd >= VOICE_BUDGETS[band].dailyUsdCeiling ? { kind: 'spent' } : { kind: 'open' };
}

/**
 * The ledger key: a UTC calendar day, identical semantics to
 * `packages/inference/src/budget.ts:dayKey` and for its reason — a rolling
 * window gives a child a different allowance at 5pm than at 7pm for reasons no
 * guardian could be told. (That function is not on `@acme/inference`'s public
 * surface, and this package may not import it regardless.)
 */
export function voiceDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The process-local ledger — the TEST double and the loud fallback, never the
 * production ledger, exactly as `inMemoryLedger` is for inference.
 */
export function inMemoryVoiceLedger(): VoiceBudgetLedger {
  const days = new Map<string, VoiceLedgerDay>();
  const key = (learnerId: string, day: string): string => `${learnerId} ${day}`;

  return {
    read: async (learnerId, day) => days.get(key(learnerId, day)) ?? { chars: 0, usd: 0 },
    record: async (learnerId, day, chars, usd) => {
      const current = days.get(key(learnerId, day)) ?? { chars: 0, usd: 0 };
      days.set(key(learnerId, day), { chars: current.chars + chars, usd: current.usd + usd });
    },
  };
}

let installedLedger: VoiceBudgetLedger | undefined;
const processLocalLedger: VoiceBudgetLedger = inMemoryVoiceLedger();
let warnedAboutFallback = false;

/**
 * Installs the process-wide voice ledger. Last-write-wins, not throwing, for
 * the reason `installBudgetLedger` gives: a Next.js route module can be
 * evaluated more than once in one process.
 */
export function installVoiceBudgetLedger(ledger: VoiceBudgetLedger): void {
  installedLedger = ledger;
}

/**
 * The ledger the shared egress counts against. Late-bound — the slot is read
 * on every call — so an egress constructed before installation still picks the
 * durable ledger up. The fallback is noisy once and never fatal: fatal would
 * be an error where a child expected a voice, and voice's stated failure mode
 * is silence with the text still there.
 *
 * No learner id in the warning line — it is the budget key, and an operations
 * log is not a place a child's handle needs to be.
 */
export function sharedVoiceBudgetLedger(): VoiceBudgetLedger {
  const active = (): VoiceBudgetLedger => {
    if (installedLedger !== undefined) return installedLedger;
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.error(
        '[voice] no durable voice budget ledger installed — the daily voice ceiling is ' +
          'process-local and will not survive a deploy. Call installVoiceBudgetLedger() from ' +
          'the composition root.',
      );
    }
    return processLocalLedger;
  };

  return {
    read: (learnerId, day) => active().read(learnerId, day),
    record: (learnerId, day, chars, usd) => active().record(learnerId, day, chars, usd),
  };
}
