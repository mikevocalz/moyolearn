/**
 * The Rive → application command vocabulary for the `LearningQuestion`
 * artboard — same single-channel discipline as `board-chrome-commands.ts`:
 * `command` carries WHAT, `commandArg` carries WHICH (the choice index for
 * select/toggle), and `commandSeq` carries WHEN. Listeners write the three;
 * the binding observes `commandSeq`, decodes, and acknowledges by writing
 * `command` back to 0 so a restarted runtime never replays a stale press.
 *
 * SOT: this file is the contract; `probes/rive-panel/rive-question/scene.rml`
 *      authors the same numbers on the Rive side.
 * SOT-KEYWORDS: xr rive question chrome command channel intent decode view model binding
 */

/** `command` values — the whole vocabulary, one table. */
export const QUESTION_COMMAND = {
  none: 0,
  selectChoice: 1,
  toggleChoice: 2,
  submit: 3,
  next: 4,
  requestHint: 5,
  startVoice: 6,
  openBoard: 7,
  retry: 8,
  skip: 9,
} as const;

/** What a decoded command asks the application to do. */
export type QuestionChromeIntent =
  | { readonly kind: 'none' }
  | { readonly kind: 'selectChoice'; readonly index: number }
  | { readonly kind: 'toggleChoice'; readonly index: number }
  | { readonly kind: 'submit' }
  | { readonly kind: 'next' }
  | { readonly kind: 'requestHint' }
  | { readonly kind: 'startVoice' }
  | { readonly kind: 'openBoard' }
  | { readonly kind: 'retry' }
  | { readonly kind: 'skip' };

/**
 * Decode `(command, commandArg)` into an intent. Anything outside the
 * vocabulary — a negative choice index, a missing arg, an unknown verb —
 * decodes to `none` rather than throwing: a malformed artboard degrades
 * to a dead button, never to an answer the child did not give.
 */
export function decodeQuestionCommand(command: number, commandArg: number): QuestionChromeIntent {
  const validIndex = Number.isInteger(commandArg) && commandArg >= 0;
  switch (command) {
    case QUESTION_COMMAND.selectChoice:
      return validIndex ? { kind: 'selectChoice', index: commandArg } : { kind: 'none' };
    case QUESTION_COMMAND.toggleChoice:
      return validIndex ? { kind: 'toggleChoice', index: commandArg } : { kind: 'none' };
    case QUESTION_COMMAND.submit: return { kind: 'submit' };
    case QUESTION_COMMAND.next: return { kind: 'next' };
    case QUESTION_COMMAND.requestHint: return { kind: 'requestHint' };
    case QUESTION_COMMAND.startVoice: return { kind: 'startVoice' };
    case QUESTION_COMMAND.openBoard: return { kind: 'openBoard' };
    case QUESTION_COMMAND.retry: return { kind: 'retry' };
    case QUESTION_COMMAND.skip: return { kind: 'skip' };
    default: return { kind: 'none' };
  }
}

/**
 * `XrQuestionPhase` → the `phase` view-model number. The mapping is the
 * contract between the store's phases and the `QuestionFlow` state
 * machine's AnyState transitions — feedback resolves to the correct
 * outcome state when it arrives, which is why `feedback` carries a
 * resolution.
 */
export function phaseToRive(phase: number): number {
  return Math.max(0, Math.min(11, Math.trunc(phase)));
}
