// The voice composition root — where the durable voice budget ledger is
// installed and where the egress becomes a port the app package can hold.
//
// Mirrors `lib/inference.ts` exactly, and for its reasons: `@acme/voice` owns
// the `VoiceBudgetLedger` PORT and cannot own its implementation — the egress
// holds the ElevenLabs credential and must never also hold a read path into
// the educational store (`tooling/check-voice-egress.mjs`). Installed at
// module evaluation, last-write-wins, so the first spoken sentence after a
// cold start cannot race the installation onto a Map that dies with the
// lambda.
//
// This file is one of the FOUR permitted importers of `@acme/voice` (the
// egress check names them). The app package reaches the egress only through
// the `SpeakSentence` port below — a feature cannot import its way to the
// credential.
// SOT: docs/pack/32-tutor-voice-tone.md §5 · packages/voice/src/budget.ts · tooling/check-voice-egress.mjs
// SOT-KEYWORDS: voice composition root ledger install egress port speak sentence adapter
import 'server-only';
import { installVoiceBudgetLedger, voiceEgress } from '@acme/voice';
import type { SpeakSentence } from '@acme/app/server';
import { durableVoiceBudgetLedger } from './budget-ledger.repository';

installVoiceBudgetLedger(durableVoiceBudgetLedger());

/**
 * The live path, as the port `voice.service.ts` accepts. The learner id it
 * forwards is the BUDGET key from `ProtectedCtx` — the egress has no field it
 * could travel to the provider in.
 */
export const speakSentenceViaEgress: SpeakSentence = async (input) => {
  const spoken = await voiceEgress().speakSentence(input);
  if (spoken.kind === 'text-only') return { kind: 'text-only' };
  return { kind: 'audio', contentType: spoken.contentType, stream: spoken.stream };
};
