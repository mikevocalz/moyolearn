'use client';
// The pipeline's second face — org.crm's board VIEW, never a screen. Composed
// by leads-content, which keeps the one toolbar (search, chips, attention,
// Display, the view switcher): this file receives the SAME filtered/sorted
// rows the table renders and the SAME optimistic write action, so switching
// views can never lose a filter or show a different pipeline. Columns are the
// Stage enum in pipeline order; drag commits through `boardStageChange` into
// `use-stage-action`, and every card carries the table's stage Menu — the
// accessible door for keyboard and screen-reader users, and the only door on
// platforms where drag is not wired. 'At risk' renders as a lane (the scorer's
// verdicts must be readable in the pipeline) but accepts no drops.
// SOT: design/screens/org/org.crm/contract.md · docs/pack/28-crm-spec.md §3 · packages/ui/stage-board
// SOT-KEYWORDS: leads board kanban view stage columns drag drop crm pipeline optimistic
// Mobbin: https://mobbin.com/screens/582464c2-f4b2-4ad1-b267-804451ee22d4 (Lightfield —
//   Table/Board is one toggle in the toolbar; both faces share the filters above) ·
//   https://mobbin.com/screens/924adecd-ba3c-4bbf-82e9-36a972e5eeaf (HubSpot —
//   stage columns carry name + count in the header; cards are identity plus a
//   couple of labelled figures, nothing tabular) ·
//   https://mobbin.com/screens/abd9a6f7-36ae-440f-8843-aa5e76d66938 (Pipedrive —
//   an empty stage still renders as a full-height lane a card can land in) ·
//   https://mobbin.com/screens/d54a84ea-fb80-4561-8c7a-04fff6c94370 (Outseta —
//   "Board view / List view" switch sits with the filters, not on the board).
//   Structure only.
import type { ReactNode } from 'react';
import {
  LoadingSkeleton,
  Menu,
  StageBoard,
  type StageBoardCard,
  type StageBoardColumn,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/primitives';
import { STAGES, STAGE_TONE, type Lead } from './ops.data';
import { MANUAL_STAGES, boardStageChange, type StageChange } from './stage-change';
import type { OpsDensity } from './ops.prefs';

/**
 * One index step in dp: two text lines + the move control inside p-inset-tight,
 * plus the mb-element gap CARD_SHELL renders — the StageBoard stories' 84 with
 * room for the 44dp menu target the card face carries.
 */
const CARD_PITCH = 96;

/**
 * Lane chrome above the pitch stack: StageColumnFrame's cool inset (p-inset-
 * tight top and bottom) plus its header row and pb-element — what the frame
 * spends before the first card starts.
 */
const COLUMN_CHROME = 72;

/**
 * The stories' 480 harness, as the board's floor. StageBoard's root is
 * `flex-1` (StageBoard.web.tsx:349), which in this screen's auto-height
 * column resolved to ZERO — the board rendered collapsed. Every harness in
 * StageBoard.stories.tsx wraps it in a definite height for exactly this
 * reason, so the screen does what the stories do.
 */
const BOARD_MIN_HEIGHT = 480;

/**
 * DECISION — 'At risk' is a COLUMN, not a flag treatment: doc 28 §6's scorer
 * writes that stage, and a pipeline view that hides the scorer's verdicts
 * would answer "which leads are stalling?" with a lie. But it is a read-only
 * lane: `boardStageChange` refuses any drop into a stage outside
 * MANUAL_STAGES, so a dragged card visibly snaps home, and the per-card menu
 * (like the table's) never offers it. Cards move OUT of it freely.
 */
const COLUMNS: readonly StageBoardColumn[] = STAGES.map((stage) => ({
  id: stage,
  title: stage,
  tone: STAGE_TONE[stage],
}));

interface LeadBoardCard extends StageBoardCard {
  lead: Lead;
}

export interface LeadsBoardProps {
  /** The optimistic rows from use-stage-action — the table's exact data. */
  rows: readonly Lead[];
  status: 'pending' | 'error' | 'success';
  density: OpsDensity;
  /** A write is in flight; the per-card menus disable exactly as the table's. */
  pending: boolean;
  moveStage: (change: StageChange) => void;
  openLead: (id: string) => void;
  /** The table's empty/error nodes, reused so the six states read identically. */
  empty: ReactNode;
  error: ReactNode;
  /** The shared cursor pager — the board pages exactly as the table does. */
  footer: ReactNode;
}

export function LeadsBoard({
  rows,
  status,
  density,
  pending,
  moveStage,
  openLead,
  empty,
  error,
  footer,
}: LeadsBoardProps) {
  const cards: LeadBoardCard[] = rows.map((lead) => ({
    id: lead.id,
    columnId: lead.stage,
    label: lead.family,
    lead,
  }));

  /*
    The card face: LeadCard's header row (identity, learner · subject) plus one
    labelled figure line, with the table's stage Menu as the move control — the
    same MANUAL_STAGES list, the same disabled semantics. No new card component
    (J §8): this is a composition of the existing idiom inside StageBoard's
    render prop, and the board owns the chrome around it.
  */
  const renderCard = (card: LeadBoardCard) => (
    <View className="flex-1 flex-row items-center justify-between gap-element p-inset-tight">
      <Pressable
        onPress={() => openLead(card.lead.id)}
        aria-label={`Open lead: ${card.lead.family}`}
        className="min-w-0 flex-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
      >
        <Text className="text-label font-semibold text-text underline decoration-border-strong underline-offset-2">
          {card.lead.family}
        </Text>
        <Text className="text-caption text-text-muted">
          {card.lead.learner} · {card.lead.subject}
        </Text>
        <Text className="font-mono text-caption text-text-muted">
          {card.lead.value} · next {card.lead.nextSession}
        </Text>
      </Pressable>
      <Menu
        title="Move to"
        actions={MANUAL_STAGES.map((stage) => ({
          id: stage,
          title: stage,
          disabled: pending || stage === card.lead.stage,
        }))}
        onAction={(id) => {
          const change = boardStageChange(card.lead.id, card.lead.stage, id);
          if (change) moveStage(change);
        }}
      >
        {/* A plain View anchor, never the kit Button — Menu's web fork is a
            details/summary and a real <button> inside <summary> eats the click
            (the Display menu's lesson). */}
        <View className="min-h-target-adult flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised px-element">
          <Text className="text-caption font-semibold text-text">Move</Text>
          <Text aria-hidden className="text-caption text-text-muted">
            ▾
          </Text>
        </View>
      </Menu>
    </View>
  );

  if (status === 'pending' && rows.length === 0) {
    /*
      Skeleton lanes, not a spinner: the board's shape IS its promise, so the
      load shows stage-width columns filling with card-height blocks. Three
      lanes stand for the pipeline; the real column set arrives with the rows.
    */
    return (
      <View className="flex-row items-stretch gap-group overflow-hidden p-inset-tight">
        {[0, 1, 2].map((lane) => (
          <View
            key={lane}
            className="w-72 flex-none gap-stack rounded-card border-2 border-border bg-surface-sunken p-inset-tight"
          >
            <LoadingSkeleton variant="line" />
            <LoadingSkeleton variant="card" count={lane === 1 ? 1 : 2} />
          </View>
        ))}
      </View>
    );
  }

  if (status === 'error') {
    return <View className="items-center justify-center gap-stack p-section">{error}</View>;
  }

  if (rows.length === 0) {
    // Same discriminated empties as the table — leads-content passes the node
    // (ExampleLeads for a genuinely empty org, the filter way-out otherwise).
    return <View className="items-center justify-center gap-stack p-section">{empty}</View>;
  }

  /*
    The tallest lane decides the board's height (fixed-pitch stacks don't
    scroll vertically inside a lane), floored at the stories' harness so an
    almost-empty pipeline still reads as a board of lanes, not a strip.
  */
  const tallestLane = COLUMNS.reduce(
    (max, column) => Math.max(max, cards.filter((card) => card.columnId === column.id).length),
    1,
  );
  const boardHeight = Math.max(BOARD_MIN_HEIGHT, COLUMN_CHROME + tallestLane * CARD_PITCH);

  return (
    <View className="gap-stack">
      {/*
        DECISION — the board is a view over the CURRENT PAGE, same cursor and
        same limit as the table, with the shared pager below. Column counts are
        therefore the loaded page's counts (StageBoard counts what it can see)
        and the footer's "N of M shown" states the truth of that. Fetching the
        whole pipeline to fill the lanes would be an unbounded read the table
        never performs — a bigger board page is a future limit change, made
        honestly, not a silent fetch-all here.
      */}
      {/* A DEFINITE height for StageBoard's flex-1 root to fill — inline style
          like the stories and ScheduleGrid, because the value is computed. */}
      <View style={{ height: boardHeight }}>
        <StageBoard
          columns={COLUMNS}
          cards={cards}
          renderCard={renderCard}
          cardPitch={CARD_PITCH}
          density={density}
          onMove={(cardId, fromColumnId, toColumnId) => {
            const change = boardStageChange(cardId, fromColumnId, toColumnId);
            // Null covers both refusals: a same-column re-order (no manual
            // ordering exists to write) and a drop into the scorer-owned
            // 'At risk' — the card snaps home, and the write path never fires.
            if (change) moveStage(change);
          }}
        />
      </View>
      <View className="flex-row items-center justify-between gap-group rounded-card border-2 border-border bg-surface-sunken p-inset-tight">
        {footer}
      </View>
    </View>
  );
}
