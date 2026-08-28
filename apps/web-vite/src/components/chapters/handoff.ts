/**
 * The chapter 04 → chapter 05 seam, in one file so it cannot drift.
 *
 * The two chapters are ONE move, not two sections stacked: chapter 04's pinned
 * timeline ends by growing a hard-edged cobalt circle past the viewport (the
 * Oryzo hand-off from `docs/site/mobbin/globe.md` — the next section arrives as
 * a reveal *through* the outgoing one), and the field it leaves behind is
 * literally chapter 05's ground. That only reads as continuous while both sides
 * agree on the same fill, so the fill is named once, here, and both import it.
 *
 * A `<Nav>`-style shared component was the alternative and it is the wrong
 * shape: the flood belongs to the pinned stage's stacking context and the ground
 * belongs to the next section's box. They are two elements. What they share is a
 * value, and a value is what this module exports.
 *
 * The ids are here for the same reason. `routes/index.tsx` composes the page and
 * the nav anchors into it (`site.nav.how` → chapter 03, and so on, from the copy
 * deck §1); an id spelled twice is an anchor that silently stops resolving.
 *
 * SOT: docs/site/mobbin/globe.md (Oryzo) · docs/site/tokens.md §5.1
 *      docs/site/copy-deck.md §5, §6
 * SOT-KEYWORDS: site chapters handoff cobalt flood ground chapter 04 05 world
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
