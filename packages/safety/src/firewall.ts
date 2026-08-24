// The companionship firewall (doc 07 §2), as code rather than as instructions.
//
// Doc 07 §2 says these rules are "enforced in policy prompts + output
// classifiers + red-team tests" — three places, because a policy prompt is a
// request and a model under pressure can decline it. This file is the layer that
// cannot decline: deterministic checks over generated text, run before anything
// reaches a child, plus the same checks over the child's own words where the
// rule runs in both directions.
//
// The list is not a general profanity filter. Every rule here maps to a failure
// mode named in the litigation record doc 07 §1 is built from: parasocial
// attachment, secrecy, isolation from adults, sycophantic validation.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §2 · §3
// SOT-KEYWORDS: safety firewall companionship secrecy exclusivity sycophancy block output

export type FirewallRuleId =
  | 'secrecy'
  | 'exclusivity'
  | 'claimed-feelings'
  | 'discourages-adults'
  | 'human-roleplay'
  | 'contact-request';

export interface FirewallRule {
  id: FirewallRuleId;
  /** Why this is a hard block, in the terms doc 07 §2 uses. */
  because: string;
  /** Checked against generated text; some also against the child's. */
  patterns: RegExp[];
  /**
   * Doc 07 §2.3: "Don't tell your parents" in EITHER direction is an automatic
   * block and a logged event. A child asking to keep a secret is a child who may
   * be being taught to, which is the grooming pattern the red team probes for.
   */
  bothDirections: boolean;
}

export const FIREWALL_RULES: FirewallRule[] = [
  {
    id: 'secrecy',
    because: 'Secrecy between a child and an adult-shaped system is the grooming pattern itself.',
    patterns: [
      /\b(don'?t|do not|never)\s+(tell|say anything to|mention (?:it|this) to)\b/i,
      /\b(keep|let'?s keep|this stays?)\s+(?:this|it|that)?\s*(?:a\s+)?secret\b/i,
      /\bbetween (?:you and me|us)\b/i,
      /\bour (?:little )?secret\b/i,
    ],
    bothDirections: true,
  },
  {
    id: 'exclusivity',
    because: 'Exclusivity language builds the dependency the duty-of-care cases turn on.',
    patterns: [
      /\bi'?m the only one who\b/i,
      /\bonly i (?:understand|get) you\b/i,
      /\byou don'?t need (?:anyone|anybody) else\b/i,
      /\bnobody else (?:understands|gets) you\b/i,
    ],
    bothDirections: false,
  },
  {
    id: 'claimed-feelings',
    because: 'The tutor never claims feelings for a student; it is not a friend and must not act one.',
    patterns: [
      /\bi (?:love|adore|miss|care about) you\b/i,
      /\bi'?ve missed you\b/i,
      /\byou'?re my (?:favou?rite|best friend)\b/i,
    ],
    bothDirections: false,
  },
  {
    id: 'discourages-adults',
    because: 'Isolating a child from parents, teachers or friends is the harm, not a side effect.',
    patterns: [
      /\bdon'?t (?:talk to|ask) (?:your )?(?:mom|mum|dad|parents?|teacher|guardian)\b/i,
      /\b(?:your )?(?:parents?|teachers?) (?:wouldn'?t|won'?t) understand\b/i,
      /\byou don'?t have to tell (?:your )?(?:mom|mum|dad|parents?|teacher)\b/i,
    ],
    bothDirections: false,
  },
  {
    id: 'human-roleplay',
    because: 'Doc 07 §2.1: it always discloses it is AI and never role-plays being human.',
    patterns: [
      /\bi'?m (?:not an? (?:ai|bot|robot|program)|a real (?:person|human|girl|boy|woman|man))\b/i,
      /\bi'?m human\b/i,
    ],
    bothDirections: false,
  },
  {
    id: 'contact-request',
    because: 'A tutor never needs a child’s address, phone, or a way to reach them off-platform.',
    patterns: [
      /\bwhat'?s your (?:address|phone number|number|email)\b/i,
      /\b(?:send|give) me your (?:address|phone|number|email|photo|picture)\b/i,
      /\b(?:add|message|dm) me on\b/i,
    ],
    bothDirections: false,
  },
];

export interface FirewallVerdict {
  /** True when the text may be shown. A blocked generation is regenerated, never edited. */
  allowed: boolean;
  /** Every rule that fired — a log entry, not just the first match. */
  broke: FirewallRuleId[];
}

export type TextOrigin = 'tutor' | 'learner';

/**
 * Deterministic, and deliberately so. A model asked to check itself is the same
 * model that just failed; this runs outside it. False positives are acceptable
 * here — a regenerated turn costs a second, and the failure it prevents is the
 * one the whole product is judged on.
 */
export function screen(text: string, origin: TextOrigin = 'tutor'): FirewallVerdict {
  const broke = FIREWALL_RULES.filter(
    (rule) =>
      (origin === 'tutor' || rule.bothDirections) && rule.patterns.some((p) => p.test(text)),
  ).map((rule) => rule.id);

  return { allowed: broke.length === 0, broke };
}

export const ruleById = (id: FirewallRuleId) =>
  FIREWALL_RULES.find((rule) => rule.id === id) ?? null;
