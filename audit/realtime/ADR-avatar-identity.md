# ADR — Avatar identity: what Natalie is allowed to be, and what must be true before 3D mounts
Status: **PROPOSED — not approved. 3D must not mount in the app until Mike accepts this file.**
Date: 2026-09-03 · Author: layout/tutor-stage pass · Decider: Mike

<!--
What it is: the gate doc 22 §7 and the Prompt-4 §5 rule demand — a written
decision about the avatar's identity, its safety boundary, and the engineering
preconditions for replacing the 2D presence with a rendered body.
Why it exists: mounting a 3D tutor in front of a child is not a rendering
change. It changes who the child thinks they are talking to, and doc 07's
companionship firewall governs the body as much as the words.
SOT: docs/pack/22-embodied-tutor-avatar-spec.md §3 §6 §7 §8 ·
     docs/pack/23-tutorstage-handoff.md §3.1 §7 ·
     packages/avatar/src/tutor-stage.ts · packages/avatar/src/safety/gesture-gate.ts
SOT-KEYWORDS: adr avatar identity natalie 3d mount gate companionship firewall
              presence 2d webgpu runtime absent web r3f humano
-->

## Context

### What exists today
- `TutorStage` (the kit component) draws a **2D presence mark**. On device that
  is `TutorAvatar` → `Avatar`, a static mark. It is a designed terminal state,
  not a loading state (doc 23 §3.1).
- `packages/avatar` holds the ported renderer work: the tier policy
  (`src/tiers.ts`), the handoff controller (`src/tutor-stage.ts`), the face bus,
  the idle engine, the node materials, `src/stage.ts`, and
  `src/safety/gesture-gate.ts`.
- The **only** running 3D Natalie in this workspace is on the marketing site:
  `apps/web-vite/src/components/chapters/natalie-scene.tsx` +
  `natalie-surface.tsx` — r3f + drei + Draco over
  `apps/web-vite/public/models/humano-marketing.glb` (12.5 MB), with ARKit
  morphs, the shared `IdleEngine`, and baked-alignment lip sync.

### The hard constraint, verified
**There is no native 3D runtime in this workspace.** `react-native-webgpu` /
`react-native-wgpu` appear in no `package.json` in the repo (root, every
`packages/*`, every `apps/*`). `three`, `@react-three/fiber` and
`@react-three/drei` exist **only** in `apps/web-vite`; `apps/web` — the Solito
web target that actually mounts `@acme/app` screens — has none of them.

Therefore:
- **3D Natalie cannot mount in the React Native app today.** Not "is not wired" —
  the runtime doc 22 §3 selects is not installed. Anything claiming otherwise on
  the Duo would be a 2D mark with a 3D label on it.
- **3D Natalie is achievable on `apps/web`** via r3f, at the cost of adding
  three + fiber + drei to that app and serving the GLB and the Draco decoder
  from a CDN behind the capability manager (doc 22 §3 rule 2: zero avatar bytes
  in the binary; the web equivalent is zero avatar bytes in the initial chunk).
- On mobile the presence degrades to the existing 2D `TutorPresence`, which
  already has revealed and collapsed forms and is what ships today at every
  width.

## Decision (proposed)

**Natalie has one identity and one continuous mark.** The 2D presence, the tab
icon and any future rendered body are the *same character at different
fidelities*. A learner never meets two Natalies, and fidelity is never named to
the child — there is no "HD tutor", no upgrade prompt, no quality setting on her.

**Her body is bound by the companionship firewall, not just her words**
(doc 22 §7). The permitted gesture vocabulary is attention, never attachment: no
simulated affection, no reaching toward the camera, no leaning-in intimacy, no
eye contact held past a conversational norm, no idle that reads as sulking or
waiting. `safety/gesture-gate.ts` stays in the loop for every frame of authored
or generated motion, and it is a gate, not a filter — output it does not
recognise does not play.

**She holds no learner PII.** Nothing identifying is textured, labelled or
logged on the stage.

**Reduced motion is a render mode, not a fallback.** She renders with motion
damped; the mouth and the blink are never scaled, in either mode.

