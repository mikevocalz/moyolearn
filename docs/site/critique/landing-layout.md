# Design critique: landing page · layout collisions

**Reviewed:** built page at 1440×806, chapters 02 (Desk) and 04 (World/globe).
**Verdict:** the 15%-spatial-magic budget has been spent as *overlap without collision rules*. Objects escape their containers onto other objects' text. Every 🔴 below is legibility, not taste.

## 🔴 Critical — text falling over elements

| # | Where | Defect |
|---|---|---|
| C1 | Desk, cell 02 | The Shantell annotation "You're close. Look at this part again ↑" runs **straight through the "02 MASTERY" label**. Two different messages occupy the same pixels; neither can be read. |
| C2 | Desk, cell 02 | The `87%` numeral and the `moyoSun` mastery band **start at different x and overlap mid-glyph** — the band cuts the numeral instead of underlining or containing it. |
| C3 | World | The back-layer type `LEARNING HAS NO BORDERS` sits **behind the globe at the same value**, so it reads "LEARNIN … RDERS". Parallax back-type must never be occluded by the foreground subject at a similar tone. |
| C4 | World | The two node cards **overlap the globe and collide with each other**; the right card is **clipped by the viewport edge**. |
| C5 | World | The chapter headline "Wherever curiosity begins." is **cut off at the top by the sticky nav** — no scroll offset for the fixed header. |
| C6 | World | The globe is **cut off at the bottom** of the section; the composition has no reserved height for it. |

## 🟡 Moderate

| # | Where | Defect |
|---|---|---|
| M1 | World | Stray empty outlined boxes float at the left and right margins with no content — they read as broken elements, not as texture. |
| M2 | Desk, cell 01 | A large dead gap between the graph-paper plate and its caption; the cell reads as two unrelated pieces. |
| M3 | World | An empty outlined box at top-right is clipped by the nav. |

## The rule these all violate

Doc 08's law is that **hierarchy comes from size, weight and space** — overlap is not a hierarchy device. The brief's 15% spatial budget buys *depth* (an object in front of another object), never *collision* (an object on top of another object's text).

**Binding constraint for the fix:** no text may overlap other text or a filled shape it does not sit inside. An element may cross a container's edge only into whitespace. Back-layer type either clears the subject or drops enough in contrast to read unambiguously as texture — never lands in between, which is where it currently is.

## What works — keep it
- The globe itself: flat-shaded, ink-outlined, hard offset rings. It reads as a printed object, exactly as specced.
- The desk's numbered-cell rhythm (01 / 02 / 03) and the graph-paper plate.
- The paper ground, the ink, and the restraint in the palette.

## Status
🔴 C1–C6 open · 🟡 M1–M3 open.
