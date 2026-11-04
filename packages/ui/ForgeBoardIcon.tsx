'use client';
// Forge board tool glyphs (pen, highlighter, eraser, undo, redo, trash) with an
// outline-to-filled crossfade for the selected tool. Native fork; the web fork
// (ForgeBoardIcon.web.tsx) draws the same glyphs with DOM <svg>.
// Mobbin: https://mobbin.com/screens/6a91e0ce-13a4-42fe-b5d8-9d2aba344871 (Craft: undo and redo sit apart from the drawing tools, which share one row) · https://mobbin.com/screens/bffbe166-34a2-49ae-8f1d-587a518b3d03 (Freeform: the selected tool changes state in place instead of gaining a separate highlight chip) · https://mobbin.com/screens/a9791ffa-07a6-439f-8a76-9de63ac67c3c (Brave whiteboard: undo, redo and clear grouped as one cluster of equal-weight glyph buttons) · https://mobbin.com/screens/91721f84-50cc-4e30-98b0-b96daebba9bc (Apple Photos Markup: pen, highlighter and eraser as one ordered set, eraser last)
// SOT-KEYWORDS: forge board icon glyph pen highlighter eraser undo redo trash whiteboard native svg

import { useId } from 'react';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { getGlyph } from '@nitro-forge/icons';
import { View } from './primitives';
import { MotionView, useReducedMotion } from './motion';
import { css } from './html/css';

/** Finished Forge glyphs used by the board; catalog-only names are excluded. */
export type ForgeBoardIconName = 'pen' | 'highlighter' | 'eraser' | 'undo' | 'redo' | 'trash';

interface Props {
  name: ForgeBoardIconName;
  selected?: boolean;
  size?: number;
  className?: string;
}

const ThemedSvg = css(Svg as React.ComponentType<object>, 'ForgeBoardSvg') as typeof Svg & React.ComponentType<{ className?: string }>;

function Glyph({ name, filled, size, className }: Props & { filled: boolean }) {
  const maskId = `forge-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paths = getGlyph(name, filled ? 'filled' : 'outline');
  if (!paths) return null;
  const knockouts = paths.filter(([, mode]) => mode === 'knockout');
  return (
    <ThemedSvg width={size} height={size} viewBox="0 0 24 24" className={className} accessible={false} focusable={false}>
      <Defs>
        <Mask id={maskId} x="0" y="0" width="24" height="24" maskUnits="userSpaceOnUse">
          <Rect width="24" height="24" fill="white" />
          {knockouts.map(([d], index) => <Path key={index} d={d} fill={/[zZ]\s*$/.test(d ?? '') ? 'black' : 'none'} stroke="black" strokeWidth={2.35} strokeLinecap="round" />)}
        </Mask>
      </Defs>
      <G mask={`url(#${maskId})`}>
        {paths.filter(([, mode]) => mode !== 'knockout').map(([d, mode], index) => (
          <Path key={index} d={d} fill={mode === 'fill' ? 'currentColor' : 'none'} stroke={mode === 'fill' ? 'none' : 'currentColor'} strokeWidth={2.35} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd" />
        ))}
      </G>
    </ThemedSvg>
  );
}

/** Original Forge outline/filled artwork animated through Moyo's existing motion layer. */
export function ForgeBoardIcon({ name, selected = false, size = 20, className }: Props) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <Glyph name={name} filled={selected} size={size} className={className} />;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessible={false}>
      <MotionView style={{ position: 'absolute' }} animate={{ opacity: selected ? 0 : 1 }} transition={{ type: 'timing', duration: 120, easing: 'easeOut' }}>
        <Glyph name={name} filled={false} size={size} className={className} />
      </MotionView>
      <MotionView style={{ position: 'absolute' }} animate={{ opacity: selected ? 1 : 0 }} transition={{ type: 'timing', duration: 120, easing: 'easeOut' }}>
        <Glyph name={name} filled size={size} className={className} />
      </MotionView>
    </View>
  );
}
