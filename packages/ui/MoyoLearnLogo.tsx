import * as React from "react";
import Svg, { Path, type SvgProps } from "react-native-svg";
import { getLogoFill, type LogoVariant } from "./logo-fill";

/*
  The MoyoLearn brand mark: the "MOYO" wordmark over a dash-flanked "LEARN".

  This IS the whole mark. The vendor art this path data came from carried an
  extra open-book emblem to the left of the wordmark, in the coordinate band
  x 0–171; that emblem appears nowhere in the shipped brand art
  (apps/mobile/assets/images/icon.png and adaptive-icon.png, which are the
  wordmark alone), so it was cut. If a compact glyph is ever needed, it has to
  be drawn from the real brand, not resurrected from that file.

  SOT: apps/mobile/assets/images/icon.png (the official mark)
  SOT-KEYWORDS: logo wordmark brand moyo learn svg mark native
*/
// The viewBox has a non-zero origin on purpose. Cropping to the wordmark's own
// ink bounds inside the source art's coordinate space keeps every path's `d`
// byte-identical to the vendor file — re-originating them to 0,0 would mean
// rewriting 11 path strings by hand, and any arithmetic slip there is a
// silently deformed letter. Values are the measured bbox of these 11 paths,
// rounded outward so no edge is clipped.
const VIEWBOX_MIN_X = 200.28;
const VIEWBOX_MIN_Y = 14.67;
const VIEWBOX_WIDTH = 396.25;
const VIEWBOX_HEIGHT = 143.04;
const ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
// Header-box height — kept in lockstep with the web fork so one wordmark
// renders the same size on both platforms by default.
const DEFAULT_HEIGHT = 36;

// Explicit dimensions rather than `width: "100%"` — mirrors the web fork,
// where parent-relative sizing made the logo flash at intrinsic (viewport)
// size before styles landed. Pass `height` (or `width`); the other dimension
// derives from the wordmark's aspect ratio.
const resolveBox = (width?: number, height?: number) => {
  if (height != null) return { width: width ?? height * ASPECT_RATIO, height };
  if (width != null) return { width, height: width / ASPECT_RATIO };
  return { width: DEFAULT_HEIGHT * ASPECT_RATIO, height: DEFAULT_HEIGHT };
};

export interface MoyoLearnLogoProps extends Omit<SvgProps, "width" | "height"> {
  variant?: LogoVariant;
  /** Rendered height in px; width derives from the wordmark's aspect ratio. */
  height?: number;
  /** Rendered width in px; height derives from the wordmark's aspect ratio. */
  width?: number;
}

