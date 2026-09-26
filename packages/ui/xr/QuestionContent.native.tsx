'use client';
/**
 * `XrQuestionContent` — the hosted surface that renders a question's
 * content blocks inside the LearningQuestion chrome's transparent window.
 *
 * It is a PLAIN React Native view, not a Viro node: `BoardTextureHost`
 * re-parents it into the texture sink exactly the way it re-parents the
 * Quickdraw page, so the same capture path that carries the board carries
 * this. Rive never sees a block; this view never touches the renderer.
 *
 * What it does NOT do is decide layout — `resolveQuestionLayout` already
 * did that, and this file renders the verdict. Media resolution is
 * injected (`resolveMedia`): an unresolvable source renders its skeleton
 * and alt text, which is the honest loading/error state the spec asks
 * for — never a stretched image, never a blank rect.
 *
 * Math stays STRUCTURED: `MathView` renders the bounded MathJSON allowlist
 * (`math-expression.ts`) as nested rows — a fraction is two stacked rows
 * with a rule, not the string "1/2".
 *
 * SOT: question-content.ts · question-layout.ts · question-contract.ts ·
 *      packages/student-model/src/math-expression.ts
 * SOT-KEYWORDS: xr question content surface block renderer math view list rtl skeleton hosted texture
 */

import React, { useEffect, useMemo } from 'react';
import { Image, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { MathJsonExpression } from '@cortex-js/compute-engine/math-json';
import { XR_COLOR, XR_SURFACE } from './xr-colors.ts';
import type { QuestionContentBlock, QuestionMediaSource } from './question-content.ts';
import type { QuestionContentProps, QuestionMediaResolver } from './QuestionContent.types.ts';

const FONT = {
  prompt: { fontSize: 24, fontWeight: '700', color: XR_COLOR.onPanel } as TextStyle,
  body: { fontSize: 17, color: XR_COLOR.onPanel } as TextStyle,
  muted: { fontSize: 14, color: XR_COLOR.onPanelMuted } as TextStyle,
  heading: { fontSize: 20, fontWeight: '700', color: XR_COLOR.onPanel } as TextStyle,
  mono: { fontSize: 15, fontFamily: 'monospace', color: XR_COLOR.onPanel } as TextStyle,
};

const GAP = 12;

const writingDirection = (dir: 'ltr' | 'rtl' | 'auto'): TextStyle['writingDirection'] =>
  dir === 'auto' ? 'auto' : dir;

/** Numbered lists are LOCALIZED numbering, not "1." literals. */
const numeral = (n: number, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale).format(n);
  } catch {
    return String(n);
  }
};

/** Skeleton + alt treatment — the loading/error state that is never a
    stretched or absent image. */
