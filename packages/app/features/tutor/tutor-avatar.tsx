'use client';
// TutorAvatar — the embodied Natalie presence.
//
// This is the 2D->3D handoff point, and BOTH sides of it are now real: the 2D
// mark from frame 1, and — on native, behind ADR-111's flag — the WebGPU stage
// that replaces it once it has drawn a face of its own.
//
// The promotion is not this component's judgement. `createTutorStage` owns it
// (doc 22 §10.8): 2D is up immediately, the upgrade begins in the background,
// the swap happens only on a REAL first rendered frame and never mid-utterance,
// and any failure settles to 2D permanently for the session. So the flag only
// decides which TIER the controller is built with; every rule about what a
// child sees stays in one tested state machine rather than in a component.
//
// THE FLAG IS OFF UNLESS `EXPO_PUBLIC_NATIVE_3D=1`. ADR-111's committed default
// is off, and a binary that predates `react-native-webgpu` must never reach the
// renderer module at all — hence the `lazy` import, which is also why the web
// build resolves `./tutor-avatar-3d` to a stub that pulls in no three.js.
// SOT: packages/avatar/src/tutor-stage.ts · packages/app/features/tutor/tutor-audio.ts
//      docs/decisions/adr-111-native-3d-runtime.md · ./tutor-avatar-3d.native.tsx
// SOT-KEYWORDS: tutor avatar presence 2d 3d handoff face bus speech driver viseme webgpu flag

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Avatar, isTutorRevealed } from '@acme/ui';
import type { ResolvedTutorPresence } from '@acme/ui';
import {
  createFaceBus,
  createTutorStage,
  directEncoder,
  shouldRender3D,
  type FaceBus,
  type SpeechDriver,
  type StageState,
  type TutorStage,
} from '@acme/avatar';
import { audioQueue } from './tutor-audio';
import { toneRenderFor, type ToneKey } from './tutor-tone';

export interface TutorAvatarProps {
  /** Already resolved by the screen — `auto` has no avatar size to draw. */
  tutorPresence: ResolvedTutorPresence;
  isSpeaking: boolean;
  tone?: ToneKey | null;
}

const speechDriver: SpeechDriver = {
  sampleSpeech: (nowMs) => audioQueue.sampleSpeech(nowMs),
  sampleGesture: () => null,
  speak: async () => {},
  stop: () => {},
  now: () => audioQueue.now(),
  scheduledOnsetAt: 0,
};

/**
 * ADR-111's committed default is OFF, and this is the whole switch.
 *
 * `Platform.OS` is checked as well as the env var because the env var is a
 * build input shared with the web bundle, and the renderer only exists on a
 * native binary that was prebuilt with `react-native-webgpu` in it.
 */
const NATIVE_3D =
  Platform.OS !== 'web' && process.env.EXPO_PUBLIC_NATIVE_3D === '1';

/**
 * Lazy, and that is load-bearing rather than tidy: importing the module
 * installs `react-native-webgpu`'s JSI bindings and assigns `navigator.gpu` as
 * a side effect. Behind `lazy` + the flag, a learner on the 2D path never
 * evaluates it — and a JS-only reload on a binary that predates the native
 * module cannot crash on an import it never reaches.
 */
const TutorAvatar3D = lazy(async () => {
  const module = await import('./tutor-avatar-3d');
  return { default: module.TutorAvatar3D };
});

/**
 * Her FLOOR height when 3D is on stage, in dp — the `xl` 2D mark's band.
 *
 * A floor, not a size: paired with `flex: 1` below it means "take the column if
 * the layout gives you one, else this". The spine gives none and resolves to
 * 260; the pane composition gives a full-height alcove and she takes it.
 */
const STAGE_HEIGHT = 260;

