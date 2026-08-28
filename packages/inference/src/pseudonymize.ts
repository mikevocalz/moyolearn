// The last thing that touches a payload before it leaves the building.
//
// ADR-005 §1: pseudonymous payloads only — session handle, grade band, concept,
// mastery, attempt, misconception; never name, DOB, school, or contact. The
// system half already satisfies that structurally: it is `PEDAGOGY_CONTRACT`
// plus `briefPreamble(LearnerBrief)`, and `LearnerBrief` has no field for a
// name, so there is no assignment to forget.
//
// The message half does not, and that is the gap this file closes. It carries
// the child's own words and OCR'd worksheet text verbatim, and a photographed
// worksheet header says `Name: ______` with the blank filled in. The Safety
// Plane does not catch it: `firewall.ts`'s six rules are grooming patterns, and
// its `contact-request` rule is scoped to the TUTOR asking rather than the child
// volunteering.
//
// Deterministic rather than model-backed, and the reason is not cost: a
// redactor that needs a model call to decide what to redact has already sent
// the thing it was redacting.
//
// It errs toward over-redaction. A masked phone number in a word problem costs
// the tutor a detail it did not need; an unmasked one is a child's phone number
// in a vendor's logs.
// SOT: docs/design/inference-gateway.md §4.3 · docs/pack/01-ai-tutoring-platform-plan.md ADR-005 §1 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: pseudonymization redaction pii scrub egress ocr worksheet name email phone address boundary
import 'server-only';
import type { InferencePayload } from './types.ts';

/** What a redacted span reads as. One token, so a test can count them. */
export const REDACTED = '[redacted]';

/**
 * Ordered because the rules overlap: a worksheet header line is matched whole
 * and replaced before the email rule can get at a name inside it, which keeps
 * one field from being redacted twice into `[redacted]: [redacted]`.
 *
 * Each entry says what it is for, because a bare regex list is a list nobody
 * can safely delete from.
 */
const RULES: readonly { readonly id: string; readonly pattern: RegExp; readonly replace: string }[] = [
  {
    // The OCR'd worksheet header. `Name: Ada Lovelace`, `Student — Ada`,
    // `Pupil's name: Ada`. The label is kept so the model still sees that a
    // header was there and does not read the redaction as part of the problem.
    id: 'header-name',
    pattern:
      /\b(name|student|pupil|learner|child|teacher|parent|guardian|class|school|dob)(?:'s)?\s*(?:name)?\s*[:\-–—]\s*[^\n]*/gi,
    replace: `$1: ${REDACTED}`,
  },
  {
    id: 'email',
    pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    replace: REDACTED,
  },
  {
    // A date of birth, in the two shapes an OCR'd form produces. Two separators
    // are required, so the fraction `3/4` and the time `9.15` are untouched.
    id: 'date',
    pattern: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/g,
    replace: REDACTED,
  },
  {
    // Nine digits or more with the usual separators. Deliberately loose: an
    // arithmetic problem is short numbers, and a long digit run in a homework
    // question is a phone number or an account, never a sum.
    //
    // The separator class is spaces and punctuation but NOT `\s`, which would
    // include newlines: a phone number on one line and a sum on the next would
    // then match as one run and take the sum's first operand with it.
    //
    // A `-` COUNTS AS A SEPARATOR ONLY BETWEEN TWO DIGITS, which is the whole
    // difference between `555-123-4567` and `1000 - 250 - 125`. Without the
    // lookarounds the separator class swallowed the spaced minus and every
    // chain of subtractions was a "digit run": `45.75 - 12.50` reached the
    // model as `[redacted] = ?`, which is the silent-blanking failure this
    // file's header is written about. A homework subtraction is spaced; a
    // phone number is not.
    id: 'phone',
    pattern: /\+?\d(?:[\d ().]|(?<=\d)-(?=\d)){7,}\d/g,
    replace: REDACTED,
  },
  {
    id: 'street-address',
    pattern:
      /\b\d{1,5}\s+[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)*\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|court|ct|way|boulevard|blvd|terrace|crescent)\b\.?/gi,
    replace: REDACTED,
  },
  {
    // UK postcode and US ZIP+4. A bare five-digit ZIP is left alone: it is
    // indistinguishable from a number in a word problem, and the phone rule
    // already covers the longer runs.
    id: 'postcode',
    pattern: /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|\d{5}-\d{4})\b/gi,
    replace: REDACTED,
  },
];

/**
 * Masks contact-shaped spans in free text. Idempotent: running it twice yields
 * the same string, which is what lets the gateway scrub on assembly and the
 * adapter scrub again at the socket without producing nested redactions.
 */
export function scrubText(text: string): string {
  let out = text;
  for (const rule of RULES) out = out.replace(rule.pattern, rule.replace);
  return out;
}

/**
 * The egress boundary.
 *
 * Both halves are scrubbed even though the system half is assembled from
 * `LearnerBrief` and cannot carry a name today. That is the point: the day
 * someone widens the brief, the scrub is already in the path, and a widening
 * that gets past it has to get past `check-no-training-path.mjs` and the egress
 * assertion in the test suite as well.
 */
export function scrubOutbound(payload: InferencePayload): InferencePayload {
  return { system: scrubText(payload.system), message: scrubText(payload.message) };
}