function MediaFrame({ source, resolved, onSettled, style }: {
  source: QuestionMediaSource;
  resolved: { uri: string } | null;
  onSettled?: (ok: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const aspect = source.width && source.height ? source.width / source.height : 4 / 3;
  return (
    <View style={[{
      backgroundColor: XR_SURFACE.card,
      borderRadius: 8,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 96,
    }, style]}>
      {resolved ? (
        <Image
          source={resolved}
          /* Aspect preserved — `contain`, never stretched to fill. */
          style={{ width: '100%', aspectRatio: aspect }}
          resizeMode="contain"
          accessibilityLabel={source.alt}
          onLoad={() => onSettled?.(true)}
          onError={() => onSettled?.(false)}
        />
      ) : (
        /* Unresolvable fixtures and failed loads land here — the alt text
           is the accessible representation the spec requires. */
        <Text style={[FONT.muted, { padding: 16, textAlign: 'center' }]}>
          {source.alt ?? source.caption ?? 'Image'}
        </Text>
      )}
      {source.caption ? (
        <Text style={[FONT.muted, { paddingVertical: 6, paddingHorizontal: 12 }]}>
          {source.caption}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The bounded MathJSON tree, rendered as structure — Divide/Rational are
 * stacked rows with a rule line; anything the allowlist does not cover
 * renders its text form rather than pretending. The allowlist is the same
 * one `math-expression.ts` validates for evaluation: rendered shape and
 * graded shape can never disagree.
 */
function MathView({ expression }: { expression: MathJsonExpression }) {
  return <MathNode expr={expression} depth={0} />;
}

function MathNode({ expr, depth }: { expr: MathJsonExpression; depth: number }) {
  if (typeof expr === 'number') {
    return <Text style={[FONT.heading, { fontSize: 26 }]}>{String(expr)}</Text>;
  }
  if (expr !== null && typeof expr === 'object' && !Array.isArray(expr) && 'num' in expr) {
    const num = (expr as { num: string }).num;
    return <Text style={[FONT.heading, { fontSize: 26 }]}>{num}</Text>;
  }
  if (Array.isArray(expr) && typeof expr[0] === 'string') {
    const [op, ...args] = expr;
    if ((op === 'Divide' || op === 'Rational') && args.length === 2) {
      return (
        <View style={{ alignItems: 'center', marginHorizontal: 8 }}>
          <MathNode expr={args[0]!} depth={depth + 1} />
          <View style={{ height: 2, alignSelf: 'stretch', backgroundColor: XR_COLOR.onPanel, marginVertical: 4, minWidth: 32 }} />
          <MathNode expr={args[1]!} depth={depth + 1} />
        </View>
      );
    }
    const glyph =
      op === 'Add' ? '+' :
      op === 'Subtract' ? '−' :
      op === 'Multiply' ? '×' :
      op === 'Negate' ? '−' : null;
    if (glyph && args.length >= 1) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {op === 'Negate' && <Text style={[FONT.heading, { fontSize: 26, marginRight: 4 }]}>−</Text>}
          {args.map((a, i) => (
            <React.Fragment key={i}>
              {i > 0 && op !== 'Negate' && (
                <Text style={[FONT.heading, { fontSize: 26, marginHorizontal: 6 }]}>{glyph}</Text>
              )}
              <MathNode expr={a} depth={depth + 1} />
            </React.Fragment>
          ))}
        </View>
      );
    }
  }
  /* Beyond the allowlist: text form, visibly — never a silent drop. */
  return <Text style={FONT.body}>{JSON.stringify(expr)}</Text>;
}

function BlockView({ block, index, question, resolveMedia, onMediaSettled }: {
  block: QuestionContentBlock;
  index: number;
  question: QuestionContentProps['question'];
  resolveMedia?: QuestionMediaResolver;
  onMediaSettled?: (index: number, ok: boolean) => void;
}) {
  const rtl = question.textDirection === 'rtl';
  const dir = writingDirection(question.textDirection);
  const textStyle: TextStyle = { writingDirection: dir, textAlign: rtl ? 'right' : 'left' };
  const settle = (ok: boolean) => onMediaSettled?.(index, ok);
  switch (block.type) {
    case 'text':
      return (
        <Text style={[block.emphasis === 'strong' ? FONT.heading : FONT.body, textStyle,
          block.emphasis === 'callout' && {
            backgroundColor: XR_SURFACE.frame, borderRadius: 8, padding: 10,
          }]}>
          {block.text}
        </Text>
      );
    case 'heading':
      return <Text style={[FONT.prompt, textStyle]}>{block.text}</Text>;
    case 'list':
      return (
        <View style={{ gap: 8, direction: rtl ? 'rtl' : 'ltr' }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Text style={[FONT.body, { minWidth: 24, color: XR_COLOR.onPanelMuted }]}>
                {/* Semantic markers — localized numerals, not literal glyphs. */}
                {block.style === 'numbered' ? `${numeral(i + 1, question.questionLocale)}.` : '▪'}
              </Text>
              <Text style={[FONT.body, textStyle, { flex: 1 }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'image':
    case 'map':
      return <MediaFrame source={block.source} resolved={resolveMedia?.(block.source) ?? null} onSettled={settle} />;
    case 'image-grid': {
      const columns = block.columns ?? (block.items.length === 2 ? 2 : 2);
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {block.items.map((item, i) => (
            <MediaFrame
              key={i}
              source={item}
              resolved={resolveMedia?.(item) ?? null}
              onSettled={settle}
              style={{ width: `${100 / columns - 2}%` }}
            />
          ))}
        </View>
      );
    }
    case 'diagram':
      return (
        <View style={{ gap: 8 }}>
          <MediaFrame source={block.source} resolved={resolveMedia?.(block.source) ?? null} onSettled={settle} />
          {block.labels ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {block.labels.map((l) => (
                <View key={l.id} style={{ backgroundColor: XR_SURFACE.key, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={[FONT.muted, { color: XR_COLOR.onKey }]}>{l.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    case 'equation':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
          <MathView expression={block.expression} />
        </View>
      );
    case 'table':
      return (
        <View style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: XR_SURFACE.card }}>
          <View style={{ flexDirection: 'row', backgroundColor: XR_SURFACE.frame }}>
            {block.columns.map((c) => (
              <Text key={c.key} style={[FONT.muted, { flex: 1, padding: 8, fontWeight: '700' }]}>
                {c.header ?? c.key}{c.unit ? ` (${c.unit})` : ''}
              </Text>
            ))}
          </View>
          {block.rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row' }}>
              {row.map((cell, ci) => (
                <Text key={ci} style={[FONT.body, { flex: 1, padding: 8 }]}>{cell.text}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'code':
      return (
        <View style={{ backgroundColor: XR_SURFACE.frame, borderRadius: 8, padding: 12 }}>
          {/* Indentation is data — the pre string is rendered verbatim. */}
          <Text style={[FONT.mono, { writingDirection: 'ltr', textAlign: 'left' }]}>{block.code}</Text>
        </View>
      );
    case 'quote':
      return (
        <View style={{ borderStartWidth: 3, borderStartColor: XR_COLOR.focus, paddingStart: 12, gap: 4 }}>
          <Text style={[FONT.body, textStyle, { fontStyle: 'italic' }]}>{block.text}</Text>
          {block.attribution ? <Text style={FONT.muted}>— {block.attribution}</Text> : null}
        </View>
      );
    case 'passage':
      return (
        <View style={{ backgroundColor: XR_SURFACE.card, borderRadius: 8, padding: 14, gap: 8 }}>
          {block.title ? <Text style={[FONT.heading, textStyle]}>{block.title}</Text> : null}
          <Text style={[FONT.body, textStyle, { lineHeight: 26 }]}>{block.text}</Text>
        </View>
      );
    case 'timeline':
      return (
        <View style={{ gap: 10 }}>
          {block.events.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline', direction: rtl ? 'rtl' : 'ltr' }}>
              <Text style={[FONT.body, { fontWeight: '700', color: XR_COLOR.focus, minWidth: 56 }]}>{e.label}</Text>
              {e.detail ? <Text style={[FONT.body, textStyle, { flex: 1 }]}>{e.detail}</Text> : null}
            </View>
          ))}
        </View>
      );
    case 'chart':
      /* A chart's accessible contract is its data summary — rendered as a
         labelled series list until a chart surface earns the pixels. */
      return (
        <View style={{ backgroundColor: XR_SURFACE.card, borderRadius: 8, padding: 12, gap: 6 }}>
          {block.chart.title ? <Text style={[FONT.heading, textStyle]}>{block.chart.title}</Text> : null}
          {block.chart.series.map((s, i) => (
            <Text key={i} style={[FONT.body, textStyle]}>
              {s.label}: {s.values.join(', ')}
            </Text>
          ))}
        </View>
      );
    case 'audio':
      return (
        <View style={{ backgroundColor: XR_SURFACE.card, borderRadius: 8, padding: 14, gap: 6 }}>
          <Text style={[FONT.muted, textStyle]}>▶ {block.source.caption ?? 'Audio'}</Text>
          {block.source.transcript ? (
            <Text style={[FONT.muted, textStyle]}>{block.source.transcript}</Text>
          ) : null}
        </View>
      );
    case 'video':
      return <MediaFrame source={block.source} resolved={resolveMedia?.(block.source) ?? null} onSettled={settle} />;
    case 'document-region':
      /* Evidence, not pixels — the region resolves to the capture's own
         image through the media map, never re-OCR'd. */
      return (
        <View style={{ backgroundColor: XR_SURFACE.card, borderRadius: 8, padding: 14, gap: 6 }}>
          <Text style={FONT.muted}>WORKSHEET · {block.evidenceRegionId}</Text>
          {question.media?.length ? (
            <MediaFrame
              source={question.media[0]!}
              resolved={resolveMedia?.(question.media[0]!) ?? null}
              onSettled={settle}
            />
          ) : null}
        </View>
      );
    case 'board':
      /* The live board is the PANEL's composition, not this surface's —
         the marker keeps the block visible in the stream while
         `board-focus` routes the actual drawing surface. */
      return (
        <View style={{ backgroundColor: XR_SURFACE.frame, borderRadius: 8, padding: 20, alignItems: 'center' }}>
          <Text style={FONT.muted}>Your board is beside this panel — work it out there.</Text>
        </View>
      );
  }
}

/** Split a paged layout's blocks into pages at block boundaries. */
function pagesOf(blocks: readonly QuestionContentBlock[]): readonly (readonly QuestionContentBlock[])[] {
  /* A rough per-page budget in block count — the surface paginates on
     whole blocks, never slices one. */
  const PAGE_BUDGET = 4;
  const pages: QuestionContentBlock[][] = [];
  for (let i = 0; i < blocks.length; i += PAGE_BUDGET) pages.push(blocks.slice(i, i + PAGE_BUDGET));
  return pages.length > 0 ? pages : [[]];
}

export function XrQuestionContent({
  question,
  layout,
  resolveMedia,
  page = 0,
  onPageCount,
  onMediaSettled,
}: QuestionContentProps) {
  const rtl = question.textDirection === 'rtl';
  const dir = writingDirection(question.textDirection);
  const textStyle: TextStyle = { writingDirection: dir, textAlign: rtl ? 'right' : 'left' };

  const pages = useMemo(
    () => (layout.paged ? pagesOf(question.content) : [question.content]),
    [layout.paged, question.content],
  );
  useEffect(() => { onPageCount?.(pages.length); }, [pages.length, onPageCount]);
  const shown = pages[Math.min(page, pages.length - 1)] ?? [];

  const split = layout.kind === 'media-left' || layout.kind === 'passage-left';
  /* Focus layouts put the focus block first and largest; the rest of the
     content follows below it. */
  const focusFirst = layout.focus !== null;
  const ordered = useMemo(() => {
    if (!focusFirst) return [...shown];
    const i = shown.findIndex((b) => b.type === layout.focus);
    if (i <= 0) return [...shown];
    const copy = [...shown];
    const [f] = copy.splice(i, 1);
    return [f!, ...copy];
  }, [shown, layout.focus, focusFirst]);

  const blockView = (b: QuestionContentBlock, i: number) => (
    <BlockView
      key={`${question.id}-${i}`}
      block={b}
      index={question.content.indexOf(b)}
      question={question}
      resolveMedia={resolveMedia}
      onMediaSettled={onMediaSettled}
    />
  );

  const column = (blocks: readonly QuestionContentBlock[], flex?: number) => (
    <View style={[{ gap: GAP }, flex ? { flex } : null]}>
      {blocks.map(blockView)}
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 20, direction: rtl ? 'rtl' : 'ltr', gap: GAP }}>
      {/* The prompt lives here, not in Rive — it IS content, and content
          is this surface's job. */}
      <Text style={[FONT.prompt, textStyle]}>{question.prompt}</Text>
      {question.supportingText ? (
        <Text style={[FONT.muted, textStyle]}>{question.supportingText}</Text>
      ) : null}
      {split ? (
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: GAP, flex: 1 }}>
          <View style={{ flex: 1 }}>{ordered.filter((b) => b.type === layout.focus).map(blockView)}</View>
          <View style={{ flex: 1, gap: GAP }}>{ordered.filter((b) => b.type !== layout.focus).map(blockView)}</View>
        </View>
      ) : (
        column(ordered, 1)
      )}
      {layout.paged ? (
        <Text style={[FONT.muted, { textAlign: 'center' }]}>
          {numeral(page + 1, question.uiLocale)} / {numeral(pages.length, question.uiLocale)}
        </Text>
      ) : null}
    </View>
  );
}
