import * as React from "react";
import { getLogoFill, type LogoVariant } from "./logo-fill";

/*
  The compact Moyo mark: an open book whose pages form a heart, cradled by a
  purple "M" patterned with Adinkra-style dots and diamonds.

  This is the SECOND half of the brand, not a decoration on the first. The
  shipped art keeps them apart — apps/mobile/assets/images/icon.png is the
  wordmark alone, apps/mobile/assets/images/favicon.png is this mark alone —
  so the two never render locked together. Reach for this wherever a wordmark
  cannot survive the width (favicons, a collapsed rail, an avatar-sized slot);
  reach for MoyoLearnLogo everywhere else.

  Mobbin: https://mobbin.com/screens/6f6be3fb-19ba-4c30-b894-ed484397ae5e (Rivian — mark alone above "Welcome to X", which is the front-door structure this mark had to survive) · https://mobbin.com/screens/65d05678-df7a-4f87-8394-173095d92ffe (PlayStation App — same shape, and the mark reads at a size no wordmark would) · https://mobbin.com/screens/4eb893d0-8a49-4aff-91b3-d7e9b024a579 (Binance — the wordmark case, kept beside these to show where a compact mark is the WRONG pick) · https://mobbin.com/screens/8853ada3-4a32-47a9-99bf-de5a8b65c505 (Vivino — the mark at list-avatar scale, the smallest slot it has to hold up in) · https://mobbin.com/screens/f7f0ec2e-89bf-4361-a9f3-ee19a8cd43bc (pliability — mark plus wordmark locked up small in chrome)
  SOT: apps/mobile/assets/images/favicon.png (the official mark)
  SOT-KEYWORDS: logo mark emblem glyph brand moyo icon favicon compact svg web
*/
// Measured bbox of these 30 elements inside the source art's coordinate space,
// rounded outward. Non-zero-origin viewBox for the same reason as the wordmark:
// it crops without touching a single `d` string.
const VIEWBOX_WIDTH = 171.38;
const VIEWBOX_HEIGHT = 157.61;
const ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
// Square-ish by nature, so it defaults to the 36px chrome slot's HEIGHT and
// comes out 39px wide — the wordmark's default height, so the two marks read
// as the same size when a surface shows one or the other.
const DEFAULT_HEIGHT = 36;

// Width/height attributes rather than CSS sizing, matching MoyoLearnLogo: before
// the stylesheet lands the parent box does not exist, and a parent-relative svg
// paints once at viewport width before snapping back.
const resolveBox = (width?: number, height?: number) => {
  if (height != null) return { width: width ?? height * ASPECT_RATIO, height };
  if (width != null) return { width, height: width / ASPECT_RATIO };
  return { width: DEFAULT_HEIGHT * ASPECT_RATIO, height: DEFAULT_HEIGHT };
};

export interface MoyoMarkProps
  extends Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> {
  accessibilityLabel?: string;
  variant?: LogoVariant;
  /** Rendered height in px; width derives from the mark's aspect ratio. */
  height?: number;
  /** Rendered width in px; height derives from the mark's aspect ratio. */
  width?: number;
}

