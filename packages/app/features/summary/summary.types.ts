// Doc 34 §2's report anatomy — the eight blocks, fixed order, as types.
//
// THE SCHEMA IS THE ANTI-SYCOPHANCY MECHANISM. §1's trap is a report engineered
// to make parents feel good — the B-plus machine — and §2's answer is a shape
// with nowhere to put an adjective that isn't attached to evidence: the
// narrative fields are short strings, every one of them checked against
// `evidenceRefs` by the honesty lint (`honesty.ts`), and "3–6 sentence recap"
// is unrepresentable because there is no field a recap would fit in.
//
// PURE TYPES, importable by the guardian screen, the tutor queue, the service
// and the tests alike. Identity is deliberately absent from every shape — the
// learner a report belongs to comes from `ctx` at the service boundary and
// from the row at the repository (CLAUDE.md §The block).
//
// Two axes, two fields (§2.4): `MasteryMovement` carries movement (before →
// after) AND position (`gradePosition`) as separate values because conflating
// them is exactly how 80% of kids get B's while 30% are proficient. The render
// may never merge them; the type keeps them apart so a merge is a visible act.
// SOT: docs/pack/34-session-summary-reports.md §2 §3 · docs/pack/08-visual-hierarchy-spacing-spec.md
// SOT-KEYWORDS: summary types eight blocks report anatomy evidence ref problem row mastery movement trajectory teacher share

// The codebase's VoiceBand values verbatim (voice-band.ts owns the spelling —
// the doc sketch's 'K-2' is 'k-2' here).
export type SummaryBand = 'k-2' | '3-5' | '6-8' | '9-12';

export type SummarySessionKind = 'ai-tutor' | 'human-tutor' | 'hybrid';

export type SummaryStatus = 'generating' | 'draft' | 'published' | 'suppressed';

/**
 * What a claim points at. Ids only — the render resolves them under permission
 * and degrades to "source expired" when the underlying row has TTL'd out,
 * which is how a summary outlives a transcript without copying it.
 *
 *  · `message` — a `tutorMessages.messageId`.
 *  · `event`   — one turn of an `edu.transcripts` row, as `${transcriptId}#${index}`.
 *  · `problem` — a row of this report's own problems block, as `#${orderInSession}`.
 */
export interface EvidenceRef {
  readonly kind: 'message' | 'event' | 'problem';
  readonly id: string;
}

/**
 * The question as the child saw it (§2.3).
 *
 * `capture-crop` carries the POINTER to the crop — the message and attachment
 * ids, never a URL, so the image is signed at read time under permission (doc
 * 29 §5) — and the extracted problem text beside it, which is degrade tier
 * two: crop TTL'd → text; text absent → "source expired". `problem-text` is
 * generated practice, which never had a crop.
 */
export type QuestionRef =
  | {
      readonly kind: 'capture-crop';
      readonly messageId: string;
      readonly attachmentId: string;
      readonly text: string | null;
    }
  | { readonly kind: 'problem-text'; readonly text: string };

/**
 * Trajectory language, never pass/fail (§2.3, doc 08's law): grade-green ·
 * graphite · highlighter. There is no failing arm — a learner mid-struggle is
 * `still-working`, and redpen exists only as `submittedIncorrect` below.
 */
export type ProblemStatus = 'solved-independently' | 'solved-with-help' | 'still-working';

/** Block 3 — one homework problem the session touched. Deterministic, from session events. */
export interface ProblemRow {
  /** Subject header the accordion groups under ("Math", "Reading", …). */
  readonly subject: string;
  readonly skillId: string;
  readonly questionRef: QuestionRef;
  /**
   * The child's final answer, verbatim — or null when the session recorded no
   * answer text (an evaluate-only exchange). Null renders as "answer not
   * recorded", never as an invented one.
   */
  readonly childAnswer: string | null;
  readonly attempts: number;
  readonly status: ProblemStatus;
  /**
   * The one honest use of redpen (§2.3): an incorrect final answer the child
   * submitted as done, rendered as the answer's underline. Only meaningful on
   * `still-working` rows; never set on a solved one.
   */
  readonly submittedIncorrect: boolean;
  readonly orderInSession: number;
}

