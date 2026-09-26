/**
 * `normalizeXrQuestion` — untrusted question payloads (the tutor feed,
 * homework capture, a fixture file) → a typed `XrLearningQuestion`.
 *
 * The point of a normalizer here rather than trust: the panel renders
 * whatever it is handed, and a malformed server payload must degrade to
 * a dropped question (`null`) or a safe default — never to a render that
 * throws inside a headset. Every field is checked, never cast: a block
 * that does not fit the union is dropped and counted, so the caller can
 * see how much of the question survived.
 *
 * `answer keys` never pass through this file — there is no `correct`
 * field to normalize, and that absence is the contract.
 *
 * SOT: question-contract.ts · question-content.ts · spec §typed contract
 * SOT-KEYWORDS: xr question normalize parse validate payload defaults untrusted server
 */

import type { MathJsonExpression } from '@cortex-js/compute-engine/math-json';
import type { QuestionContentBlock, QuestionMediaSource } from './question-content.ts';
import type {
  LearningSubject,
  QuestionChoice,
  QuestionInteraction,
  XrLearningQuestion,
} from './question-contract.ts';

export interface NormalizedQuestion {
  readonly question: XrLearningQuestion | null;
  /** Blocks dropped for not matching the union — visible, never silent. */
  readonly droppedBlocks: number;
}

const SUBJECTS: ReadonlySet<string> = new Set([
  'math', 'science', 'english-language-arts', 'reading', 'writing',
  'social-studies', 'history', 'geography', 'computer-science',
  'world-language', 'other',
]);

const INTERACTIONS: ReadonlySet<string> = new Set([
  'multiple-choice', 'multi-select', 'short-text', 'long-text', 'numeric',
  'expression', 'true-false', 'ordering', 'matching', 'diagram-label',
  'board-work', 'voice', 'tutor-conversation',
]);

