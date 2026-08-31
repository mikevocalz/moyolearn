# Tutor Session — Responsive Specification
**Date:** 2026-08-31  
**Source of truth:** `docs/pack/23-tutorstage-handoff.md`, `docs/pack/22-embodied-tutor-avatar-spec.md`, `docs/pack/31-grade-voice-safety-incidents.md` (replaces doc 31 placeholder), `docs/pack/32-tutor-voice-tone.md`, `docs/pack/33-moyo-learn-prd.md`  
**Status:** Design accepted; implementation in progress.

---

## 1. Presence preference

### Type

```ts
type TutorPresencePreference =
  | 'auto'
  | 'visible'
  | 'compact'
  | 'audio-only';
```

`TutorView` (`visible` | `compact` | `hidden`) from the existing implementation is replaced by `TutorPresencePreference`. `hidden` is absorbed into `audio-only`; `audio-only` still renders captions, listening/speaking state, and the current learning step, but does not mount the 2D or 3D avatar.

### Behavior

| Preference | Meaning |
|---|---|
| `auto` | Resolve from grade band, screen size, device capability, reduced-motion preference, thermal state, and current task. |
| `visible` | Full 2D/3D tutor presence where space permits. |
| `compact` | Face/bust presence without consuming the learning canvas. |
| `audio-only` | Natalie voice + captions + state chips; no avatar renderer or face bus. |

### Auto resolution

Inputs, in priority order:

1. **Explicit learner preference** (per-device, persisted). Overrides auto.
2. **Reduced motion** → prefer `audio-only` for low-power/vestibular access; never `visible`.
3. **Thermal / power** → device demotes to `compact` then `audio-only` (doc 22 §6, `createTierWatcher`).
4. **Screen size**:
   - Phone <600dp → default `compact`.
   - Tablet/2-col ≥600dp → default `visible`.
   - Short or split viewport → `compact`.
5. **Grade band**:
   - K–2 → `visible` (voice-first, needs face).
   - 3–5 → `visible` unless screen is small.
   - 6–8 → `compact` default, learner may expand.
   - 9–12 → `compact` or `audio-only`, workspace-forward.
6. **Current task**:
   - Active canvas / writing / diagram → `compact` or `audio-only`.
   - Opening / hint / feedback → `visible`.

### Rules

- Natalie identity does not change mid-sentence. The swap to/from `visible` waits for the end of a spoken utterance (doc 22 §10.8, rule 1).
- 2D presence renders immediately. 3D upgrades only after a real first rendered frame (doc 22 §10.8).
- `audio-only` still uses the same `TutorAudioQueue` and `FaceBus` is bypassed; the `TutorStage` state chips and captions drive the experience.
- Preference is remembered per device, not per session.

## 2. Responsive layout

### Phone (<600dp)

- Single spine: `SessionToolbar` → `TutorStage` (flex-grow) → `Caption` → `Composer`.
- `TutorStage` takes remaining height; never a fixed height.
- `compact` avatar sits above the caption.
- `audio-only` replaces the avatar with a speaking/listening state chip and large caption.
- Sheets for history, attachments, source details, and session settings.

### Foldable / dual-screen

- Conversation + tutor presence on one region.
- Canvas / homework / diagram on the other.
- Critical controls not across the hinge.
- Collapses to phone layout when only one region is available.

### Tablet (≥600dp)

- Two-column: `380px` + `minmax(0, 1fr)`, `gap-group` (32).
- Left: presence + her turn (captions).
- Right: `LearningCanvas` (equation / whiteboard) + its input.
- Header spans both.
- Three-pane only when supplementary content (outline, uploaded work) is meaningful; never render empty panes.

### Web / desktop

- Same information architecture as native.
- Resizable workspace, readable conversation measure (≤65ch).
- Keyboard shortcuts:
  - `?` focus composer
  - `Space` (hold) push-to-talk
  - `Esc` interrupt speech
  - `c` toggle captions
  - `v` cycle tutor presence
  - `o` open capture
  - `q` end session
- Test at compact laptop, large monitor, 200% zoom, and text-resized browser.

## 3. State contract

`TutorStageState` is extended, not replaced:

```ts
export type TutorStageState =
  | { kind: 'presence' }
  | { kind: 'speaking'; utterance: Utterance }
  | { kind: 'thinking' }
  | { kind: 'hint'; step: HintStep }
  | { kind: 'listening' }
  | { kind: 'paused'; since: number }
  | { kind: 'ended'; summary: SessionSummary }
  | { kind: 'retry' }
  | { kind: 'crisis' };
```

`Utterance` includes `tone: ToneKey` from the closed palette in doc 32. The `TutorStage` reads `tone` to select the appropriate 2D mark and to pass to the 3D face bus. `audio-only` still renders the tone as a status chip and uses the caption text.

## 4. Accessibility

- Screen-reader order: back → title → captions toggle → caption → primary action → secondary action → composer → mic.
- Live regions for `listening`, `thinking`, `speaking`, `paused`, `ended`.
- Captions on by default; transcript available to all bands.
- Reduced motion is a render mode, not a style, and must pin the avatar while keeping speech mouth and minimal blink.

## 5. SOT Keywords

SOT-KEYWORDS: tutor responsive presence preference auto visible compact audio-only phone tablet foldable desktop reduced motion keyboard shortcuts