/**
 * The four rungs a mastery estimate renders as. Cut on the same fence posts
 * the student model already owns — `FRONTIER_LOW` (0.35) and `FRONTIER_HIGH`
 * (0.85) from `@acme/student-model`, with one mid cut — rather than a second
 * scale someone tunes toward flattery.
 */
export type MasteryLevel = 'just-starting' | 'practicing' | 'getting-it' | 'solid';

/** Where the skill sits against the learner's grade expectations, normalized (§2.4). */
export type GradePosition = 'building-toward' | 'on-track' | 'beyond';

/** Block 4 — movement (celebrated) and position (honest), never conflated. */
export interface MasteryMovement {
  readonly skillId: string;
  /** The skill in parent language. */
  readonly parentLabel: string;
  readonly before: MasteryLevel;
  readonly after: MasteryLevel;
  /** Raw estimates behind the levels, 0–1, for the MasteryBar's before→after fill. */
  readonly beforeP: number;
  readonly afterP: number;
  readonly gradePosition: GradePosition;
  /** Normalizing language, generated per band — never red, never hidden. */
  readonly positionCopy: string;
}

/** Block 2 — what we worked on, one or two skills max (the schema does not cap; the extractor does). */
export interface WorkedOnSkill {
  readonly skillId: string;
  readonly parentLabel: string;
  readonly whyItMatters: string;
}

/** Block 5 — process praise with a citation, or nothing. The type has no uncited arm. */
export interface EffortMoment {
  readonly copy: string;
  readonly evidenceRef: EvidenceRef;
}

/** Block 7 — exactly two items, by shape. Actionable beats comprehensive. */
export interface HomeSupport {
  readonly conversationStarter: string;
  readonly activity: string;
}

/** Block 8 — context, never the story. Minutes are not learning (doc 19). */
export interface SummaryFacts {
  readonly durationMin: number;
  readonly attempted: number;
  readonly solvedIndependently: number;
  readonly solvedWithHelp: number;
}

/** Generation provenance (§3) — auditable: which generator wrote what a parent read. */
export interface SummaryGenerator {
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
}

/**
 * §3's `teacherShare`, as stored: guardian-initiated, revocable, expiring.
 * `tokenHash` and never the token — the raw token exists once, in the URL the
 * guardian is handed.
 */
export interface TeacherShare {
  readonly enabled: boolean;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

/**
 * The report, blocks 1–8 in §2's fixed order. This is the DOMAIN object; the
 * Payload row (`SessionSummary` in `@acme/payload`) carries the same blocks as
 * JSON columns and `summary.repository.ts` is the one place that narrows them.
 */
export interface SessionSummaryReport {
  readonly sessionId: string;
  /**
   * Whose learning this records — present so a two-child household's feed can
   * say who, exactly as `GuardianIncidentView.learnerId` does. Read-path only:
   * the WRITE path takes identity from the generation context, never from a
   * caller's copy of this field.
   */
  readonly learnerAuthId: string;
  readonly sessionKind: SummarySessionKind;
  readonly band: SummaryBand;
  /** Block 1 — the headline accomplishment. The screen's single display moment. */
  readonly headline: string;
  /** Block 2. */
  readonly workedOn: readonly WorkedOnSkill[];
  /** Block 3 — the concrete proof the headline claims. */
  readonly problems: readonly ProblemRow[];
  /** Block 4. */
  readonly mastery: readonly MasteryMovement[];
  /** Block 5 — null when no session event evidences one. Omission is the honesty. */
  readonly effortMoment: EffortMoment | null;
  /** Block 6 — the continuity trail. */
  readonly nextUp: string;
  /** Block 7. */
  readonly homeSupport: HomeSupport;
  /** Block 8. */
  readonly facts: SummaryFacts;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly generator: SummaryGenerator;
  readonly safetyScreened: boolean;
  readonly status: SummaryStatus;
  readonly publishedAt: string | null;
  readonly guardianViewedAt: string | null;
  /** Human-tutor path: the AI drafts, the human owns (§4 step 5). */
  readonly tutorDraft: string | null;
  readonly tutorApprovedByAuthId: string | null;
  readonly suppressionReason: string | null;
  readonly suppressedAt: string | null;
  readonly teacherShare: TeacherShare | null;
  readonly digestBatchId: string | null;
  readonly createdAt: string;
}
