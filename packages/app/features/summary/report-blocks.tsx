'use client';
// ReportBody — doc 34 §2's eight blocks as ONE component, and the singleness is
// the enforcement: the guardian view and the teacher share view both render
// through here, so the fixed order (headline → worked on → problems → how it
// went → effort → next → home/classroom → facts) cannot fork per surface, and
// a phone can never show less than a laptop.
//
// Doc 08 law, applied literally: the headline is the screen's ONE display
// moment; problem status is trajectory language — grade-green (`success`) ·
// graphite (`neutral`) · highlighter (`attention`), never red mid-struggle;
// redpen appears exactly once, as the underline on an incorrect answer the
// child submitted as done. Movement and position render as two separate lines
// under one skill — never one sentence (§2.4's axes rule, structurally).
//
// Mobbin: https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c (SchoolAI —
//   session report: headline verdict, then per-outcome progress bars, insights below) ·
//   https://mobbin.com/screens/77482a04-a3e4-4978-9ab6-1cbeeb89f667 (Tana — a generated
//   report as fixed numbered sections in one reading column) ·
//   https://mobbin.com/screens/6512caea-44a6-4120-af89-29a83eff45c0 (Toggl Track — the
//   quiet facts strip of small figures, clearly subordinate to the content) ·
//   https://mobbin.com/screens/3658eb91-9a82-4bbe-9583-2c9dccca81dc (Semrush — report
//   headline block sits above collapsible detail sections). Structure only.
// SOT: docs/pack/34-session-summary-reports.md §2 §5 · docs/pack/08-visual-hierarchy-spacing-spec.md
// SOT-KEYWORDS: report body eight blocks fixed order accordion problems mastery movement position axes facts strip redpen underline
import { Badge, Heading, Image, InspectorSection, MasteryBar, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type {
  GuardianSummaryView,
  ResolvedProblemRow,
  SubjectGroup,
} from './summary.service.ts';
import type { MasteryLevel, ProblemStatus } from './summary.types.ts';

/** The four rungs in parent words — shared by the feed card, report and queue. */
export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  'just-starting': 'Just starting',
  practicing: 'Practicing',
  'getting-it': 'Getting it',
  solid: 'Solid',
};

/** §2.3's trajectory copy — status is a phase of work, never a verdict. */
const STATUS_COPY: Record<ProblemStatus, string> = {
  'solved-independently': 'solved on their own',
  'solved-with-help': 'solved with help',
  'still-working': 'still working on it',
};

/** grade-green · graphite · highlighter. There is no red arm to reach for. */
const STATUS_TONE: Record<ProblemStatus, 'success' | 'neutral' | 'attention'> = {
  'solved-independently': 'success',
  'solved-with-help': 'neutral',
  'still-working': 'attention',
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  // Sections step down to `title`; the headline keeps the display moment.
  return (
    <Heading level={2} size="title" className="text-text">
      {children}
    </Heading>
  );
}