const BLOCK_TYPES: ReadonlySet<string> = new Set([
  'text', 'heading', 'list', 'image', 'image-grid', 'diagram', 'equation',
  'table', 'code', 'quote', 'passage', 'timeline', 'map', 'chart', 'audio',
  'video', 'document-region', 'board',
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function media(v: unknown): QuestionMediaSource | null {
  if (!isRecord(v)) return null;
  const kind = str(v.kind);
  const uri = str(v.uri);
  if (!uri) return null;
  return {
    kind: kind === 'audio' || kind === 'video' || kind === 'document' ? kind : 'image',
    uri,
    mimeType: str(v.mimeType) ?? undefined,
    alt: str(v.alt) ?? undefined,
    caption: str(v.caption) ?? undefined,
    transcript: str(v.transcript) ?? undefined,
    width: typeof v.width === 'number' ? v.width : undefined,
    height: typeof v.height === 'number' ? v.height : undefined,
  };
}

function block(v: unknown): QuestionContentBlock | null {
  if (!isRecord(v)) return null;
  const type = str(v.type);
  if (!type || !BLOCK_TYPES.has(type)) return null;
  switch (type) {
    case 'text': {
      const text = str(v.text);
      if (text === null) return null;
      const emphasis = v.emphasis === 'strong' || v.emphasis === 'callout' ? v.emphasis : 'normal';
      return { type: 'text', text, emphasis };
    }
    case 'heading': {
      const text = str(v.text);
      return text === null ? null : { type: 'heading', text };
    }
    case 'list': {
      if (!Array.isArray(v.items)) return null;
      const items = v.items.map(str).filter((s): s is string => s !== null);
      return { type: 'list', style: v.style === 'numbered' ? 'numbered' : 'bullet', items };
    }
    case 'image': case 'map': {
      const source = media(v.source);
      if (!source) return null;
      if (type === 'image') return { type: 'image', source };
      const markers = Array.isArray(v.markers)
        ? v.markers.flatMap((m) => {
            if (!isRecord(m)) return [];
            const id = str(m.id); const label = str(m.label);
            return id && label ? [{ id, label, anchor: str(m.anchor) ?? undefined }] : [];
          })
        : undefined;
      return { type: 'map', source, markers };
    }
    case 'image-grid': {
      if (!Array.isArray(v.items)) return null;
      const items = v.items.map(media).filter((m): m is QuestionMediaSource => m !== null);
      if (items.length === 0) return null;
      return {
        type: 'image-grid',
        items,
        columns: typeof v.columns === 'number' && v.columns >= 1 ? Math.trunc(v.columns) : undefined,
      };
    }
    case 'diagram': {
      const source = media(v.source);
      if (!source) return null;
      const labels = Array.isArray(v.labels)
        ? v.labels.flatMap((l) => {
            if (!isRecord(l)) return [];
            const id = str(l.id); const text = str(l.text);
            return id && text ? [{ id, text }] : [];
          })
        : undefined;
      return { type: 'diagram', source, labels };
    }
    case 'equation':
      /* The expression is the bounded MathJSON tree — passed through
         whole; the evaluator's allowlist is the authority on what runs. */
      return v.expression === undefined ? null
        : { type: 'equation', expression: v.expression as MathJsonExpression };
    case 'table': {
      if (!Array.isArray(v.columns) || !Array.isArray(v.rows)) return null;
      const columns = v.columns.flatMap((c) => {
        if (!isRecord(c)) return [];
        const key = str(c.key);
        return key ? [{ key, header: str(c.header) ?? undefined, unit: str(c.unit) ?? undefined }] : [];
      });
      if (columns.length === 0) return null;
      const rows = v.rows.flatMap((r) => {
        if (!Array.isArray(r)) return [];
        const row = r.flatMap((cell) => {
          const text = isRecord(cell) ? str(cell.text) : str(cell);
          return text !== null ? [{ text, id: isRecord(cell) ? str(cell.id) ?? undefined : undefined }] : [];
        });
        return row.length > 0 ? [row] : [];
      });
      return { type: 'table', columns, rows };
    }
    case 'code': {
      const code = str(v.code);
      return code === null ? null : { type: 'code', language: str(v.language) ?? undefined, code };
    }
    case 'quote': {
      const text = str(v.text);
      return text === null ? null
        : { type: 'quote', text, attribution: str(v.attribution) ?? undefined };
    }
    case 'passage': {
      const text = str(v.text);
      return text === null ? null
        : { type: 'passage', text, title: str(v.title) ?? undefined };
    }
    case 'timeline': {
      if (!Array.isArray(v.events)) return null;
      const events = v.events.flatMap((e) => {
        if (!isRecord(e)) return [];
        const id = str(e.id); const label = str(e.label);
        return id && label ? [{ id, label, detail: str(e.detail) ?? undefined }] : [];
      });
      return events.length > 0 ? { type: 'timeline', events } : null;
    }
    case 'chart': {
      if (!isRecord(v.chart) || !Array.isArray(v.chart.series)) return null;
      const series = v.chart.series.flatMap((s) => {
        if (!isRecord(s) || !Array.isArray(s.values)) return [];
        const label = str(s.label);
        const values = s.values.filter((n): n is number => typeof n === 'number');
        return label ? [{ label, values }] : [];
      });
      const kind = str(v.chart.kind);
      return {
        type: 'chart',
        chart: {
          kind: kind === 'line' || kind === 'pie' || kind === 'scatter' ? kind : 'bar',
          title: str(v.chart.title) ?? undefined,
          series,
          categories: Array.isArray(v.chart.categories)
            ? v.chart.categories.filter((c): c is string => typeof c === 'string')
            : undefined,
        },
      };
    }
    case 'audio': case 'video': {
      const source = media(v.source);
      return source ? { type, source } : null;
    }
    case 'document-region': {
      const id = str(v.evidenceRegionId);
      return id ? { type: 'document-region', evidenceRegionId: id } : null;
    }
    case 'board':
      return { type: 'board', boardId: str(v.boardId) ?? undefined };
    default:
      return null;
  }
}

/**
 * Parse a payload. `null` means the question is unusable — the caller
 * shows the honest error state rather than a half-rendered panel.
 */
export function normalizeXrQuestion(raw: unknown): NormalizedQuestion {
  if (!isRecord(raw)) return { question: null, droppedBlocks: 0 };
  const id = str(raw.id);
  const prompt = str(raw.prompt);
  if (!id || !prompt) return { question: null, droppedBlocks: 0 };

  const subject = str(raw.subject);
  const interaction = str(raw.interaction);
  const textDirection = raw.textDirection === 'rtl' ? 'rtl' : raw.textDirection === 'auto' ? 'auto' : 'ltr';

  let droppedBlocks = 0;
  const content: QuestionContentBlock[] = [];
  if (Array.isArray(raw.content)) {
    for (const b of raw.content) {
      const parsed = block(b);
      if (parsed) content.push(parsed);
      else droppedBlocks += 1;
    }
  }

  const choices: QuestionChoice[] | undefined = Array.isArray(raw.choices)
    ? raw.choices.flatMap((c) => {
        if (!isRecord(c)) return [];
        const cid = str(c.id); const label = str(c.label);
        return cid && label ? [{ id: cid, label, media: media(c.media) ?? undefined }] : [];
      })
    : undefined;

  const evalKind = str(isRecord(raw.evaluation) ? raw.evaluation.kind : null);
  const evaluation =
    evalKind === 'server-objective' ? { kind: 'server-objective' } as const
    : evalKind === 'teacher-review' ? { kind: 'teacher-review' } as const
    : evalKind === 'ungraded' ? { kind: 'ungraded' } as const
    : { kind: 'coach-review' } as const;

  const evidence =
    isRecord(raw.evidence) && str(raw.evidence.questionId) && str(raw.evidence.revision)
      ? { questionId: str(raw.evidence.questionId)!, revision: str(raw.evidence.revision)! }
      : undefined;

  const source = str(raw.source);
  const question: XrLearningQuestion = {
    id,
    revision: str(raw.revision) ?? undefined,
    subject: (subject && SUBJECTS.has(subject) ? subject : 'other') as LearningSubject,
    subjectLabel: str(raw.subjectLabel) ?? (subject ?? 'LEARNING').toUpperCase(),
    skillId: str(raw.skillId) ?? undefined,
    skillLabel: str(raw.skillLabel) ?? undefined,
    uiLocale: str(raw.uiLocale) ?? 'en-US',
    questionLocale: str(raw.questionLocale) ?? str(raw.uiLocale) ?? 'en-US',
    sourceLocale: str(raw.sourceLocale) ?? undefined,
    tutorLocale: str(raw.tutorLocale) ?? undefined,
    textDirection,
    prompt,
    supportingText: str(raw.supportingText) ?? undefined,
    content,
    interaction: (interaction && INTERACTIONS.has(interaction) ? interaction : 'multiple-choice') as QuestionInteraction,
    choices,
    media: Array.isArray(raw.media)
      ? raw.media.map(media).filter((m): m is QuestionMediaSource => m !== null)
      : undefined,
    progress: isRecord(raw.progress) && typeof raw.progress.index === 'number'
      ? { index: raw.progress.index, total: typeof raw.progress.total === 'number' ? raw.progress.total : undefined }
      : undefined,
    hint: isRecord(raw.hint) && raw.hint.available === true
      ? { available: true, text: str(raw.hint.text) ?? undefined }
      : undefined,
    evidence,
    source:
      source === 'homework' || source === 'assignment' || source === 'teacher' ||
      source === 'tutor' || source === 'capture' ? source : 'practice',
    evaluation,
  };
  return { question, droppedBlocks };
}
