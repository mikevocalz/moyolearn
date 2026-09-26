/**
 * Shared panel-local geometry for the `LearningQuestion` artboard — one
 * content rect driving the Viro quad, the hosted content texture and the
 * Rive window, because a second copy of any of those numbers is a seam a
 * child's tap falls through. Same convention as `board-chrome-layout.ts`:
 * artboard units are what `probes/rive-panel/rive-question/scene.rml`
 * authors in; panel-local metres are what the carrier composes.
 *
 * SOT: this file is the contract for the `LearningQuestion` artboard
 *      authors AND for `XrQuestionPanel`; the numbers exist here once.
 * SOT-KEYWORDS: xr rive question chrome layout content rect artboard meters shared geometry
 */

/** The `LearningQuestion` artboard — 1280×800, 16:10. */
export const QUESTION_ARTBOARD = { width: 1280, height: 800 } as const;

/** Header: subject chip, skill, progress + locale readouts. */
export const QUESTION_HEADER_BAND = { x: 0, y: 0, w: 1280, h: 64 } as const;

/**
 * The content window — the transparent hole the hosted surface draws
 * through. Choices live in the Rive rail to its right; the hole is the
 * only region where native content shows.
 */
export const QUESTION_CONTENT_BAND = { x: 40, y: 80, w: 760, h: 660 } as const;

/** The bounded choice rail — six rows, x 820..1240, pitch 92 from y 80. */
export const QUESTION_CHOICE_RAIL = { x: 820, y: 80, w: 420, rowHeight: 84, rowGap: 8 } as const;

/** Footer: hint/submit/skip/next/listen/board/retry buttons. */
export const QUESTION_FOOTER_BAND = { x: 0, y: 746, w: 1280, h: 54 } as const;

export const QUESTION_PANEL_WIDTH_M = 1.44;
export const QUESTION_PANEL_HEIGHT_M =
  (QUESTION_ARTBOARD.height / QUESTION_ARTBOARD.width) * QUESTION_PANEL_WIDTH_M;
export const QUESTION_SCALE = QUESTION_PANEL_WIDTH_M / QUESTION_ARTBOARD.width;

export type QuestionArtboardRect = { x: number; y: number; w: number; h: number };
export type QuestionPanelRect = { x: number; y: number; width: number; height: number };

/** Artboard rect → panel-local metres. Rive y grows DOWN; the carrier y
    grows UP with the panel centre at the origin — the flip lives here. */
export const questionArtboardToPanel = (r: QuestionArtboardRect): QuestionPanelRect => ({
  x: r.x * QUESTION_SCALE - QUESTION_PANEL_WIDTH_M / 2,
  y: QUESTION_PANEL_HEIGHT_M / 2 - (r.y + r.h) * QUESTION_SCALE,
  width: r.w * QUESTION_SCALE,
  height: r.h * QUESTION_SCALE,
});

export const questionArtboardCenter = (r: QuestionArtboardRect): [number, number, number] => {
  const p = questionArtboardToPanel(r);
  return [p.x + p.width / 2, p.y + p.height / 2, 0];
};

/** The hosted content surface's quad lives here, in carrier-local metres. */
export const QUESTION_CONTENT_RECT_PANEL = questionArtboardToPanel(QUESTION_CONTENT_BAND);

/** The texture page's pixel budget — 2× the artboard window, same rule as
    the panel resolution: micro-labels must survive headset optics. */
export const questionSurfacePixels = {
  width: QUESTION_CONTENT_BAND.w * 2,
  height: QUESTION_CONTENT_BAND.h * 2,
} as const;
