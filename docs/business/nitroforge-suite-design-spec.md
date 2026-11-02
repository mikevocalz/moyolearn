# NitroForge Studio — Shared Suite Experience & Design System (proposed)

SOT: `docs/business/moyo-studio-nitro-forge.md` owns the Moyo ↔ independent NitroForge architecture; this document owns the proposed reusable suite UI contract until moved to NitroForge's own repository.
SOT-KEYWORDS: nitroforge design system affinity mobbin suite docking snap rails adaptive responsive tailwind expo ui meta jetpack

**Status: researched architecture/design specification only — not a shipped editor.**
**Research date:** 2026-11-02
**Scope:** NitroForge is a standalone engine/UI SDK. The same UI implementations, not lookalike copies, are consumed by Moyo and may be used by NYC-MON, DVNT, Pa'Casa, Harlem Might and other apps.

## Intent and creative direction

**One product family, multiple disciplines.** Every NitroForge surface must look and behave like one suite while adapting controls to what the document actually contains: photo, vector, layout, text, spreadsheets, slides, PDF, video, audio. A recognizable and shareable workspace model is stronger than a separate full-screen application for every engine.

The 2025+ **unified Affinity** app is a strong *interaction/organization reference*, not a visual asset library or an interface to clone. Affinity publicly documents a studio switcher, context toolbar, customizable tools and panels, saved/transferable custom studios, non-destructive edits and object snapping. NitroForge must develop its own original trademarks, iconography, visual grammar, colors and brand composition. Avoid replicating Affinity's exact UI or trade dress.

Supporting visual references surfaced via **Mobbin screen search** on 2026-11-02 (links for human design review; do not redistribute screenshots or infer exact pixel measurements from thumbnails):

