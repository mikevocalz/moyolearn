'use client';
// PLATFORM FORK: the Forge board glyphs on web, drawn with plain DOM <svg>.
//
// react-native-svg cannot ship to web here. Under Turbopack and rolldown with
// react-native-web it pulls in Fabric modules (`TurboModuleRegistry`) that RNW
// does not export, and because Whiteboard is in the kit barrel the failure takes
// down every web route (TrendLine.web.tsx records the same lesson). The glyph
// data comes from `@nitro-forge/icons`' main entry, which is plain JS; only its
// `./native` and `./web` entries import react-native-svg, and this file uses
// neither.
//
// Same props and the same outline/filled crossfade as ForgeBoardIcon.tsx. The
// crossfade is a CSS opacity transition, so Reduce Motion swaps instantly.
// The caller's className (`text-text`, `text-text-inverse`) resolves to a colour
// through the kit's css() boundary and reaches the paths as `currentColor`.
// SOT: packages/ui/ForgeBoardIcon.tsx (native fork; carries the Mobbin citation)
// SOT-KEYWORDS: forge board icon glyph pen highlighter eraser undo redo trash whiteboard web svg
import { useId, type CSSProperties, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { getGlyph } from '@nitro-forge/icons';
import { useReducedMotion } from './motion';
import { css } from './html/css';
import type { ForgeBoardIconName } from './ForgeBoardIcon';

export type { ForgeBoardIconName } from './ForgeBoardIcon';

interface Props {
  name: ForgeBoardIconName;
  selected?: boolean;
  size?: number;
  className?: string;
}

// Only the resolved text colour crosses onto the DOM span: the caller's classes
// are colour tokens, and the box size comes from `size`, not from CSS.
const Box = ({ style, children }: { style?: StyleProp<TextStyle>; children?: ReactNode }) => {
  const color = StyleSheet.flatten(style)?.color;
  return (
    <span
      aria-hidden
      style={{ position: 'relative', display: 'inline-flex', pointerEvents: 'none', color: typeof color === 'string' ? color : undefined }}
    >
      {children}
    </span>
  );
};
const TintedBox = css(Box, 'ForgeBoardIconBox');

function Glyph({ name, filled, size, style }: { name: ForgeBoardIconName; filled: boolean; size: number; style?: CSSProperties }) {
  const maskId = `forge-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paths = getGlyph(name, filled ? 'filled' : 'outline');
  if (!paths) return null;
  const knockouts = paths.filter(([, mode]) => mode === 'knockout');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" focusable="false" aria-hidden style={style}>
      <defs>
        <mask id={maskId} x="0" y="0" width="24" height="24" maskUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="white" />
          {knockouts.map(([d], index) => (
            <path key={index} d={d} fill={/[zZ]\s*$/.test(d ?? '') ? 'black' : 'none'} stroke="black" strokeWidth={2.35} strokeLinecap="round" />
          ))}
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {paths
          .filter(([, mode]) => mode !== 'knockout')
          .map(([d, mode], index) => (
            <path
              key={index}
              d={d}
              fill={mode === 'fill' ? 'currentColor' : 'none'}
              stroke={mode === 'fill' ? 'none' : 'currentColor'}
              strokeWidth={2.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              fillRule="evenodd"
            />
          ))}
      </g>
    </svg>
  );
}

/** Original Forge outline/filled artwork; web crossfade matches the native 120 ms ease-out. */
export function ForgeBoardIcon({ name, selected = false, size = 20, className }: Props) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return (
      <TintedBox className={className}>
        <Glyph name={name} filled={selected} size={size} />
      </TintedBox>
    );
  }
  const layer = (visible: boolean): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    opacity: visible ? 1 : 0,
    transition: 'opacity 120ms ease-out',
  });
  return (
    <TintedBox className={className}>
      <span style={{ position: 'relative', display: 'block', width: size, height: size }}>
        <Glyph name={name} filled={false} size={size} style={layer(!selected)} />
        <Glyph name={name} filled size={size} style={layer(selected)} />
      </span>
    </TintedBox>
  );
}
