'use client';
/**
 * StageBoard column chrome — shared by both forks, so the board looks
 * identical whether the gesture is a long-press pan or a pointer drag.
 *
 * The tone accent IS the count Badge: StageBoardTone is a subset of Badge's
 * tones, so the header reuses the exact token mapping every stage pill in the
 * product already renders through — no second tone→color table to drift.
 *
 * Cool dial only, by contract (org.crm is an ops surface; no hot consumer
 * exists), so there is no temperature axis here — the lane simply reads the
 * cool chrome tokens it inherits.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · ./types.ts
 * SOT-KEYWORDS: stage board column header tone badge count lane drop target chrome
 */
import type { ReactNode } from 'react';
import { tv } from '../tv';
import { View, Text } from '../tw';
import { Badge } from '../Badge';
import type { DataTableDensity } from '../DataTable';
import type { StageBoardTone } from './types';

const column = tv({
  slots: {
    root: 'flex-1 rounded-card border-2 border-border bg-surface-sunken',
    header: 'flex-row items-center justify-between gap-element',
    title: 'text-label font-semibold text-text',
    body: 'flex-1',
  },
  variants: {
    density: {
      cool: { root: 'p-inset-tight', header: 'pb-element' },
      roomy: { root: 'p-inset', header: 'pb-stack' },
    },
    /*
      The drop-target state borrows the DataTable selected-row treatment
      (highlighter underlay + strong border) rather than inventing a new
      highlight: board and table are two views over one store, and "this is
      where it lands" should read the same in both.
    */
    active: {
      true: { root: 'border-border-strong bg-highlighter-underlay' },
      false: {},
    },
  },
  defaultVariants: { density: 'cool', active: false },
});

export interface StageColumnFrameProps {
  title: string;
  tone: StageBoardTone;
  count: number;
  density?: DataTableDensity;
  /** Pending drop target during a drag or keyboard move. */
  active?: boolean;
  children?: ReactNode;
  className?: string;
}

export function StageColumnFrame({
  title,
  tone,
  count,
  density = 'cool',
  active = false,
  children,
  className,
}: StageColumnFrameProps) {
  const { root, header, title: titleCls, body } = column({ density, active });
  return (
    <View className={root({ className })}>
      <View className={header()}>
        <Text className={titleCls()}>{title}</Text>
        <Badge label={String(count)} tone={tone} />
      </View>
      <View className={body()}>{children}</View>
    </View>
  );
}

/**
 * The polite live region both forks speak through. Collapsed, not
 * display:none — a hidden live region never announces (the ReplaceTarget
 * lesson, doc 30 §6).
 */
export function StageBoardLiveRegion({ message }: { message: string }) {
  return (
    <View
      aria-live="polite"
      accessibilityLiveRegion="polite"
      className="h-px w-px overflow-hidden opacity-0"
    >
      <Text className="text-caption">{message}</Text>
    </View>
  );
}

/**
 * Card chrome shared by the forks: the shell row (handle + face) and the
 * handle's hit area. `mb-element` inside the fixed pitch is what renders the
 * gap between cards — the wrapper owns exactly `cardPitch` of height.
 */
export const CARD_SHELL_CLASS =
  'mb-element flex-1 flex-row items-stretch overflow-hidden rounded-md border-2 border-border bg-surface-raised';

export const CARD_HANDLE_CLASS = 'w-8 items-center justify-center';
