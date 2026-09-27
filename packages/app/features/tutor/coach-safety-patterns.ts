// The coach turn's deterministic safety floor — shared by the server Safety
// Plane adapter (`tutor-safety.ts`) and the ON-DEVICE tutor (`xr-local-tutor`),
// so a locally generated hint or verdict is held to the same patterns a hosted
// model's output is. This file deliberately carries no `server-only` marker:
// it is pure regex and must be importable inside the headset bundle.
//
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 · tutor-safety.ts
// SOT-KEYWORDS: coach safety patterns crisis prohibited sensitive classifier shared client server floor

import type { InputClass } from '@acme/safety';

export const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)(ing)?\s+(my ?self|me)\b/i,
  /\b(want|going|plan|planning|trying)\s+to\s+(die|end\s+it|not\s+be\s+here)\b/i,
  /\b(suicid|self[\s-]?harm)/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|be\s+here)\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\b(someone|he|she|they|my\s+\w+)\s+(is\s+)?(hurt|hurting|touch|touching|hitting|beat|beating)\s+me\b/i,
  /\bi'?m\s+(not\s+)?safe\b/i,
  /\bafraid\s+to\s+go\s+home\b/i,
];

export const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(bull(y|ied|ying)|picked\s+on|made\s+fun\s+of)\b/i,
  /\bno\s+(one|body)\s+likes\s+me\b/i,
  /\bi'?m\s+(so\s+)?(sad|depressed|worthless|stupid|a\s+failure)\b/i,
  /\bi\s+hate\s+my\s?self\b/i,
  /\b(my\s+)?(parents|mom|dad)\s+(are\s+)?(fighting|divorc|yell)/i,
  /\b(scared|anxious|terrified)\s+(about|of)\b/i,
  /\bcan'?t\s+stop\s+crying\b/i,
];

export const PROHIBITED_PATTERNS: RegExp[] = [
  /\b(sex|sexual|porn|nude|naked)\b/i,
  /\bhow\s+(do|to)\s+i?\s*(make|build)\s+a?\s*(bomb|weapon|gun|poison)\b/i,
  /\b(buy|get|score)\s+(drugs|weed|pills|alcohol)\b/i,
];

export const matchesAny = (patterns: RegExp[], text: string): boolean =>
  patterns.some((pattern) => pattern.test(text));

/**
 * Ordered so the most serious class wins a message that reads as several. A
 * disclosure that also mentions self-harm is a crisis, not a sensitive turn.
 */
export function classifyCoachInput(message: string): InputClass {
  if (matchesAny(CRISIS_PATTERNS, message)) return 'crisis';
  if (matchesAny(PROHIBITED_PATTERNS, message)) return 'prohibited';
  if (matchesAny(SENSITIVE_PATTERNS, message)) return 'sensitive';
  return 'safe';
}

/**
 * The floor for MODEL output: a generated hint or verdict that trips crisis or
 * prohibited patterns is withheld entirely — the caller falls back to authored
 * copy rather than trusting the model's second try.
 */
export function coachOutputSafe(text: string): boolean {
  return !matchesAny(CRISIS_PATTERNS, text) && !matchesAny(PROHIBITED_PATTERNS, text);
}
