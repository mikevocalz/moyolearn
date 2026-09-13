'use client';
// FD-26 state — the delete-account screen's half of a deletion.
//
// NOTHING HERE IS OPTIMISTIC, and that is the difference between this store and
// `memory.store.ts`. An erased memory line can be put back on the screen if the
// request fails, because the screen outlives the request. An account deletion
// that succeeds takes the session with it: there is nothing to reconcile
// against afterwards and nobody left to show a correction to. So the request
// goes first and the screen changes only on the answer.
//
// THE SHAPES ARE DECLARED, NOT IMPORTED. `account-deletion.service.ts` opens
// with `import 'server-only'` and this module runs in a browser and on a phone
// — the same reason `memory.store.ts` restates `ErasedMedia`. They are narrowed
// from the parsed body rather than asserted, so a response that stops matching
// reads as "we cannot vouch for this" instead of throwing on the one screen
// whose whole job is to be truthful about deletion.
// SOT: packages/app/features/account/account-deletion.service.ts · docs/38-front-door-and-flow.md §5A FD-26
// SOT-KEYWORDS: account deletion store fd-26 zustand confirm delete learner wards guardian receipt
import { create } from 'zustand';
import { API_URL } from '../../core/api-url.ts';
import { DELETE_CONFIRM_WORD, DELETION_OUTCOME_COPY, DELETION_REFUSAL_COPY } from './account-deletion.copy.ts';

/** A learner row as `GET /api/account/learners` sends it. */
export interface LearnerRow {
  readonly learnerAuthId: string;
  readonly displayName: string;
  readonly soleGuardian: boolean;
}

interface DeletionResponse {
  keptWards?: readonly string[];
  mediaIncomplete?: boolean;
  heldReports?: number;
  /** Present on a refusal; one of `DeletionRefusal`. */
  reason?: string;
}

const isRefusal = (value: string | undefined): value is keyof typeof DELETION_REFUSAL_COPY =>
  value !== undefined && value in DELETION_REFUSAL_COPY;

/**
 * The sentence a 200 still owes.
 *
 * Order matters: held reports are a policy fact the person keeps living with,
 * uploads left behind are a temporary one, and a clean sweep owes nothing. Only
 * one sentence is shown, so the more durable fact wins.
 */
const outcomeNotice = (body: DeletionResponse): string | null => {
  if ((body.heldReports ?? 0) > 0) return DELETION_OUTCOME_COPY.heldReports;
  if (body.mediaIncomplete === true) return DELETION_OUTCOME_COPY.mediaIncomplete;
  return null;
};

interface AccountDeletionState {
  /** The learners this account may delete; empty until the read lands. */
  learners: readonly LearnerRow[];
  /** False until `loadLearners` has answered, so the list never renders a false zero. */
  learnersLoaded: boolean;
  /** Doc 38 FD-26's type-to-confirm field. */
  confirmText: string;
  /** True while a delete is in the air; both buttons are inert then. */
  working: boolean;
  /** A refusal or a failure, as a sentence. Null the rest of the time. */
  error: string | null;
  /** What a completed deletion still owes the person, or null. */
  notice: string | null;
  /** The learner awaiting confirmation; null when the dialog is closed. */
  pendingLearner: LearnerRow | null;

  loadLearners: () => Promise<void>;
  setConfirmText: (value: string) => void;
  /** Resolves true when the account is gone and the caller should leave. */
  deleteAccount: () => Promise<boolean>;
  askDeleteLearner: (learner: LearnerRow) => void;
  cancelDeleteLearner: () => void;
  confirmDeleteLearner: () => Promise<void>;
}

/** True only on the exact word — doc 38 FD-26 spells it in capitals. */
export const confirmArmed = (state: AccountDeletionState): boolean =>
  state.confirmText === DELETE_CONFIRM_WORD && !state.working;

export const useAccountDeletionStore = create<AccountDeletionState>((set, get) => ({
  learners: [],
  learnersLoaded: false,
  confirmText: '',
  working: false,
  error: null,
  notice: null,
  pendingLearner: null,

  /**
   * A failed read leaves `learnersLoaded` false rather than settling on an
   * empty list. An empty list is a claim — "you look after nobody" — and on
   * this screen that claim reads as the children having already been removed.
   */
  loadLearners: async () => {
    try {
      const response = await fetch(`${API_URL}/api/account/learners`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body: { learners?: readonly LearnerRow[] } = await response.json();
      set({ learners: body.learners ?? [], learnersLoaded: true });
    } catch {
      set({ learnersLoaded: false });
    }
  },

  setConfirmText: (confirmText) => set({ confirmText, error: null }),

  deleteAccount: async () => {
    if (!confirmArmed(get())) return false;
    set({ working: true, error: null, notice: null });

    try {
      /*
        No body. `POST /api/account/delete` never reads one — the account is
        `ctx.learnerId` — so sending a payload here would invent a field the
        route would have to start ignoring.
      */
      const response = await fetch(`${API_URL}/api/account/delete`, {
        method: 'POST',
        credentials: 'include',
      });
      const body: DeletionResponse = await response
        .json()
        .then((parsed: DeletionResponse) => parsed)
        .catch(() => ({}));

      if (!response.ok) {
        set({
          working: false,
          error: isRefusal(body.reason)
            ? DELETION_REFUSAL_COPY[body.reason]
            : DELETION_OUTCOME_COPY.failed,
        });
        return false;
      }

      set({ working: false, notice: outcomeNotice(body) });
      return true;
    } catch {
      set({ working: false, error: DELETION_OUTCOME_COPY.failed });
      return false;
    }
  },

  askDeleteLearner: (pendingLearner) => set({ pendingLearner, error: null, notice: null }),
  cancelDeleteLearner: () => set({ pendingLearner: null }),

  confirmDeleteLearner: async () => {
    const learner = get().pendingLearner;
    if (learner === null) return;
    set({ working: true, pendingLearner: null, error: null, notice: null });

    try {
      const response = await fetch(`${API_URL}/api/account/learners/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        /*
          The only id a caller may name, and the server checks it against the
          ward list it resolved from the session — see `planAccountDeletion`.
        */
        body: JSON.stringify({ learnerAuthId: learner.learnerAuthId }),
      });
      const body: DeletionResponse = await response
        .json()
        .then((parsed: DeletionResponse) => parsed)
        .catch(() => ({}));

      if (!response.ok) {
        set({
          working: false,
          error: isRefusal(body.reason)
            ? DELETION_REFUSAL_COPY[body.reason]
            : DELETION_OUTCOME_COPY.failed,
        });
        return;
      }

      set((state) => ({
        working: false,
        learners: state.learners.filter((row) => row.learnerAuthId !== learner.learnerAuthId),
        notice: outcomeNotice(body),
      }));
    } catch {
      set({ working: false, error: DELETION_OUTCOME_COPY.failed });
    }
  },
}));
