/**
 * StageBoard public types — the CRM kanban's generic surface.
 *
 * The board is presentational and generic on purpose (J-component-plan §4):
 * columns and cards arrive as props, the card face is a render prop, and the
 * ONE write is `onMove` on release. The ops mapping (Stage, Lead, STAGE_TONE,
 * applyStageChange, use-stage-action) stays in packages/app/features/ops —
 * this package never imports it, which is what keeps the doc-23 CRM wall a
 * lint-checkable boundary rather than a convention.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · design/screens/org/org.crm/contract.md
 * SOT-KEYWORDS: stage board kanban types column card tone onmove generic crm
 */
import type { ReactNode } from 'react';
import type { DataTableDensity } from '../DataTable';

/**
 * The codomain of the app's STAGE_TONE map, restated structurally so the app
 * can pass its tones straight through without this package importing the map.
 * Each value is a Badge tone — the column header renders its count through
 * Badge, so no second tone→token mapping ever exists.
 */
export type StageBoardTone = 'neutral' | 'primary' | 'success' | 'attention';

export interface StageBoardColumn {
  id: string;
  title: string;
  tone: StageBoardTone;
  /**
   * Server-truth count when it exceeds the cards actually loaded (a paged
   * pipeline). Omitted, the header counts the cards it can see.
   */
  count?: number;
}

/** The minimum a card must carry; the app's Lead extends it. */
export interface StageBoardCard {
  id: string;
  columnId: string;
  /** Names the card for assistive tech — "Move Amina O." and announcements. */
  label: string;
}

export interface StageBoardProps<T extends StageBoardCard = StageBoardCard> {
  columns: readonly StageBoardColumn[];
  /** Order within the array IS the order within each column. */
  cards: readonly T[];
  /** The card face. Owns the card interior (padding included); the board owns
   *  position, chrome border/surface, the drag handle and the lift styling. */
  renderCard: (card: T) => ReactNode;
  /**
   * THE single commit, fired once on release (drop, or Enter in a keyboard
   * move). `index` is the card's final position in the destination column,
   * counted after the card has left its source column — the same shape
   * `applyStageChange` consumes app-side. Never fired when the card lands
   * exactly where it started.
   */
  onMove: (cardId: string, fromColumnId: string, toColumnId: string, index: number) => void;
  /**
   * Vertical distance of one index step, in dp — ReorderRow's `rowHeight`
   * generalized. Cards are laid out on this fixed pitch (position = index ×
   * pitch), which is what lets the drop resolve as arithmetic on the release
   * offset instead of a per-frame measure of every card under the finger.
   */
  cardPitch: number;
  /**
   * Reuses the DataTable scale so the board and the table read ONE durable
   * density preference (the org.crm two-views-one-store law). Cool dial only —
   * there is deliberately no temperature axis; no hot consumer exists.
   */
  density?: DataTableDensity;
  className?: string;
}
