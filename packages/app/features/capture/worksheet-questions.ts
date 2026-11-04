// A candidate is a transcription, not a fact about the photographed page.
// Parsing never grants evaluation readiness; every candidate is explicitly reviewed.
// SOT: docs/design/homework-intelligence.md
export interface WorksheetQuestion {
  id: string;
  sourcePage: number;
  sourceNumber: number | null;
  text: string;
}

export interface WorksheetExtraction {
  questions: WorksheetQuestion[];
  instructions: string;
  warning: string | null;
}

export const MAX_WORKSHEET_QUESTIONS = 50;
const PAGE_HEADER = /^\s*Page\s+(\d+)\s*:\s*$/i;
const FILE_HEADER = /^\s*File\s+(\d+)\s*:\s*(?:.*)?$/i;
const QUESTION_START = /^\s*(?:(?:question|problem|q)\s*)?(\d{1,3})\s*[).:]\s*(.*)$/i;

/**
 * Segment human-confirmed OCR into numbered candidates while preserving
 * continuations (fractions, multi-line word problems, working). Number-free
 * text is ONE candidate: guessing that ten lines mean ten questions is unsafe.
 * On column OCR, two or more spaces before another marker are a possible
 * boundary, but the learner still verifies order against the original image.
 */
export function extractWorksheetQuestions(raw: string): WorksheetExtraction {
  const normalized = raw.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return { questions: [], instructions: '', warning: 'No readable work was found.' };

  const candidates: WorksheetQuestion[] = [];
  const preamble: string[] = [];
  let page = 1;
  let number: number | null = null;
  let questionPage = page;
  let lines: string[] = [];
  let sawNumbered = false;
  let sawColumnBreak = false;

  const flush = () => {
    const text = lines.join('\n').trim();
    if (text) {
      candidates.push({
        id: 'question-' + (candidates.length + 1),
        sourcePage: questionPage,
        sourceNumber: number,
        text,
      });
    }
    lines = [];
    number = null;
  };

  for (const rawLine of normalized.split('\n')) {
    const asPage = PAGE_HEADER.exec(rawLine) ?? FILE_HEADER.exec(rawLine);
    if (asPage) {
      if (lines.length) flush();
      page = Number(asPage[1]);
      continue;
    }
    if (!rawLine.trim()) continue;

    // A two-column scan can put "1. ...    2. ..." on one OCR line.
    // Split only when the next marker follows TWO or more whitespace chars.
    const pieces = rawLine.split(/\s{2,}(?=(?:question\s*|problem\s*|q\s*)?\d{1,3}\s*[).:]\s*)/i);
    if (pieces.length > 1) sawColumnBreak = true;
    for (const piece of pieces) {
      const match = QUESTION_START.exec(piece);
      if (match) {
        if (!sawNumbered && lines.length) {
          preamble.push(...lines);
          lines = [];
        } else if (lines.length) {
          flush();
        }
        sawNumbered = true;
        number = Number(match[1]);
        questionPage = page;
        lines.push(match[2]?.trim() || '');
      } else if (lines.length) {
        lines.push(piece.trim());
      } else if (!sawNumbered) {
        preamble.push(piece.trim());
      } else {
        // Source text between numbered markers remains attached to its question.
        lines.push(piece.trim());
      }
    }
  }
  flush();

  if (!sawNumbered && preamble.length) {
    candidates.push({ id: 'question-1', sourcePage: 1, sourceNumber: null, text: preamble.join('\n') });
    preamble.length = 0;
  }

  const questions = candidates.filter((q) => q.text.length > 0);
  const numbers = questions.map((q) => q.sourceNumber).filter((n): n is number => n !== null);
  const ambiguous = !sawNumbered || numbers.some((n, i) => i > 0 && n !== numbers[i - 1]! + 1);
  const overLimit = questions.length > MAX_WORKSHEET_QUESTIONS;
  return {
    questions: overLimit ? [] : questions,
    instructions: preamble.join('\n'),
    warning: overLimit
      ? 'This worksheet has more than 50 detected questions. Divide it into smaller uploads.'
      : !sawNumbered
        ? 'We could not reliably find question boundaries. Split or edit the work before starting.'
        : ambiguous || sawColumnBreak
          ? 'Check the question order and signs against your original worksheet.'
          : null,
  };
}

/** Never send a source header, the other nine problems, or a model answer to Natalie. */
export function questionForTutor(
  question: WorksheetQuestion,
  context: { subject: string; instructions: string },
): string {
  return [
    context.subject ? 'Subject: ' + context.subject : '',
    context.instructions ? 'Worksheet directions: ' + context.instructions : '',
    'Question ' + (question.sourceNumber ?? question.id.replace('question-', '')) + ':',
    question.text,
  ].filter(Boolean).join('\n');
}
