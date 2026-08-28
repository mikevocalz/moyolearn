# Mobbin pass: globe

Chapter 4 of the Moyo marketing site. Target moves: interactive globe / map data-viz sections; pinned scroll storytelling; nodes that open cards; and how a section hands off to the next by **transforming** rather than stacking.

**Structure only.** Ignore every colour ramp below — several of these encode data in a single purple hue, which is both a hard-avoid and bad data practice; take the geometry only.

## Adopted

| App | Link | Structural move adopted |
| --- | --- | --- |
| Zipline | [section](https://mobbin.com/sites/sections/36469115-cc4f-4511-bfe2-5ba65b31f0ec) | The map and a three-row stat column share one panel with the numbers on the left and the geography on the right, then a four-up outcome strip sits outside the panel below — scale first, then geography, then consequence. |
| Braintrust | [section](https://mobbin.com/sites/sections/fdf2bafd-508b-4546-8054-282043a71e0c) | Region labels are lifted above the map and connected down to their territory by long thin leader lines, so no label ever sits on top of the landmass and the map stays readable at every width. |
| Dub | [section](https://mobbin.com/sites/sections/c9831c1e-e14f-4ba8-9f87-c9bafeaddf2b) | A card is floated over the centre of the globe carrying the explanation and the only CTA — the globe becomes a backdrop and the card is the actual interactive object, which keeps the section from being a toy with no exit. |
| Visitors | [section](https://mobbin.com/sites/sections/487e372c-a833-46ec-b112-e9ddc1dacd3f) | The globe is cropped by the bottom of the viewport so only its upper arc shows, with the headline stack above it — treating the globe as a horizon rather than a centred ball buys enormous vertical room for type. |
| Phantom Studios | [section](https://mobbin.com/sites/sections/43468821-60e3-4252-8232-d026a30a8f3c) | Density is drawn as a continuous field over a plain outline map and only three places get a name label with a small marker — the field carries the volume, the sparse labels carry the meaning, and the two never compete. |
| Klarna | [section](https://mobbin.com/sites/sections/b8f5cf82-321d-4067-9e21-138351e4c1f3) | The map lives inside a contained panel with the headline and the qualifying sentence set outside and above it, so the map reads as a figure with a caption rather than as decoration bleeding across the page. |
| Customer.io | [section](https://mobbin.com/sites/sections/17152284-d6b6-4791-8c55-551a45ed795b) | Countries themselves are the data mark — the territory is filled instead of pinned — which scales to hundreds of data points without the pin-collision problem a marker map has. |
| Oryzo | [section](https://mobbin.com/sites/sections/02dd8a32-d483-44a5-81a5-4f402689df5e) | The following section arrives as a hard-edged circular mask expanding over the current one from the right — the handoff is a reveal *through* the outgoing section rather than the next block stacking under it. |
| Aurora | [section](https://mobbin.com/sites/sections/67805fd8-a745-4bd0-a9c4-f27f2b3730c7) | Small photo tiles are scattered at varying distances around a centred headline and read as converging on it — the section resolves inward to one sentence instead of ending at a CTA row. |
| Structured | [section](https://mobbin.com/sites/sections/f92aa671-52d4-4eaf-bd14-4cc96f6d6bff) | A single full-bleed illustrated world with one thin vertical rule drawn into it marking position — a scroll-progress indicator drawn *inside* the artwork, not chromed on the page edge. |
| Passionfroot | [section](https://mobbin.com/sites/sections/f55e16c9-655b-41da-8866-236c790ab119) | A story advances as a horizontal track with explicit prev/next arrows top-right and dot pagination centred below — the sequence is driven by controls the reader can see, so vertical page scroll is never captured. |
| GSAP | [section](https://mobbin.com/sites/sections/f99b2d7e-d39b-49c7-a862-180f6d06ca30) | Capability rows are separated by full-width rules with the graphic locked left and the text locked right, so a long list of features reads as an index with a stable rhythm rather than a stack of cards. |

## Notes on keeping normal page scroll working

The honest finding: **Mobbin sections are static captures, so scroll behaviour is not observable from this pass.** What *is* observable is which layouts structurally require scroll capture and which do not:

- Zipline, Braintrust, Klarna, Customer.io and Phantom Studios are all static one-screen figures — they need no scroll interception at all, and a hover-to-reveal node card would sit on top of them without touching the scroll axis. This is the safest family for Moyo.
- Passionfroot shows the alternative to hijacking: the horizontal story is advanced by visible arrow and dot controls, which means the section can be skipped by a reader who just keeps scrolling.
- Structured's in-artwork progress rule is the pattern to copy if we do pin the globe: the reader gets a visible read of how much of the pinned section remains, which is the single thing that makes a pinned section tolerable.

## Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| Webflow | [section](https://mobbin.com/sites/sections/070a1bd7-e485-487e-88d4-fda163f5375b) | Parallax demo built on a pastel mock storefront with a floating editor panel | Fake product chrome pretending to be the story, and the parallax is demonstrating itself rather than moving an argument forward — motion with nothing underneath it. |
| GSAP | [section](https://mobbin.com/sites/sections/f99b2d7e-d39b-49c7-a862-180f6d06ca30) | Soft multi-stop gradient blobs used as the graphic for each row | Adopted the row geometry, refused the marks: blob decoration and gradient fills are both explicit hard-avoids, and a blob conveys nothing about the item it labels. |
| KODE Immersive | [section](https://mobbin.com/sites/sections/d2552c1b-4584-44c1-99d7-d73071d0edb0) | Full-bleed justified display type running edge to edge underneath the fixed navigation | The type collides with the nav labels and becomes unreadable at the top of the block; scale is not an excuse for a collision, and this fails immediately for anyone with low vision. |
| Readymag | [section](https://mobbin.com/sites/sections/0b354b7f-7a2d-4754-baf9-78693a26790b) | — | Not a design pattern at all; the index returned a support-forum thread about scrolling text. Recorded here so the null result is visible rather than silently dropped. |
| Customer.io | [section](https://mobbin.com/sites/sections/52f3bc49-60b8-4ba8-8a09-c5fe40301b13) | Single-hue light-to-dark ramp as the only encoding on a choropleth | Adopted the fill-the-territory idea, refused this encoding: a one-hue ramp with no legend and no value labels is unreadable for anyone with reduced contrast sensitivity and is decorative rather than informative. |

## Queries used

- `search_sections`: "interactive 3D globe or world map section with location pins showing where customers or data points are"
- `search_sections`: "sticky pinned scroll storytelling section where a visual stays fixed while text panels advance beside it"

**MCP note:** the pinned-scroll query drifted badly — it returned marketing pages *about* scroll animation (Webflow, GSAP) rather than pages *using* pinned scroll, because a static screenshot of a pinned section is indistinguishable from a normal one. Node-opens-a-card interactions are likewise invisible to this index; Dub's centred card is the closest returned analogue and the rest of that behaviour has no reference here.