const MoyoMark = ({
  variant = "default",
  style,
  accessibilityLabel,
  width,
  height,
  ...props
}: MoyoMarkProps) => (
  <svg
    {...props}
    {...resolveBox(width, height)}
    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    preserveAspectRatio="xMidYMid meet"
    style={style}
    role="img"
    aria-label={accessibilityLabel}
  >
    {/* Paint order is load-bearing: the off-white page shapes are painted first
        and the coloured pages sit on top of them, so the white reads as the
        page edge. Sorting these by colour collapses the book into a flat slab. */}
    <path fill={getLogoFill('#FEFEFE', variant)} d="M67.2,73.36c-3.24-2.98-6.52-5.88-9.49-9.34-3.83-4.47-5.01-10.66-2.97-16.1,1.76-4.69,5.78-7.91,9.79-9.22,5.3-1.72,10.21-.46,14.38,2.49,2.45,1.74,4.05,3.97,6.04,6.3-.38-6.26-1.91-11.99-4.45-17.42-2.49-5.33-6.37-9.15-11.41-12.06-7.38-4.25-14.88-7.67-22.85-10.75L27.99.2c-1.79-.69-4.27.48-4.27,2.63l-.05,40.04c3.04,1.74,5.65,3.41,8.56,5.35,12.05,7.93,23.41,16.53,34.59,25.45l.38-.31Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M117.52,56.64c-.65,2.94-1.84,5.55-3.83,7.55l-10.12,10.18,27.58-20.59c5.4-4.03,10.83-7.55,16.64-10.86V3.48c.01-1.21-.29-2.08-1.1-2.66-.69-.49-1.7-.82-2.65-.44l-20.18,7.99c-7.54,2.99-14.54,6.41-21.52,10.5-4.42,2.59-7.88,5.99-10.3,10.58-2.99,5.67-4.7,11.89-5.09,18.31,2.33-3.05,4.47-5.5,7.44-7.33,5.13-3.15,11.08-3.34,16.19-.12,5.49,3.47,8.38,9.72,6.93,16.32Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M62.26,73.43c-13.28-10.4-27.79-20.1-43.28-27.45l-.02-35.76c0-.52-1.05-.82-1.33-.87-1.11-.63-2.15-.51-3.1.07-.84.51-1.23,1.51-1.23,2.76l-.05,37.58c17.17,6.51,33.25,14.7,48.7,24.01l.3-.35Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M107.39,75.36l9.05-5.29c13.37-7.72,27.09-14.57,41.62-20.23l.05-38.01c0-1.23-.52-1.98-1.29-2.51-.82-.56-1.86-.46-2.76.09-1.1.18-1.6.79-1.6,1.9v34.83c-16.29,8.04-31.24,17.81-45.06,29.23Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M168.11,157.6c2.44,0,3.26-1.59,3.26-3.69l-.06-131.31c0-2.06-1.9-3.62-3.21-4.11-1.76-.67-4.23-.43-5.23.9l-.14,33.87c-15.77,6.26-29.93,14.16-44.22,23.14l-29.28,19.35c-1.54,1.02-2.56,2.05-3.45,3.96-.94-2.03-2.33-3.08-4.1-4.27l-25.25-16.98c-15.19-9.81-30.99-18.57-47.78-25.26l-.13-33.66c-1.05-1.76-4.39-1.6-5.93-.68C.52,20.09.06,21.82.06,24.35L0,154.56c0,1.82,1.19,3,2.98,3h33.91c1.67,0,2.98-1.27,2.98-2.96v-56.56c0-.92.62-1.53,1.13-1.72.7-.26,1.29.06,1.93.5l40.5,27.91c1.78,1.23,3.69.79,5.33-.34l40.18-27.6c.6-.41,1.03-.66,1.65-.47.32.1.94.35.94,1.04l.03,57.48c0,1.69,1.6,2.76,3.12,2.76h33.45Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M62.41,73.56l-.26.36c.23.18.44.34.57.36.39.07.49-.36.14-.51-.12-.05-.19-.22-.45-.22Z" />
    <polygon fill={getLogoFill('#FEFEFE', variant)} points="67.28 73.41 67.08 73.84 67.79 74.32 67.99 74.07 67.28 73.41" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M64.32,75.19c-.11-.82-.77-1.18-1.29-.7.44.51.92.65,1.29.7Z" />
    <polygon fill={getLogoFill('#FEFEFE', variant)} points="68.16 74.23 67.91 74.54 68.47 74.86 68.53 74.64 68.16 74.23" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M68.8,74.9l-.15.51c.39.17.51-.4.15-.51Z" />
    <path fill={getLogoFill('#3C2357', variant)} d="M168.11,157.6h-33.45c-1.52,0-3.12-1.08-3.12-2.77l-.03-57.48c0-.68-.62-.94-.94-1.04-.62-.19-1.05.06-1.65.47l-40.18,27.6c-1.64,1.13-3.55,1.57-5.33.34l-40.5-27.91c-.65-.44-1.23-.76-1.93-.5-.5.19-1.12.8-1.12,1.72v56.56c0,1.69-1.31,2.97-2.98,2.97H2.98C1.19,157.56,0,156.38,0,154.56L.06,24.35c0-2.53.46-4.26,2.54-5.51,1.54-.92,4.88-1.08,5.93.68l.13,33.66c16.79,6.69,32.59,15.45,47.78,25.26l25.25,16.98c1.77,1.19,3.16,2.24,4.1,4.27.89-1.91,1.91-2.94,3.45-3.96l29.28-19.35c14.29-8.98,28.45-16.88,44.22-23.14l.14-33.87c1-1.33,3.47-1.56,5.23-.9,1.3.5,3.21,2.06,3.21,4.11l.06,131.31c0,2.1-.82,3.69-3.26,3.69ZM22.62,95.4c.66-1.77.13-3.66-1.17-4.74-1.93-1.6-4.56-.97-5.82.92s-.73,4.62,1.26,5.71,4.83.52,5.73-1.89ZM152.1,89.79c-2.33.34-3.85,2.49-3.52,4.67s2.41,3.63,4.65,3.29,3.72-2.34,3.35-4.66c-.31-1.95-2.29-3.62-4.48-3.3ZM26.62,104.5c.8-.8.7-1.95.08-2.58-.48-.49-1.47-1.01-2.14-.35l-5.6,5.5-5.21-5.21c-.85-.85-2.24-.64-2.78.11-.74,1.01-.27,2.02.53,2.79l6.5,6.29c.34.33,1.64.4,2,.05l6.64-6.61ZM150.98,110.6c.77.79,1.99,1.05,2.75.32l6.16-6c.76-.74,1.21-1.73.71-2.65-.31-.58-1.51-1.47-2.22-.8l-5.99,5.6-5.01-5.19c-.68-.71-1.94-.69-2.56-.09-.43.42-.83,1.67-.24,2.27l6.41,6.54ZM20.24,131.26l6.32-6.49c.8-.82.79-1.94.02-2.73l-5.54-5.7c-.84-.86-2.06-2.03-3.21-.9l-6.44,6.33c-.82.8-1.16,2.03-.27,2.92l6.67,6.76c.65.66,1.83.45,2.44-.18ZM153.37,131.52l7-6.91c.54-.53.72-1.7.17-2.25l-6.87-6.9c-.87-.88-1.93-.31-2.66.43l-6.32,6.47c-.82.84-.25,1.89.43,2.58l5.58,5.69c.59.6,1.7,1.85,2.68.89ZM25.82,139.25c1.02,0,1.37-1.17,1.31-1.75-.07-.65-.53-1.51-1.44-1.5l-13.77.03c-.9,0-1.24.89-1.3,1.49-.06.53.17,1.71,1.02,1.72l14.18.02ZM159.16,139.28c1.27,0,1.74-.95,1.68-1.75-.08-.99-.72-1.57-1.82-1.56l-13.47.06c-.86,0-1.15.95-1.23,1.51-.07.49.16,1.66.98,1.67l13.85.07ZM11.94,144.92c-1.3.72-1.35,2.36-.61,3.39.61.85,2,1.02,2.94.51,1.12-.62,1.43-2.07.86-3.07s-1.98-1.51-3.19-.83ZM23.2,144.95c-1.31.79-1.2,2.38-.54,3.27.74.99,2.05.99,2.85.58,1.36-.71,1.46-2.15.9-3.14-.59-1.05-2.08-1.38-3.2-.71ZM145.96,144.81c-1.29.46-1.72,1.89-1.18,3.05.51,1.09,1.8,1.46,2.89,1.03,1.21-.47,1.67-1.84,1.2-2.9s-1.72-1.6-2.91-1.18ZM156.84,144.95c-1.29.8-1.17,2.41-.55,3.29.72,1.03,2.11.99,2.9.57,1.34-.71,1.44-2.21.89-3.16-.63-1.08-2.08-1.41-3.23-.7Z" />
    <path fill={getLogoFill('#ED6646', variant)} d="M66.82,73.67c-11.18-8.91-22.54-17.52-34.59-25.45-2.9-1.94-5.52-3.61-8.56-5.35l.05-40.04c0-2.15,2.49-3.32,4.27-2.63l18.25,7.07c7.97,3.09,15.47,6.5,22.85,10.75,5.04,2.9,8.92,6.72,11.41,12.06,2.54,5.43,4.07,11.16,4.45,17.42-1.98-2.33-3.58-4.56-6.04-6.3-4.17-2.95-9.08-4.22-14.38-2.49-4.01,1.3-8.03,4.53-9.79,9.22-2.04,5.44-.86,11.63,2.97,16.1,2.96,3.46,6.25,6.36,9.49,9.34l.08.05.7.67.17.15.38.41.27.25c.36.11.24.69-.15.51.07-.38-.13-.52-.18-.55l-.56-.32c-.11-.06-.13-.15-.12-.23l-.71-.48c-.12-.08-.2-.15-.25-.17Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M117.52,56.64c1.45-6.6-1.44-12.85-6.93-16.32-5.1-3.23-11.06-3.04-16.19.12-2.98,1.83-5.11,4.28-7.44,7.33.39-6.42,2.1-12.64,5.09-18.31,2.42-4.59,5.88-7.99,10.3-10.58,6.97-4.09,13.97-7.52,21.52-10.5L144.05.38c.95-.38,1.96-.05,2.65.44.82.58,1.11,1.45,1.11,2.66v39.45c-5.82,3.31-11.26,6.83-16.65,10.86l-27.58,20.59,10.12-10.18c1.99-2,3.18-4.61,3.83-7.55Z" />
    <path fill={getLogoFill('#ED6646', variant)} d="M61.97,73.78c-15.46-9.31-31.54-17.5-48.7-24.01l.05-37.58c0-1.26.38-2.25,1.23-2.76.95-.58,1.99-.7,3.1-.07.28.05,1.33.35,1.33.87l.02,35.76c15.49,7.35,30,17.05,43.28,27.45l.15.13c.27,0,.33.16.45.22.34.15.25.58-.14.51-.13-.02-.34-.19-.57-.36l-.19-.14Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M107.39,75.36c13.82-11.42,28.77-21.19,45.06-29.23V11.3c0-1.11.49-1.72,1.6-1.9.9-.55,1.94-.64,2.76-.09s1.3,1.28,1.29,2.51l-.05,38.01c-14.53,5.67-28.24,12.52-41.62,20.23l-9.05,5.29Z" />
    <path fill={getLogoFill('#ED6646', variant)} d="M64.32,75.19c-.37-.05-.85-.19-1.29-.7.52-.49,1.18-.12,1.29.7Z" />
    <path fill={getLogoFill('#ED6646', variant)} d="M20.24,131.26c-.61.63-1.8.84-2.44.18l-6.67-6.76c-.89-.9-.55-2.12.27-2.92l6.44-6.33c1.15-1.13,2.37.04,3.21.9l5.54,5.7c.77.8.79,1.91-.02,2.73l-6.32,6.49ZM19.02,127.53l4-4.18-4.09-4.12-4.15,4.18,4.24,4.13Z" />
    <path fill={getLogoFill('#ED6646', variant)} d="M153.37,131.52c-.98.97-2.09-.29-2.68-.89l-5.58-5.69c-.68-.69-1.25-1.74-.43-2.58l6.32-6.47c.73-.74,1.79-1.31,2.66-.43l6.87,6.9c.55.55.37,1.72-.17,2.25l-7,6.91ZM152.65,127.54l4.06-4.19-4.11-4.1-4.17,4.18,4.22,4.12Z" />
    <path fill={getLogoFill('#0A9FA6', variant)} d="M26.62,104.5l-6.64,6.61c-.35.35-1.65.29-2-.05l-6.5-6.29c-.8-.77-1.27-1.78-.53-2.79.55-.75,1.94-.96,2.78-.11l5.21,5.21,5.6-5.5c.67-.66,1.67-.14,2.14.35.62.63.73,1.78-.08,2.58Z" />
    <path fill={getLogoFill('#0A9FA6', variant)} d="M150.98,110.6l-6.41-6.54c-.58-.59-.19-1.85.24-2.27.62-.6,1.88-.62,2.56.09l5.01,5.19,5.99-5.6c.72-.67,1.91.22,2.22.8.5.92.06,1.91-.71,2.65l-6.16,6c-.76.74-1.98.47-2.75-.32Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M152.1,89.79c2.19-.32,4.17,1.34,4.48,3.3.37,2.32-1.15,4.33-3.35,4.66s-4.32-1.08-4.65-3.29,1.19-4.33,3.52-4.67Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M159.16,139.28l-13.85-.07c-.83,0-1.05-1.18-.98-1.67.08-.56.36-1.51,1.23-1.51l13.47-.06c1.1,0,1.74.58,1.82,1.56.06.8-.41,1.76-1.68,1.75Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M22.62,95.4c-.9,2.42-3.7,3-5.73,1.89s-2.55-3.77-1.26-5.71,3.89-2.52,5.82-.92c1.3,1.07,1.83,2.97,1.17,4.74Z" />
    <path fill={getLogoFill('#F4A629', variant)} d="M25.82,139.25l-14.18-.02c-.85,0-1.08-1.18-1.02-1.72.06-.6.41-1.49,1.3-1.49l13.77-.03c.9,0,1.37.86,1.44,1.5.06.57-.29,1.75-1.31,1.75Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M11.94,144.92c1.21-.68,2.61-.2,3.19.83s.26,2.45-.86,3.07c-.95.52-2.34.34-2.94-.51-.74-1.03-.68-2.67.61-3.39Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M156.84,144.95c1.15-.71,2.6-.38,3.23.7.56.95.45,2.45-.89,3.16-.78.41-2.17.46-2.9-.57-.62-.89-.74-2.49.55-3.29Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M23.2,144.95c1.12-.67,2.61-.34,3.2.71.56.99.47,2.43-.9,3.14-.79.41-2.11.41-2.85-.58-.67-.89-.77-2.48.54-3.27Z" />
    <path fill={getLogoFill('#FEFEFE', variant)} d="M145.96,144.81c1.18-.42,2.42.1,2.91,1.18s.01,2.43-1.2,2.9c-1.09.42-2.38.06-2.89-1.03-.54-1.15-.11-2.59,1.18-3.05Z" />
    <polygon fill={getLogoFill('#3C2357', variant)} points="19.02 127.53 14.78 123.4 18.93 119.22 23.02 123.34 19.02 127.53" />
    <polygon fill={getLogoFill('#3C2357', variant)} points="152.65 127.54 148.43 123.43 152.6 119.25 156.71 123.35 152.65 127.54" />
  </svg>
);

MoyoMark.displayName = "MoyoMark";

export default React.memo(MoyoMark);