const MoyoLearnLogo = ({ variant = "default", style, width, height, ...props }: MoyoLearnLogoProps) => (
  <Svg
    {...props}
    {...resolveBox(width, height)}
    viewBox={`${VIEWBOX_MIN_X} ${VIEWBOX_MIN_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    preserveAspectRatio="xMidYMid meet"
    style={style}
    accessibilityRole="image"
  >
    {/* Paint order is the source art's, unchanged: the Y and the teal O share a
        sliver of x, so resorting these into reading order can change the seam. */}
    <Path fill={getLogoFill('#3C2357', variant)} d="M276.83,72.5c0-.98-.14-1.66-.72-1.96l-12.23,15.75c-1.44,1.86-2.82,4.13-5.36,4.47-2.95.39-6.01.29-8.98.03-1.57-.14-2.82-1.4-3.75-2.58l-14.2-18.04-.23,31.86c-.02,3.46-2.49,7.35-6.18,7.35h-18.6c-3.19,0-6.3-3.64-6.3-7.08l.09-78.64c0-4.58,3.63-7.98,7.88-7.99l14.57-.02c2.97,0,5.5,1.47,7.3,3.79l24.24,31.08,23.61-30.22c2.43-3.11,5.52-5.06,9.6-4.71l13.12.07c3.32.02,7.39,2.81,7.39,6.78l.06,79.86c0,3.47-3.03,7.1-6.27,7.1h-18.67c-4.09,0-6.49-4.37-6.48-8.17l.1-28.74Z" />
    <Path fill={getLogoFill('#0A9FA6', variant)} d="M596.11,70.51c-2.11,19.75-14.9,34.77-34.42,39.33-9.67,2.26-19.62,1.94-29.18-.76-18.12-5.13-30.05-19.92-32.01-38.57-1.69-16.07,2.06-32.7,14.25-43.66,9.03-8.12,20.65-12.04,32.74-12.17,8.15-.08,15.82,1.28,23.16,4.7,20.28,9.45,27.76,29.5,25.45,51.12ZM564.33,74.59c3.35-6.31,3.52-13.68.98-20.02-3-7.5-9.86-11.73-17.8-11.38-7.33.32-13.64,4.3-16.27,11.25-2.21,5.84-2.18,12.26.11,18.06,2.68,6.79,8.8,10.75,16.02,11.05s13.54-2.55,16.95-8.96Z" />
    <Path fill={getLogoFill('#E55545', variant)} d="M383.69,108.06c-12.26,4.47-27.18,4.29-39.38-.5-12.1-4.75-21.19-14.42-25.08-26.91-3.58-11.5-3.37-23.68.23-35.19,4.11-13.16,13.98-23.32,27.04-27.75,12.72-4.32,26.53-4.05,38.9,1.17,22.81,9.6,30.42,33.94,25.65,57.37-3.02,14.84-13.17,26.64-27.36,31.82ZM381.65,72.22c2.32-6.1,2.16-13.15-.72-19.04-3.4-6.96-10.38-10.51-18-9.97s-13.31,5.24-15.62,12.28c-1.43,4.36-1.46,9.08-.64,13.57,1.46,7.94,7.53,13.47,15.44,14.44,8.35,1.02,16.44-3.16,19.53-11.27Z" />
    <Path fill={getLogoFill('#F4A629', variant)} d="M503.37,24.04l-30.56,49.01-.15,28.64c-.02,3.61-2.34,7.69-6.18,7.69h-20.55c-3.13-.02-5.89-3.9-5.89-6.94l-.07-29-30.05-48.83c-1.09-1.78-.69-4.19.33-5.9.81-1.35,2.75-2.99,4.89-3l20.02-.06c2.69,0,5.44,1.47,6.91,3.72l15.3,23.48,14.12-21.94c1.84-2.87,4.28-4.96,7.81-5.33l18.07.02c4.1.81,6.99,4.03,6.01,8.44Z" />
    <Path fill={getLogoFill('#3C2357', variant)} d="M522.63,154.94l-2.1-2.71-7.66-9.97-.14,12.96c0,.82-.27,1.47-.74,1.89-1.17,1.04-5.16.56-5.17-.83l-.11-24.5c1.58-.45,4.23-1.26,5.61-.06l11.47,14.74.07-12.77c0-1.63,1.25-2.77,3.01-2.45,1.29-.32,3.16.6,3.14,2.14l-.18,22.85c-.01,1.6-2.84,1.49-3.88,1.4-1.39-.12-2.25-1.28-3.33-2.68Z" />
    <Path fill={getLogoFill('#3C2357', variant)} d="M460.7,156.5l-4.72-6.95c-.95-.65-2.77-.35-3.97-.19l-.19,6.58c-.05,1.86-3.62,2.16-4.93,1.25-.68-.47-.95-1.37-.95-2.38v-20.71c-.02-1.63,1.04-2.93,2.72-2.92l10.4.1c5.23.05,8.64,4.53,8.28,9.58-.24,3.28-1.64,5.87-5.03,7.25l4.18,6.17c.51.75.44,1.75-.05,2.42-1.05,1.42-4.76,1.21-5.73-.21ZM458.11,143.74c2.15-.04,3.24-2.15,3.05-3.8s-1.5-3.08-3.38-3.07h-5.89s.06,6.99.06,6.99l6.16-.11Z" />
    <Path fill={getLogoFill('#3C2357', variant)} d="M331.62,147.08c-.39,1.66-.26,3.22-.08,4.91l11.19.19c1.29.02,1.51,1.57,1.53,2.44s-.18,2.83-1.51,2.84l-15.27.12c-1.32.01-2.17-1.08-2.17-2.34v-21.53c0-1.47,1.01-2.52,2.5-2.51l14.65.13c1.38.01,1.78,1.68,1.82,2.6.04,1.03-.33,2.69-1.73,2.72l-10.97.19c-.19,1.54-.26,3.17-.01,4.86l9.28.14c1.18.02,1.53,1.49,1.61,2.28.09.97-.07,2.76-1.39,2.79l-9.42.19Z" />
    <Path fill={getLogoFill('#3C2357', variant)} d="M400.08,152.61l-10.79-.15-1.6,3.9c-.72,1.77-4.56,1.62-5.6.54-.6-.63-.75-1.68-.32-2.68l9.21-21.55c.99-2.31,6.49-1.78,7.09-.35l9.11,21.62c.37.87.54,1.62.15,2.42-.29.6-1.01,1.18-1.93,1.19l-3.14.06-2.19-5.01ZM397.91,146.93l-3.31-7.73-3.14,7.88,6.45-.15Z" />
    <Path fill={getLogoFill('#3C2357', variant)} d="M285.8,157.4l-13.75.21c-1.3.02-2.52-1.05-2.51-2.39l.17-22.59c.01-1.32,2.12-1.52,2.96-1.49s2.83.24,2.84,1.63l.18,19.18,10,.23c1.3.03,1.59,1.59,1.6,2.45,0,.76-.11,2.76-1.49,2.78Z" />
    <Path fill={getLogoFill('#E55545', variant)} d="M236.66,147.71l-29.3.06c-1.75,0-2.79-1.1-2.99-2.52-.21-1.5.68-3.26,2.57-3.26l29.54.03c1.33,0,2,1.66,2.1,2.48.15,1.24-.3,2.56-1.92,3.2Z" />
    <Path fill={getLogoFill('#E55545', variant)} d="M593.79,147.73l-28.51.04c-1.78,0-2.88-1.44-2.87-2.89s1.1-2.92,2.87-2.92l28.3.02c1.67,0,2.75,1.17,2.92,2.54s-.68,3.21-2.7,3.21Z" />
  </Svg>
);

MoyoLearnLogo.displayName = "MoyoLearnLogo";

export default React.memo(MoyoLearnLogo);
