/**
 * The chapter 04 → chapter 05 seam, in one file so it cannot drift.
 *
 * Chapter 04 ends on paper and chapter 05 opens on cobalt, and the seam only
 * reads as one move while both sides agree on the fill — so the fill is named
 * once, here, and imported rather than spelled twice.
 *
 * THE FLOOD DISC IS GONE. This module used to serve a second consumer: chapter
 * 04's pinned stage grew a hard-edged cobalt circle past the viewport on the way
 * out (the Oryzo hand-off from `docs/site/mobbin/globe.md`). That move needs a
 * viewport-height crop to land in, and the crop is what cut the globe in half,
 * clipped a node card off the right edge and buried the chapter's own display
 * line behind the figure. The pin went with the defects; see `world.tsx`. What
 * survives is the value, which is the only part the seam actually needed —
 * `HANDOFF_GROUND_CLASS` now has exactly one consumer, chapter 05's band.
 *
 * The ids are here for the same reason. `routes/index.tsx` composes the page and
 * the nav anchors into it (`site.nav.how` → chapter 03, and so on, from the copy
 * deck §1); an id spelled twice is an anchor that silently stops resolving.
 *
 * SOT: docs/site/tokens.md §5.1 · docs/site/copy-deck.md §5, §6
 *      ./world.tsx (why the Oryzo flood is not built)
 * SOT-KEYWORDS: site chapters handoff cobalt ground chapter 04 05 world
 *               tutor room seam anchor ids web-vite
 */

/** Anchor target for chapter 04, and the ScrollTrigger's trigger element. */
export const WORLD_CHAPTER_ID = 'chapter-04';

/** Anchor target for chapter 05. */
export const TUTOR_ROOM_CHAPTER_ID = 'chapter-05';

/**
 * The cobalt field. `moyoPrimary` is the token the globe chapter has already
 * fixed publicly as the oceans (docs/site/tokens.md §5.1), which is exactly why
 * the flood works: the reader watches the largest colour area on the page rise
 * off the globe and become the room Natalie is standing in.
 *
 * Anything printed on it takes `text-moyo-on-primary` — 7.42:1, measured in
 * `SITE_PAIRS`. `moyoInk` on cobalt is 2.21:1 and is forbidden.
 */
export const HANDOFF_GROUND_CLASS = 'bg-moyo-primary';

/** The one foreground the cobalt ground accepts. */
export const HANDOFF_ON_GROUND_CLASS = 'text-moyo-on-primary';
