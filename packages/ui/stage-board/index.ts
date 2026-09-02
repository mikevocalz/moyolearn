/**
 * stage-board — the CRM kanban (J-component-plan §4), the repo's first board.
 *
 * Generic and presentational: columns/cards from props, card face as a render
 * prop, one `onMove` commit on release. The ops model (Stage, Lead,
 * STAGE_TONE, applyStageChange, use-stage-action) stays app-side; this
 * sub-barrel owns the public surface, like adaptive-panes.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · design/screens/org/org.crm/contract.md
 * SOT-KEYWORDS: stage board kanban barrel crm pipeline drag column card
 */
export { StageBoard } from './StageBoard';
export type {
  StageBoardProps,
  StageBoardColumn,
  StageBoardCard,
  StageBoardTone,
} from './types';

// Column chrome, exported for direct use by feature screens and Storybook —
// the static drop-target/drag states render through it.
export { StageColumnFrame, type StageColumnFrameProps } from './StageColumn';

// Drop maths, public so the app-side reducer tests can share the exact
// index semantics the board commits with.
export {
  resolveDrop,
  stepTarget,
  maxIndexFor,
  type DropTarget,
  type ResolveDropArgs,
  type StepDirection,
} from './geometry';
