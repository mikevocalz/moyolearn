/**
 * The admin brand lockup — replaces Payload's own wordmark on the login screen
 * and in the nav (`admin.components.graphics`).
 *
 * Plain markup rather than an SVG asset: every colour is a Payload theme
 * variable, so one component serves light and dark with no second file and no
 * `prefers-color-scheme` branch. It is the same tile-plus-wordmark lockup the
 * marketing header uses, so signing in does not feel like leaving the product.
 * SOT: apps/web/components/site/SiteHeader.tsx (the lockup this mirrors)
 * SOT-KEYWORDS: payload admin logo brand graphics lockup wordmark moyo
 */
export function Logo() {
  return (
    <span className="moyo-lockup" aria-label="Moyo">
      <span aria-hidden className="moyo-lockup__tile">M</span>
      <span className="moyo-lockup__word">Moyo</span>
    </span>
  );
}