export function TutorAvatar({ tutorPresence, isSpeaking, tone }: TutorAvatarProps) {
  const stageRef = useRef<TutorStage | null>(null);
  const faceBusRef = useRef<FaceBus | null>(null);

  /*
    THE FACE LOOP RUNS ONLY WHILE THE FACE IS ON SCREEN.

    The three effects below ran unconditionally, so a learner on voice-only —
    where this component returns `null` — was still paying for a stage
    controller, a face bus, and a 60fps requestAnimationFrame loop driving a
    mouth that was never drawn. So was a learner who had collapsed her.

    `react-freeze` does NOT fix this, and it is worth stating plainly because
    the assumption is easy to make: freezing suspends RE-RENDERS of the subtree,
    it does not unmount it, so `useEffect` cleanups do not run and a timer or a
    rAF loop inside a frozen tree keeps going. Measured on device — with the
    subtree frozen, the face bus was still sampling the audio clock ~130 times a
    second. Freeze is the right tool for keeping her mounted and cheap to bring
    back; it is not a pause button for imperative loops. Those have to stop
    themselves, which is what this flag does.

    That cuts the other way too, and it is the reason the arrangement is safe:
    if freezing cannot stop a loop, it certainly cannot stop speech. Nothing
    about hiding Natalie can reach the audio queue.
  */
  const embodied = isTutorRevealed(tutorPresence);

  /*
    The controller's own state, mirrored into React because it is what decides
    WHICH surface is drawn below. `onChange` is the ONLY writer — the initial
    value is deliberately not seeded from `stage.state()`, because a null here
    and the controller's own opening state say the same thing (2D, nothing
    else yet) and seeding it would be a setState in an effect body for no
    change in what is drawn.
  */
  const [stageState, setStageState] = useState<StageState | null>(null);

  /*
    Keep the controller stable for the session.

    The tier is the ONE thing the flag changes. `presence-2d` short-circuits
    every upgrade path inside the controller, so with the flag off this file
    behaves exactly as it did before — the 3D branches below are unreachable,
    not merely unused. `phone` is the opening 3D tier; the capability manager
    demotes from there once it has measured (doc 22 §4 row 17).
  */
  useEffect(() => {
    if (!embodied || stageRef.current !== null) return;
    const stage = createTutorStage({
      tier: NATIVE_3D ? 'phone' : 'presence-2d',
      onChange: (next) => setStageState(next),
    });
    stageRef.current = stage;
    faceBusRef.current = createFaceBus({
      speech: speechDriver,
      encoder: directEncoder(['jawOpen']),
    });
    /*
      The body is bundled with the app on the dev path, so there is nothing to
      download and the controller can go straight to `warming` — which is what
      mounts the canvas below. When the demo build resolves her through the CDN
      capability manager instead, `setProgress` goes between these two calls.
    */
    if (NATIVE_3D) {
      const now = performance.now();
      stage.beginUpgrade(now);
      stage.assetsReady(now);
    }
  }, [embodied]);

  useEffect(() => {
    stageRef.current?.setSpeaking(isSpeaking);
    faceBusRef.current?.setConversationCues({ partnerSpeaking: isSpeaking });
    if (tone) {
      const { emotion, intensity } = toneRenderFor(tone);
      faceBusRef.current?.setEmotion(emotion, intensity);
    }
  }, [isSpeaking, tone]);

  /*
    Keyed on `embodied` so the loop is torn down and rebuilt by the same pass
    that builds the controllers it ticks. Effects run in declaration order, so
    the refs above are already populated when this first runs.
  */
  useEffect(() => {
    if (!embodied) return;
    const stage = stageRef.current;
    const faceBus = faceBusRef.current;
    if (!stage || !faceBus) return;
    let raf: number;
    const tick = () => {
      stage.tick(performance.now());
      faceBus.step(0.016);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [embodied]);

  /*
    The 3D stage's three inputs from this side of the handoff.

    `sampleMouth` READS the audio queue and nothing else — the same sampler the
    face bus uses, reduced to the one weight a mouth needs. It cannot start,
    stop or seek audio, which is the property that lets the renderer live
    inside a `Freeze` next to a live voice session.
  */
  const sampleMouth = useCallback((nowMs: number) => {
    const sample = audioQueue.sampleSpeech(nowMs);
    return sample.active ? (sample.shape.jawOpen ?? 0) : 0;
  }, []);

  /* The controller decides WHEN this becomes a swap; this only reports it. */
  const onFirstFrame = useCallback(() => {
    stageRef.current?.firstFrameRendered(performance.now());
  }, []);

  /*
    Any failure is "2D, and we stopped trying" — never an error at a child
    (doc 22 §10.8). `settle` is irreversible for the session by design: a
    renderer that failed once on this device will fail again, and retrying it
    mid-lesson would put a child through the same black frame twice.
  */
  const onUnavailable = useCallback((reason: string) => {
    if (__DEV__) console.warn('[TutorAvatar] 3D unavailable:', reason);
    stageRef.current?.settle('context-lost');
  }, []);

  /*
    Nothing at all when she is not revealed, and that is not a loss of presence.

    `TutorPresence` draws her static mark on the rail in `compact` and draws no
    mark in `audio-only` (the responsive spec's definition of the mode). What
    this component owns is the LIVE face — the tier controller, the face bus,
    the viseme-driven mouth — and none of that has a job while the face is not
    on screen. Rendering an `md` avatar here as well would put her mark on the
    screen twice while she is collapsed.
  */
  if (!embodied) return null;

  /*
    2D UNTIL THE CONTROLLER SAYS OTHERWISE, and the canvas is mounted BEFORE it
    says so on purpose: a stage cannot report a first rendered frame it was
    never given the chance to draw. So while `warming`/`pending-swap`, both are
    mounted and the 3D one is transparent behind the mark. The swap is then a
    cross-fade of two things already on screen rather than a mount.
  */
  const render3D = NATIVE_3D && stageState !== null && shouldRender3D(stageState);
  const live3D = stageState?.surface === 'avatar-3d';

  if (!render3D) return <Avatar name="Natalie" size="xl" />;

  return (
    <View style={{ width: '100%', flex: 1, minHeight: STAGE_HEIGHT }}>
      <View
        style={{ position: 'absolute', inset: 0, opacity: live3D ? 1 : 0 }}
        // Hidden from a screen reader until she is the one on stage; while she
        // is warming the 2D mark above is the thing that is actually there.
        aria-hidden={!live3D}
        pointerEvents="none">
        {/* No fallback: the 2D mark below IS the fallback, and it is already up. */}
        <Suspense fallback={null}>
          <TutorAvatar3D
            active={embodied}
            isSpeaking={isSpeaking}
            sampleMouth={sampleMouth}
            onFirstFrame={onFirstFrame}
            onUnavailable={onUnavailable}
          />
        </Suspense>
      </View>
      {live3D ? null : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name="Natalie" size="xl" />
        </View>
      )}
    </View>
  );
}
