/**
 * StageBoard screen-reader copy — one place, both forks.
 *
 * A drag is invisible to a screen reader unless every state change is spoken:
 * pick up, each pending position, the drop, the cancel (J §4's a11y note —
 * a drag-only board fails WCAG). Both forks feed these through one polite
 * live region; keeping the strings pure keeps the two platforms saying the
 * same thing.
 *
 * Positions are 1-based — "position 2 of 4" is how a person counts cards.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4
 * SOT-KEYWORDS: stage board announcements screen reader live region drag a11y
 */

export const pickedUpAnnouncement = (label: string, column: string) =>
  `${label} picked up from ${column}. Arrow keys move, Enter drops, Escape cancels.`;

export const overAnnouncement = (label: string, column: string, position: number, count: number) =>
  `${label}, ${column}, position ${position} of ${count}.`;

export const droppedAnnouncement = (label: string, column: string, position: number) =>
  `${label} moved to ${column}, position ${position}.`;

export const canceledAnnouncement = (label: string) =>
  `Move canceled. ${label} stays where it was.`;
