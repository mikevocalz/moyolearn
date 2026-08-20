'use client';
import { tv } from 'tailwind-variants';
import { css } from './html/css';
import {
  DragDropContentView,
  type DragDropContentViewProps,
  type DropAsset,
  type Assets,
} from 'expo-drag-drop-content-view';
import { View } from './tw';
import { CloudUpload } from './icons';
import { Text } from './Text';

export type { DropAsset, Assets };

// Premium drag-and-drop surface (expo-drag-drop-content-view — iOS, Android,
// and web). Ships a designed default (icon well + copy); pass children to
// take over the content entirely. Drive `active` from onEnter/onExit.
const dropZone = tv({
  slots: {
    root:
      'items-center justify-center gap-3 rounded-sheet border-2 border-dashed border-border-strong ' +
      'bg-surface-sunken p-10 transition-all duration-base ' +
      'hover:border-focus/60 hover:bg-surface-raised motion-reduce:transition-none',
    well:
      'h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-raised shadow-card ' +
      'transition-all duration-base motion-reduce:transition-none',
    title: 'text-center font-semibold',
    description: 'max-w-content-form text-center',
  },
  variants: {
    active: {
      true: {
        root: 'border-focus bg-surface-raised shadow-card ring-4 ring-focus/10',
        well: '-translate-y-0.5 scale-105 bg-ember-50 shadow-raised',
      },
    },
  },
});

export interface DropZoneProps extends DragDropContentViewProps {
  className?: string;
  /** Highlight state while a drag hovers the zone — drive it from onEnter/onExit. */
  active?: boolean;
  /** Default-content heading (ignored when children are passed). */
  title?: string;
  /** Default-content supporting line (ignored when children are passed). */
  description?: string;
  /** Default-content glyph inside the icon well (ignored when children are passed). */
  glyph?: React.ReactNode;
}

const CssDragDrop = css(
  DragDropContentView as React.ComponentType<object>,
  'DragDropContentView',
) as React.FC<DragDropContentViewProps & { className?: string }>;

export function DropZone({
  className,
  active,
  title = 'Drag and drop a file here',
  description = 'Or browse from your device. Images, documents and audio.',
  glyph,
  children,
  ...props
}: DropZoneProps) {
  const s = dropZone({ active });
  return (
    <CssDragDrop className={s.root({ className })} {...props}>
      {children ?? (
        <>
          {/* A drawn icon rather than the ⇪ character: at 24dp the glyph
              renders at the font's own hairline weight and reads as
              punctuation, not as the affordance of a drop target. */}
          <View className={s.well()}>
            {glyph ?? <CloudUpload size={28} className="text-text-muted" />}
          </View>
          <Text className={s.title()}>{title}</Text>
          <Text variant="caption" tone="muted" className={s.description()}>
            {description}
          </Text>
        </>
      )}
    </CssDragDrop>
  );
}
