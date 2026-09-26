# Rive-framed Quickdraw board — unified XR panel

Branch: `feat/rive-quickdraw-panel` off `main` (`df99af6`).
Spec: `MOYO_QUICKDRAW_REACT_RIVE_XR_PANEL_PROMPT_V3_2026-09-26.md`.
Status: composition layer + binding + probe integration landed; **physical
device evidence is still pending** (Quest is behind a physical sensor-lock +
PIN; PICO untested). Do not claim acceptance from this document alone.

## Architecture

```text
carrier ViroNode  ← the dragged object; persisted offset in the store
  └─ slot ViroNode  ← worldSlot('center') pose as a carrier-local child
      ├─ ViroRivePanel   BoardChrome artboard (probes/rive-panel/rive-board-chrome)
      │                  frame + toolbar + palette; its own native input maps
      │                  rays to artboard listeners via panelWorld
      └─ ViroNode @ contentCentre
          └─ XrBoardLive boardLive quad — the live Quickdraw texture, visible
             through the chrome's transparent window (boardLayer.raster 0.5mm)
XrBoardSurface     WORLD-anchored sibling (Viro reports hits in world space);
                   covers ONLY the content rect — the geometric arbitration:
                   paper rays draw, toolbar rays reach the chrome, grip rays drag
grip ViroQuad      amber bar, dragTransform="parent" — carrier child at world pose
```

One `contentRect` (`board-chrome-layout.ts`) drives quad placement, input
plane, UV mapping and the Rive window. Zustand only — `initialScene` is
constructor-captured, so all shared state rides `xrLayoutProbe` (probe) and
`useXrSession` (tutor) module stores; no `useState` for shared XR state.

## Reused / modified / new

| Capability | Component | Change |
| --- | --- | --- |
| live board texture | `BoardTextureHost`, `XrBoardLive` | reused unchanged — `XrBoardLive` is nested under the content rect |
| pointer → ink | `XrBoardSurface`, `BoardPointer`, `xrDragPlane/Local/Hit` | extended: optional `anchor`/`area` props for the content rect; worldSlot default unchanged |
| panel drag | `dragTransform="parent"` + `getTransformAsync` persist | reused — carrier node + grip pattern from the Rive probe |
| Rive runtime | `ViroRivePanel`, `useCanvasInViroInput` (`panelWorld`) | reused unchanged — `worldMatrix([carrier, slot])` feeds input mapping |
| board doc authority | `WhiteboardBoard` (Quickdraw) | extended: `onHistory` prop → engine `store.listenHistory` on both forks (native via `W.history` in the pointer shim, web direct) |
| shared state | `xrLayoutProbe` store, `useXrSession` | extended: `canUndo`/`canRedo`/`hasMarks`/`paletteOpen`/`clearArmed`, `boardHistory` on the session store |
| control vocabulary | `board-controls.ts`, `Whiteboard.tsx` TOOLS/INKS | reused — Rive chrome mirrors the same three tools and seven inks |
| chrome → app | `board-chrome-commands.ts` (`command`/`commandSeq`) | NEW — one channel; listeners write, JS observes `commandSeq` and decodes |
| geometry SOT | `board-chrome-layout.ts` | NEW — artboard units ↔ panel metres, `contentAnchorWorld` |
| composition | `RiveBoardPanel` (`apps/mobile/src/native-3d`) | NEW — carrier + chrome + live quad + surface + grip |
| bind | `board-chrome-bind.ts` | NEW — `bindBoardChrome(runtime, handlers)` mirrors `bindRiveSelection` |
| chrome artboard | `probes/rive-panel/rive-board-chrome/` | NEW sibling Rive project; icons converted from Lucide sources (`tooling/rive-icons/convert.mjs`) |

Fallback: `chromeFailed` latches on `onError`/missing asset → the scene keeps
the media-panel + `XrBoardTray` composition; `boardOffset` is shared so a drag
pose survives the swap.

## What the commands decode to

`command`: 1 pen, 2 highlighter, 3 eraser, 4 togglePalette, 5 undo, 6 redo,
7 clear (two-step: first press arms `clearArmed`, second commits), 8 ask
Natalie, 10+i ink i, 17 closePalette. `commandSeq` is the edge detector.
Malformed values decode to `none` — a dead button, never a wrong action.

## Tests

- `board-chrome-layout.test.ts` — artboard↔panel mapping, Y-flip, band tiling,
  world anchor under carrier translate/yaw, toolbar coverage — 5 tests
- `board-chrome-commands.test.ts` — every verb, all seven inks, malformed
  values → none — 4 tests
- Existing: `board-pointer`, `surface-drag`, `world-slot`, `raster-coverage`
  keep passing (225 ui tests total; 111 app tests)

## Rollback

`git revert` the feature commits on `feat/rive-quickdraw-panel`, or set
`chromeFailed`/`chromeBytes=null` — the probe renders the previous stack.
`onHistory` is additive and safe to keep; `XrBoardSurface` defaults are
unchanged.

## Remaining gates (not done here)

- Quest device pass: chrome visible both eyes, live board both eyes, tools,
  undo/redo, palette, drag without draw-through, off-edge stroke, recenter,
  background/resume, repeated enter/exit, Ask Natalie + voice
- PICO equivalent pass — explicitly not claimed from Quest
- Tutor-room integration of `RiveBoardPanel` (probe proves it first)
- The `moyo_board_chrome.riv` asset: authored in `probes/rive-panel/
  rive-board-chrome/`; keep the shipped bytes in sync with `build/`