- [Framer editor reference](https://mobbin.com/screens/1edcc2ea-d2e4-41a8-97d3-b8b4feca2735)
- [Rive editor reference](https://mobbin.com/screens/0deb9a56-af1f-4697-a912-ff87f5ccd09f)
- [Canva editor reference](https://mobbin.com/screens/3f507e35-c583-41b5-afc0-c0422e00e068)
- [Adobe Express editor reference](https://mobbin.com/screens/64d24cec-61c2-4907-8d75-84fcbc4314ce)
- [Jitter animation editor reference](https://mobbin.com/screens/6c71f040-3f15-43ef-8faf-6e21442f898a)
- [Apple Freeform iOS reference](https://mobbin.com/screens/30867762-fa72-4721-9ad3-d2bae601e48d)

Affinity authoritative sources:
- https://www.affinity.studio/help/workspace-interface/
- https://www.affinity.studio/help/workspace-about-studios/
- https://www.affinity.studio/help/design-aids-snapping/
- https://www.affinity.studio/blog/affinity-essentials-lesson-8-custom-studios
- https://www.canva.com/newsroom/news/all-new-affinity/

## 1. NitroForge visual grammar — original product identity

**Neutral workstation, high-quality content preview.** The content is the hero, not the chrome. Provide a carefully tuned neutral graphite dark theme *and* an equally usable light theme. Use a single configurable product accent for active tool/selection/focus; never paint the entire shell with an app's brand colors. When embedded in Moyo, use Moyo's semantic tokens without replacing the structural anatomy. Avoid arbitrary glowing edges, heavy gradients, noisy permanent tooltips, inconsistent icon weights and rows of equally loud buttons.

Design choices:
- Clear typographic hierarchy: document name and save state, selected tool/context, property labels, technical metadata; accessibility and density options.
- One icon family, consistent active/disabled/hover/focus/pressed states and contextual labels; tooltips supplement, never replace accessible names.
- Distinct **tool**, **selection**, **document**, **workspace**, **sync** states; avoid conflating them.
- Deliberate visual rhythm: primary action, relevant contextual commands, and progressively disclosed advanced controls.
- Tokens (not hardcoded pixels/colors) for surface elevations, separators, outline/focus, hit areas, spacing, rail width, inspector min/max, tab height, canvas background and animation duration.
- No copied Affinity imagery, proprietary assets, icons, logos or exact layout artwork.

## 2. One workstation anatomy across all NitroForge editors

Core zones have stable *semantic roles* and shared components. Each discipline supplies a manifest of actions and panels; no unique app shell is invented per engine.

```text
┌────────────────────────────────────────────────────────────────┐
│ GLOBAL BAR: logo / project / document / state / share / export │
├────────────────────────────────────────────────────────────────┤
│ STUDIOS: Photo · Vector · Layout · Docs · Sheets · Slides ...   │
├──────┬────────────────────────────────────────────┬────────────┤
│ TOOL │       DOCUMENT / STAGE / CANVAS            │ INSPECTOR  │
│ RAIL │                                            │ DOCK       │
│      │  selection handles and context toolbar    │            │
│ NAV  │  document-specific content                 │ Properties │
│ DOCK │                                            │ Layers     │
│      │                                            │ History    │
├──────┴────────────────────────────────────────────┴────────────┤
│ BOTTOM DOCK: timeline / notes / formula / diagnostics (opt-in) │
├────────────────────────────────────────────────────────────────┤
│ STATUS: coordinates · zoom · page · selection · shortcuts     │
└────────────────────────────────────────────────────────────────┘
```

**Persistent suite components:**
- `ForgeWorkspace`: stable document/session host; retains canvas identity while panes change.
- `ForgeGlobalBar`: filename, file source, unsaved/online status, search/command palette, export and host-supplied collaboration affordance.
- `ForgeStudioSwitcher`: studio/persona workspace choice, separated from file type. Mode switching must not destroy the document or promise cross-engine format compatibility.
- `ForgeToolRail`: consistent position, icon family and selection state; manifests supply the actual tools.
- `ForgeContextBar`: selection/tool-specific controls; keyboard-accessible and optionally compact/floating.
- `ForgeDock`, `ForgePanelGroup`, `ForgeInspector`: same mounting/docking/collapse/resize mechanisms across all engines.
- `ForgeCanvasHost`: engine owns rendering/edit state, UI owns accessible chrome and overlays.
- `ForgeStatusBar`: zoom, selection metrics, save progress and modifier hints, reduces clutter elsewhere.
- `ForgeCommandPalette`: consistent command search, shortcut labels, disabled states, context-aware actions and undo.
- `ForgeWorkspacePresets`: save, restore, duplicate, rename, reset and share layout definitions with schema migrations.

## 3. Snap Rails: panel docking AND content snapping

**A. Magnetic panel docking** (the requested “snap rails”):
- Provide left, right and bottom dock zones. Top contextual toolbar can pin or float but cannot obscure native global navigation.
- Drag panel *headers* to a zone on desktop; show a visible, non-deceptive drop preview. Only commit geometry on release. Support tab-stacking, panel groups, collapsing to an icon strip, resizing, reordering, temporary floating panels (where the platform genuinely supports it) and restoring last layout.
- Give **keyboard and touch alternatives**: Move panel to Left/Right/Bottom, Pin/Unpin, Collapse, Move before/after, Reset Workstation. No drag-only requirements on iPad, Android tablet, browser mobile or assistive technology.
- Define valid snap targets from measured layout and pane constraints. Reject an impossible move instead of covering the canvas, breaking hinge safety or leaving an inaccessible close control.
- During drag, no heavy editing engine rerender. Movement preview via gesture/worklet or platform animation, then persist a normalized `WorkspaceLayoutV1` once committed.
- Persist per user/workspace/device layout configuration through the host-provided storage port. The SDK does not read a consumer's databases, identity or cloud tokens.

**B. Magnetic *document object* snapping** (different subsystem):
- Shared snapping interface: guides, margins, grid, object edges, centers, vertices, distances and rulers where the engine exposes a reliable geometric model.
- Temporary modifier override, configurable tolerance in UI-space, magnet target highlighting, precise numeric coordinate entry, contextual alignment commands, optional discrete haptic signal on native.
- Studios can declare `snapTargets` and presets (e.g. Pixel/Grid for Vector, Margins/Columns for Layout, Cell Boundaries for Sheets). No fake geometric snapping in incompatible document types.
- Object operations are revision-aware Rust engine commands, not only a visual JS transform; do not write temporary guides to the editable document or export unless intended.

## 4. Shared studio manifest with disciplined variations

| NitroForge editor | Main work area | Left dock | Context/Inspector | Optional bottom dock |
| --- | --- | --- | --- | --- |
| PixForge Photo | Raster image/artboard | tools, layer tree | adjustments, masks, blending, transform | history |
| PixForge Vector | vector artboard | shape/node tools, layer tree | stroke, fill, geometry | assets |
| PixForge Layout | pages/spreads | pages, master/layout assets | typography, grids, guides | preflight |
| QuillForge Docs | paginated text | outline, pages | styles, comments | revisions |
| GridForge Sheets | virtualized worksheet | sheet tabs/navigation | formula, formatting, validation | formula/audit |
| DeckForge Slides | slide canvas | slide thumbnails | layout, animation, object props | timeline/notes |
| FolioForge PDF | pages | pages/bookmarks | annotation, redaction and export permissions | comments |
| ReelForge Video | preview | media browser | selected clip/effect controls | timeline |
| BeatForge Audio | waveform/mixer | tracks/assets | selected track properties | multitrack timeline |

Same visual grammar does **not** mean one document format. Cross-engine asset transfer must be explicit, versioned and loss-aware; a PhotoCraft image is not automatically a WordCraft editable object, nor does switching modes imply that all engines can mutate one file.

## 5. Responsive/adaptive across mobile, tablet, desktop web and foldable

**Host owns global navigation.** NitroForge owns only the inner workspace. Do not hardcode a universal rail on the outside of every app. Moyo's existing native navigation rail / web header policy remains host-specific.

- **Wide desktop web:** stage-centric three-column workstation when measured space allows; independent left/right dock panels, contextual bar, optional bottom dock, keyboard/mouse, drag handles and resizable dividers.
- **Medium desktop & tablet web:** preserve center stage priority; collapse one dock to a tab rail, show the other contextually; avoid shrinking the document to unreadable width.
- **iPad / tablet native:** native Expo UI + SwiftUI/Compose-backed controls through `Host` and `RNHostView`; adapt with `AdaptivePanes`, finger/Pencil, keyboard and window resizing. Keep floating controls off the drawing path; restore the same workspace and selection after split-screen changes.
- **Phone native & phone-width web:** full primary editing area, short command rail/contextual toolbar, inspect via bottom sheet or accessible panel. No forced permanent desktop inspector or hover-only functionality.
- **Surface Duo/foldable:** use the *existing verified Moyo geometry contract* (Expo Modules 2 `ReservedRegions`, Android Jetpack WindowManager `FoldingFeature`, Apple reserved regions; Meta adaptive compatibility only after actual API verification). Respect all separating hinges and occlusions, including multiple folds. Book/tabletop can have different pane assignments, but document session identity is stable. Preserve the host's physical-right navigation contract.
- **XR:** do not pretend a 2D window and scene panel are equivalent. Expose input/render adapters; reuse shared semantic operations only for actually supported spatial layouts.

The app responds to **measured usable container regions, pointer capability, keyboard visibility and native posture**, not initial screen width or device name. Do not copy Moyo's product-specific numeric pane presets into unrelated surfaces; use named breakpoints and pane limits from shared tokens.

### Styling and native view policy

- Tailwind CSS v4 is the one design language. Moyo currently sources semantic tokens in `packages/theme/tokens.ts`; native uses `Uniwind`, while Next.js/web currently uses `react-native-css` through `packages/ui/tw.tsx`.
- The independent `@nitro-forge/native-ui` foundation owns token *contracts* and neutral class recipes; hosts supply their concrete theme adapters. Product-specific Moyo theme values must not leak into a standalone SDK.
- `@expo/ui` native containers are real SwiftUI/Compose primitives and may need supported modifiers/native props instead of web-only Tailwind CSS; match semantics, interaction and token intent rather than claiming pixel-identical native and web controls.
- Reuse and extract actual `@acme/ui` neutral `AdaptivePanes`, `InspectorSection`, `Toolbar`, `NativeSlot`, `FieldGroup`, `List` and related implementations through backwards-compatible PRs; do not clone them into a separate UI kit.
- Show accessible semantic document content on web, avoiding raw HTML in authored shared feature code. Editors may use necessary platform-native text input and canvas rendering inside well-defined adapters.

## 6. Suite consistency release gates

An editor integration cannot mark itself “design-ready” merely because it compiles. A visual/interaction test suite should verify:
1. Same global bar, switcher, rail, panel header, Inspector, command palette and save/export affordances across at least Photo, Vector, Docs, Sheets and Slides; variation only through reviewed manifests.
2. Drag dock left/right/bottom, stack panels, collapse, restore, keyboard/touch alternate actions, persistence across restart and versioned migration of layout JSON.
3. Object snap guides, undo/redo parity, transform accuracy and overlays that never corrupt exported content.
4. Windows desktop web, macOS browser, tablet-width browser, mobile browser, iPad window resizing/Pencil, Android tablet, Surface Duo hinge/book/tabletop/RTL. Real hardware evidence reported separately from unit simulations.
5. Text scaling, screen reader labels, keyboard shortcuts, focus management, right-to-left semantics, reduced motion, no chrome under hinges/notches/IME, no accessible controls hidden behind the stage.
6. Snapshot and interaction tests at different themes/density settings, no unreviewed color/spacing forks and no second local implementation of the same controls.
7. The engine's document/undo session outlives pane collapse, dock transitions, device rotation and web browser resize; freeze/visibility cannot leave GPU loops running into stale surfaces.
8. Performance budget measured from physical-device/real-browser traces before labeling a viewport or editor buttery smooth; tune dirty-tile render, worklets and redraw only when supported by measurements.

## 7. First implementation deliverable

**Start with one complete reusable `ForgeWorkspace` and `ForgeDock` system** in the **independent NitroForge repo**, using extracted/shared native components from Moyo. Prototype with the admitted PixForge/PhotoCraft engine, but the shell must render correctly with simple engine-agnostic fixtures before linking GPU pipelines.

Initial end-to-end reference: open a photo document -> switch Photo/Vector tools when verified -> dock Layers left, Transform right -> snap an object to a guide -> save a named workspace preset -> resize desktop-to-tablet/compact -> preserve document/selection/layout intent -> undo/redo -> reopen editable document -> export to business-authorized storage.

Until that acceptance test passes, do not claim the reusable rail, inspector, editing UI or automatic ArtCraft sync is shipped.

**Ownership:** NitroForge maintains reusable suite components and UI contracts; the Moyo repository consumes released packages with a thin Moyo-themed adapter. A standalone NitroForge repository does not yet exist in the connected GitHub account, so this draft documents the plan in Moyo only and must be ported into NitroForge when provisioned.