**No paywall, price or upgrade prompt renders on the stage. Ever.**

## Preconditions for mounting 3D (all of them, not a subset)

1. **Mike accepts this file.** Prompt 4 §5. Until then the 2D mark is the tutor.
2. **`tutor-stage.ts` rules 1–4 hold at the mount site**, and they already
   encode the behaviour: 2D on the first frame always; the swap waits for the
   end of an utterance; demotion is immediate, unconditional and permanent for
   the session; a download failure is "2D, and we stopped trying", never an
   error state at a child. `shouldRender3D()` is the only thing that may start
   the renderer, and `firstFrameRendered()` — a real frame, not "the renderer
   initialised" — is the only thing that may end the 2D presence.
3. **A SINGLE MOUNT SITE for her body, at every width.** This is a new
   precondition and it comes out of the layout work that produced this file. Her
   body renders today in exactly one place — the head of the conversation spine,
   inside `TutorPresence`'s `Freeze` — and that is the property to *protect*, not
   to achieve. A trailing presence column was prototyped and deliberately not
   shipped, and the reason is written here: placing her in one of two branches
   makes crossing that breakpoint a React **remount**, which throws away the
   stage controller, the face bus and the viseme cursor mid-session. It costs
   nothing while she is a static mark and is fatal to a live renderer. If a
   presence column is ever wanted, it must be one instance whose *container*
   changes (one tree, className-driven) or a portal target — never a second
   branch. `packages/theme/tokens.ts` already carries `pane-tutor-stage` as the
   sized slot that column would take.
4. **The gesture gate is wired to the live track**, not just present in the
   package, and its rejected-output path is tested.
5. **Golden images per shipping tier, including reduced motion** (doc 22 §8),
   with the diff in the PR. Silent `--update` is the failure this harness exists
   to prevent.
6. **Zero avatar bytes in the binary / initial chunk**, assets content-addressed
   behind the capability manager, integrity checked (doc 22 §3, §6).

## Options considered

| Option | What it means | Verdict |
|---|---|---|
| **A — 2D everywhere, now** | Ship the presence mark on mobile and web; no renderer mounts. | **What is shipped today.** Safe, honest, and the only option that is true on the Duo. |
| **B — 3D on `apps/web` behind this ADR** | Add three + r3f + drei to `apps/web`, reuse `natalie-scene.tsx`'s driver, CDN-serve the GLB and Draco, and mount her into the existing single presence slot at `regular` width only. | **Recommended, after approval.** It is the only surface where the runtime exists. Costs: a real dependency addition, a 12.5 MB asset that must not enter the initial chunk, and precondition 3. |
| **C — 3D on mobile** | Adopt `react-native-webgpu` + three `0.185.1`. | **Not available.** The package is not installed and doc 22 §9 budgets this as a rewrite of six shader-injection sites, not an integration. Not a demo-week decision. |
| **D — video/sprite loop as "3D"** | Play a rendered clip in the presence slot. | **Rejected.** It is not her — no gaze, no speech coupling, no reduced-motion mode — and doc 23 §3.1's whole point is that the 2D mark must look finished rather than like a stand-in for something better. |

## Recommendation

**Adopt A now and B next**, in that order, with mounting gated on Mike's
acceptance of this file **and** on precondition 3 being closed first. The
sequencing matters: precondition 3 is a layout refactor with no visual output,
so it is the cheapest thing to do while nobody is watching, and it is the
expensive thing to discover once a renderer is live.

**Explicitly not approved by writing this:** nothing here authorises mounting a
renderer. The demo path is the 2D presence, and doc 29 §8's demo rules are the
reason.

## Consequences

- Easier: the 2D path is already the terminal state for `presence-2d`, so
  "3D never arrives" is a supported outcome rather than a degradation.
- Harder: the presence slot holds a static mark, which looks thin next to the
  marketing site's Natalie. That is the honest state and the gap is the argument
  for B.
- Follow-ups if B is accepted: (1) close precondition 3; (2) add the r3f deps to
  `apps/web` only; (3) move the GLB + Draco decoder behind the capability
  manager; (4) golden set for the web tier; (5) wire the gesture gate to the
  live track.
