/**
 * The compact mark, used wherever the admin has room for a glyph and not a
 * wordmark — the collapsed nav and the browser-tab-sized slots.
 *
 * Same story as `Logo`: this was a `.moyo-lockup__tile` span with the letter
 * "M" in it, and that class has no rule anywhere in the repo. It is the real
 * mark now, which is also the art the admin's sibling surfaces use.
 *
 * SOT: packages/ui/MoyoMark.tsx · apps/mobile/assets/images/favicon.png
 * SOT-KEYWORDS: payload admin icon brand graphics mark glyph moyo
 */
import { MoyoMark } from '@acme/ui/brand';

export function Icon() {
  // Payload's icon slot is a square around 28px; sized by width because the
  // mark is wider than it is tall and would otherwise overhang the slot.
  return <MoyoMark width={28} accessibilityLabel="Moyo" />;
}