function ProblemRowView({ row, cropSrc }: { row: ResolvedProblemRow; cropSrc: (url: string) => string }) {
  return (
    <View className="min-h-row-hot flex-row items-center gap-group py-inset-tight">
      {row.question.kind === 'crop' ? (
        <Image
          src={cropSrc(row.question.url)}
          alt="The problem as it was captured"
          width={96}
          height={64}
          unoptimized
          className="rounded-input"
        />
      ) : null}
      <View className="flex-1 gap-element">
        {row.question.kind === 'crop' && row.question.text !== null ? (
          <Text variant="body" className="text-text">{row.question.text}</Text>
        ) : null}
        {row.question.kind === 'text' ? (
          <Text variant="body" className="text-text">{row.question.text}</Text>
        ) : null}
        {row.question.kind === 'expired' ? (
          // Tier three of the degrade ladder: the truth, quietly, never a broken image.
          <Text variant="caption" tone="muted">Source expired</Text>
        ) : null}
        {row.childAnswer !== null ? (
          <Text
            variant="body"
            className={
              row.submittedIncorrect
                ? // The one honest redpen: an incorrect answer submitted as done,
                  // marked on the ANSWER — never on the child, never on progress.
                  'text-text underline decoration-redpen decoration-2'
                : 'text-text'
            }
          >
            Answered: {row.childAnswer}
          </Text>
        ) : (
          <Text variant="caption" tone="muted">Answer not recorded</Text>
        )}
      </View>
      <View className="items-end gap-element">
        <Badge label={STATUS_COPY[row.status]} tone={STATUS_TONE[row.status]} />
        {row.attempts > 1 ? (
          <Text variant="data" className="font-mono text-text-muted">
            {row.attempts} tries
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export interface ReportBodyProps {
  readonly headline: string;
  readonly workedOn: GuardianSummaryView['workedOn'];
  readonly problems: readonly SubjectGroup[];
  readonly mastery: GuardianSummaryView['mastery'];
  readonly effortMoment: GuardianSummaryView['effortMoment'];
  readonly nextUp: string;
  /**
   * Block 7 varies by audience (§5): the guardian gets the two home items, the
   * teacher gets one classroom-context line. A discriminated prop rather than
   * two optional ones, so a surface cannot render both or neither.
   */
  readonly aid:
    | { readonly kind: 'home'; readonly support: GuardianSummaryView['homeSupport'] }
    | { readonly kind: 'classroom'; readonly line: string };
  readonly facts: GuardianSummaryView['facts'];
  readonly publishedAt: string | null;
  /** How a crop's canonical URL becomes a fetchable src on this surface. */
  readonly cropSrc: (url: string) => string;
}

export function ReportBody({
  headline,
  workedOn,
  problems,
  mastery,
  effortMoment,
  nextUp,
  aid,
  facts,
  publishedAt,
  cropSrc,
}: ReportBodyProps) {
  return (
    <View className="gap-section">
      {/* Block 1 — the single display moment. */}
      <Heading level={1} size="display-sm" className="text-text">
        {headline}
      </Heading>

      {/* Block 2 */}
      <View className="gap-group">
        <SectionHeading>What we worked on</SectionHeading>
        {workedOn.map((skill) => (
          <View key={skill.skillId} className="gap-element">
            <Text variant="body" className="font-semibold text-text">{skill.parentLabel}</Text>
            <Text variant="body" tone="muted">{skill.whyItMatters}</Text>
          </View>
        ))}
      </View>

      {/* Block 3 — subject accordion, every section OPEN on load (§2.3): a
          parent reads the report, they don't excavate it. */}
      <View className="gap-group">
        <SectionHeading>The problems</SectionHeading>
        {problems.length === 0 ? (
          <Text variant="body" tone="muted">No graded problems this session.</Text>
        ) : (
          problems.map((group) => (
            <InspectorSection key={group.subject} title={group.subject} defaultOpen>
              <View className="gap-element">
                {group.rows.map((row) => (
                  <ProblemRowView key={row.orderInSession} row={row} cropSrc={cropSrc} />
                ))}
              </View>
            </InspectorSection>
          ))
        )}
      </View>

      {/* Block 4 — two axes, two lines, never one sentence. */}
      <View className="gap-group">
        <SectionHeading>How it went</SectionHeading>
        {mastery.length === 0 ? (
          <Text variant="body" tone="muted">No mastery movement was measured this session.</Text>
        ) : (
          mastery.map((row) => (
            <View key={row.skillId} className="gap-element">
              <MasteryBar
                label={row.parentLabel}
                value={row.afterP * 100}
                state={row.afterP < 0.5 ? 'needs-attention' : 'steady'}
              />
              <Text variant="data" className="font-mono text-text">
                {LEVEL_LABEL[row.before]} → {LEVEL_LABEL[row.after]}
              </Text>
              <Text variant="body" tone="muted">{row.positionCopy}</Text>
            </View>
          ))
        )}
      </View>

      {/* Block 5 — present only when a real event backs it. */}
      {effortMoment !== null ? (
        <View className="gap-group">
          <SectionHeading>A moment of effort</SectionHeading>
          <Text variant="body" className="text-text">{effortMoment.copy}</Text>
        </View>
      ) : null}

      {/* Block 6 */}
      <View className="gap-group">
        <SectionHeading>What&rsquo;s next</SectionHeading>
        <Text variant="body" className="text-text">{nextUp}</Text>
      </View>

      {/* Block 7 — audience-specific by construction. */}
      {aid.kind === 'home' ? (
        <View className="gap-group">
          <SectionHeading>How to help at home</SectionHeading>
          <View className="gap-element">
            <Text variant="label" className="text-text-muted">Ask them</Text>
            <Text variant="body" className="text-text">{aid.support.conversationStarter}</Text>
          </View>
          <View className="gap-element">
            <Text variant="label" className="text-text-muted">Five minutes together</Text>
            <Text variant="body" className="text-text">{aid.support.activity}</Text>
          </View>
        </View>
      ) : (
        <View className="gap-group">
          <SectionHeading>For the classroom</SectionHeading>
          <Text variant="body" className="text-text">{aid.line}</Text>
        </View>
      )}

      {/* Block 8 — context, never the story: caption-weight mono, bottom. */}
      <Text variant="data" className="font-mono text-text-muted">
        {publishedAt !== null ? new Date(publishedAt).toLocaleDateString() : '—'} ·{' '}
        {facts.durationMin} min · {facts.attempted} attempted · {facts.solvedIndependently} on
        their own · {facts.solvedWithHelp} with help
      </Text>
    </View>
  );
}
