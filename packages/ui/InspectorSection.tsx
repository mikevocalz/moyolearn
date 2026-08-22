'use client';
// A collapsing section of the inspector pane (doc 08 §4.5).
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.5
// SOT-KEYWORDS: inspectorsection inspector pane collapsible section disclosure L2
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from './primitives';

export interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  /** Uncontrolled by default; pass both to drive it from a store. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Header row, then content — and NO divider lines between sections.
 *
 * Doc 08 §4.5 is explicit that the collapse affordance plus space do that work:
 * a rule between every section competes with the ink borders that already say
 * "this is a thing", and the inspector ends up looking like a settings table.
 * Sections are separated by `gap-group` from the outside instead.
 *
 * The WHOLE header row is the target, not just the chevron — 44dp of row is a
 * far easier hit than a 16dp glyph, and it is the affordance people expect from
 * a disclosure list.
 */
export function InspectorSection({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen = true,
  className,
}: InspectorSectionProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <View className={`gap-stack ${className ?? ''}`}>
      <Pressable
        onPress={toggle}
        className="min-h-target-adult flex-row items-center justify-between gap-element"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={title}
        role="button"
      >
        <Text className="text-title text-text">{title}</Text>
        {/* Rotation, not two glyphs: one character that turns reads as the same
            control moving, which is what the disclosure actually is. */}
        <Text
          className="text-label text-text-muted"
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        >
          ›
        </Text>
      </Pressable>

      {isOpen ? <View className="gap-stack p-inset pt-0">{children}</View> : null}
    </View>
  );
}
