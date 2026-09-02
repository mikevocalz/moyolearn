/**
 * The admin brand lockup — replaces Payload's own wordmark on the login screen
 * and in the nav (`admin.components.graphics`).
 *
 * It draws the real wordmark now. The previous version was markup hung on
 * `.moyo-lockup` / `.moyo-lockup__tile` / `.moyo-lockup__word`, and those three
 * classes are defined in no stylesheet in this repo — Payload's admin bundle
 * ships its own CSS and nothing here ever injected a rule for them, so the
 * lockup rendered as the bare characters "M" and "Moyo" in the admin's body
 * font. A brand that depends on a stylesheet nobody wrote is a brand that is
 * missing; the SVG carries its own colour and geometry and cannot fail that way.
 *
 * SOT: packages/ui/MoyoLearnLogo.tsx · apps/mobile/assets/images/icon.png
 * SOT-KEYWORDS: payload admin logo brand graphics lockup wordmark moyo
 */
import { MoyoLearnLogo } from '@acme/ui/brand';

export function Logo() {
  // 40px: Payload's login card sizes its own graphic at roughly this height, so
  // the mark neither shrinks into the card nor crowds the heading under it.
  return <MoyoLearnLogo height={40} accessibilityLabel="Moyo" />;
}
