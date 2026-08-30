/**
 * FAQ accordion.
 *
 * Each question is a tappable row. The answer opens in place, so the list
 * stays scannable and a reader is not hit by every answer at once. Built
 * from the Mobbin pass: Airtasker (single dark bar), Slack (plus/minus), and
 * Etsy (expandable list) all keep the question prominent and the answer
 * secondary.
 *
 * SOT: .claude/skills/mobbin-pass/SKILL.md
 * SOT-KEYWORDS: faq accordion disclosure question answer chevron web-vite
 */
'use client';
import { useState } from 'react';
import { Paragraph, Pressable, View } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { ChevronDown } from '@acme/ui/icons';

interface FaqAccordionProps {
  readonly items: readonly { readonly q: string; readonly a: string }[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View className="gap-group">
      {items.map((item) => {
        const isOpen = open === item.q;
        return (
          <View
            key={item.q}
            className="border-moyo-hair rounded-moyo-card border-moyo-outline bg-moyo-paper-raised"
          >
            <Pressable
              onPress={() => setOpen(isOpen ? null : item.q)}
              className="flex-row items-center justify-between gap-element p-inset"
              aria-expanded={isOpen}
            >
              <Text className="font-moyo-text text-site-body text-moyo-ink">
                {item.q}
              </Text>
              <ChevronDown
                size={20}
                className={`text-moyo-secondary transition-transform duration-150 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
              />
            </Pressable>
            {isOpen ? (
              <View className="border-t-moyo-hair border-t-moyo-outline p-inset">
                <Paragraph className="text-site-body text-moyo-ink-muted">
                  {item.a}
                </Paragraph>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
