'use client';
/**
 * Client-only gate for the 3D Natalie chapter 05 plate. Mirrors the globe's
 * tier gating so prerendered HTML still gets the static placeholder and only
 * capable browsers pay for the WebGL chunk.
 *
 * The live surface resolves Natalie approved baked voice, plays it on visitor
 * interaction, and falls back to captioned silent performance if the voice
 * service is unavailable or muted.
 *
 * SOT: apps/web-vite/src/components/chapters/tutor-room.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 *      packages/voice/src/baked.ts · apps/web/lib/voice-baked.ts
 *      apps/web/app/api/marketing/voice/baked/[piece]/route.ts
 *      apps/web-vite/src/stores/perf-store.ts
 * SOT-KEYWORDS: natalie surface web-vite client gate tier lazy draco tutor-room
 *               voice baked audio marketing demo
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { View } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { Button } from '@acme/ui';
import { usePerfStore, resolveTier } from '@/stores/perf-store';
import { PRESENCE_ACTIONS, type BakedAlignment } from './natalie-scene';

const NatalieScene = lazy(() => import('./natalie-scene'));

// The marketing site deploys on nitro with no /api routes of its own, so a
// relative fallback can only 500 there — default to the deployed Next app.
const VOICE_BASE =
  import.meta.env.VITE_MOYO_VOICE_BASE_URL ||
  'https://app.moyolearn.com/api/marketing/voice/baked';

/**
 * Bunny signs its URLs for an hour. Refresh at fifty minutes so a clip resolved
 * moments before a tap cannot expire part-way through playback.
 */
const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000;

/**
 * How long a resolve may hang before the surface performs the line silently.
 * The scene freezes its action clock while a resolve is pending (see
 * `voicePending` in natalie-scene.tsx), so an unbounded fetch would strand
 * Natalie mid-thought with every control disabled.
 */
const VOICE_RESOLVE_TIMEOUT_MS = 8000;

export interface VoiceClip {
  url: string;
  alignment?: BakedAlignment;
}

/** A resolved piece and the one player element that belongs to it. */
interface ReadyClip {
  readonly clip: VoiceClip;
  readonly audio: HTMLAudioElement;
  /** When the signed URL was issued, for the refresh window above. */
  readonly at: number;
}

function PlaceholderPlate() {
  return (
    <View className="moyo-tutor-room-plate-art" aria-hidden>
      <View className="moyo-tutor-room-plate-block--tall border-moyo-rule border-moyo-outline bg-moyo-earth">
        <View className="moyo-tutor-room-plate-aperture border-moyo-slab border-moyo-outline" />
      </View>
      <View className="border-moyo-rule border-moyo-outline bg-moyo-sun" />
      <View className="border-moyo-rule border-moyo-outline bg-moyo-leaf" />
    </View>
  );
}

/**
 * Voice-unavailable fallback: spread the caption's characters evenly across the
 * action duration so the mouth still performs the line instead of freezing.
 */
function captionAlignment(caption: string, duration: number): BakedAlignment {
  const characters = Array.from(caption);
  const per = duration / Math.max(1, characters.length);
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * per),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * per),
  };
}

/** Rewinds and starts a (possibly reused) player. `on*` assignments, not
 * addEventListener, so replays don't stack handlers. Lives outside the
 * component because the compiler forbids mutating ref-aliased values there.
 *
 * PLAYBACK STARTS NOW, DURATION ARRIVES WHEN IT ARRIVES. Waiting for
 * `loadedmetadata` before calling `play()` was safe only while every player was
 * preloaded whole; on the budget tier the element carries `preload='metadata'`
 * and a tap can land before that has finished. `play()` drives the load itself,
 * and `onReady` is reported again from `loadedmetadata` so the real duration
 * replaces the scripted fallback as soon as it is known. */
function startPlayer(
  audio: HTMLAudioElement,
  opts: {
    muted: boolean;
    onReady: (duration: number) => void;
    onEnded: () => void;
    onError: () => void;
  },
) {
  audio.muted = opts.muted;
  audio.onended = opts.onEnded;
  audio.onerror = opts.onError;
  audio.onloadedmetadata = () => opts.onReady(audio.duration || 0);
  audio.currentTime = 0;
  opts.onReady(audio.readyState >= 1 ? audio.duration || 0 : 0);
  if (!opts.muted) audio.play().catch(opts.onError);
}

async function resolveVoiceClip(piece: string): Promise<VoiceClip | null> {
  try {
    const response = await fetch(`${VOICE_BASE}/${piece}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(VOICE_RESOLVE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as VoiceClip | undefined;
    return data ?? null;
  } catch {
    return null;
  }
}

export function NatalieSurface() {
  const detect = usePerfStore((state) => state.detect);
  const tier = usePerfStore(resolveTier);
  const mounted = usePerfStore((state) => state.tier !== null);
  const [caption, setCaption] = useState('');
  const [action, setAction] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [alignment, setAlignment] = useState<BakedAlignment | null>(null);
  const [muted, setMuted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // One entry per piece — the signed URL, its alignment, and the single player
  // element that belongs to it — so a tap starts speech without paying a
  // resolve + CDN round-trip first. A URL map and a separate element map used
  // to be able to disagree; one map cannot.
  const clipCacheRef = useRef<Record<string, ReadyClip>>({});
  // In-flight resolves, keyed by piece. Preload and a tap ask for the same
  // piece at the same time; without this they each ran a resolve and each built
  // an `Audio`, and whichever landed second replaced the element the first was
  // already playing through.
  const inflightRef = useRef<Record<string, Promise<ReadyClip | null>>>({});

  useEffect(() => {
    detect();
  }, [detect]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  /*
    HOW MUCH OF THE CLIP TO BUFFER AHEAD. Tier A is the machine with headroom
    and takes the whole body. Tier B is the budget tier this gate exists to
    protect, and it takes metadata only: that is a few kilobytes rather than the
    whole MP3, and it still removes the resolve round-trip — the JSON, which is
    the part a tap was waiting on — from the moment of the tap.
  */
  const preloadMode: 'auto' | 'metadata' = tier === 'A' ? 'auto' : 'metadata';

  // Resolve a piece's signed URL and keep a buffered player for it.
  const ensureClip = useCallback(
    (piece: string): Promise<ReadyClip | null> => {
      const cached = clipCacheRef.current[piece];
      if (cached && Date.now() - cached.at <= SIGNED_URL_REFRESH_MS) {
        return Promise.resolve(cached);
      }

      const inflight = inflightRef.current[piece];
      if (inflight) return inflight;

      const pending = resolveVoiceClip(piece)
        .then((fresh): ReadyClip | null => {
          const current = clipCacheRef.current[piece] ?? null;
          // A refresh that lands while this piece is mid-play leaves it alone:
          // reassigning `src` on a playing element aborts the `play()` that is
          // already producing sound. The new URL is picked up on the next tap.
          if (current && !current.audio.paused) return current;
          if (!fresh?.url) return current;
          // One element per piece for the life of the surface. Reusing it
          // across refreshes is what keeps a second player from existing.
          const audio = current?.audio ?? new Audio();
          audio.preload = preloadMode;
          audio.src = fresh.url;
          const entry: ReadyClip = { clip: fresh, audio, at: Date.now() };
          clipCacheRef.current[piece] = entry;
          return entry;
        })
        .finally(() => {
          delete inflightRef.current[piece];
        });

      inflightRef.current[piece] = pending;
      return pending;
    },
    [preloadMode],
  );

  /*
    Preload every response so any tap is snappy, not just the first.

    TIER C IS EXCLUDED BECAUSE IT HAS NO TAP. The render below returns the
    static plate for tier C — no scene, no buttons — so a resolve there would
    spend a signed-URL request and an audio connection on a surface that cannot
    play anything. Hooks run before that early return, so the guard has to live
    here as well as in the markup.
  */
  useEffect(() => {
    if (!mounted || tier === 'C') return;
    for (const choice of Object.values(PRESENCE_ACTIONS)) {
      ensureClip(choice.voicePiece).catch(() => undefined);
    }
  }, [mounted, tier, ensureClip]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audioRef.current = null;
    setAudioDuration(null);
  }, []);

  const onActionComplete = useCallback(() => {
    stopAudio();
    if (action !== null) setAction(null);
  }, [action, stopAudio]);

  const startAction = useCallback(async (id: string) => {
    const choice = PRESENCE_ACTIONS[id];
    if (!choice) return;

    if (audioRef.current) {
      stopAudio();
      if (action !== null) setAction(null);
    }

    setVoiceStatus('loading');
    setAction(id);
    setCaption(choice.caption);
    setAudioDuration(null);
    setAlignment(null);

    /*
      The caption drives the line on its own: same words, same length, no
      player. Two different situations need it, and only one of them is a
      failure, so the label is not part of it.
    */
    const speakFromCaption = () => {
      setAudioDuration(choice.duration);
      audioRef.current = null;
      setAlignment(captionAlignment(choice.caption, choice.duration));
    };

    const speakSilently = () => {
      setVoiceStatus('error');
      speakFromCaption();
    };

    /*
      Muted is the situation that is not a failure, and handing the scene a
      muted player is how the line never ends. `startPlayer` skips `play()`
      when muted, so `currentTime` sits at zero, the completion branch in
      natalie-scene.tsx never sees the clock pass the duration, and the
      controls stay disabled until the visitor unmutes. Read it off the
      caption instead and the line runs its length in silence.
    */
    if (muted) {
      setVoiceStatus('idle');
      speakFromCaption();
      return;
    }

    const ready = await ensureClip(choice.voicePiece);
    if (!ready) {
      speakSilently();
      return;
    }

    setAlignment(ready.clip.alignment ?? null);

    // The player comes from the cache and nowhere else — constructing one here
    // as a fallback is how a second element for one piece got created.
    const audio = ready.audio;
    audioRef.current = audio;
    startPlayer(audio, {
      muted,
      onReady: (duration) => {
        setAudioDuration(duration || choice.duration);
        setVoiceStatus('idle');
      },
      onEnded: () => onActionComplete(),
      onError: speakSilently,
    });
  }, [action, muted, onActionComplete, stopAudio, ensureClip]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (!muted && audio.paused && audio.currentTime < audio.duration) {
      audio.play().catch(() => undefined);
    } else if (muted && !audio.paused) {
      audio.pause();
    }
  }, [muted]);

  if (!mounted || tier === 'C') return <PlaceholderPlate />;

  const isBusy = action !== null;

  return (
    <View className="moyo-tutor-room-plate-body" aria-hidden>
      <View className="moyo-tutor-room-plate-art moyo-tutor-room-plate-art--live">
        <Suspense fallback={<PlaceholderPlate />}>
          <NatalieScene
            action={action}
            audioDuration={audioDuration}
            alignment={alignment}
            audioRef={audioRef}
            voicePending={voiceStatus === 'loading'}
            reducedMotion={reducedMotion}
            onCaptionChange={setCaption}
            onActionComplete={onActionComplete}
          />
        </Suspense>
        {caption.length > 0 && (
          <View className="moyo-tutor-room-caption">
            <Text variant="caption" className="text-site-label text-moyo-ink">
              {caption}
            </Text>
          </View>
        )}
      </View>

      <View className="moyo-tutor-room-controls gap-group p-inset-tight">
        {Object.values(PRESENCE_ACTIONS).map((choice) => (
          <Button
            key={choice.id}
            title={choice.label}
            variant={action === choice.id ? 'primary' : 'outline'}
            size="sm"
            onPress={() => startAction(choice.id)}
            disabled={isBusy}
          />
        ))}
        <Button
          title={muted ? 'Unmute Natalie' : 'Mute Natalie'}
          variant="ghost"
          size="sm"
          onPress={() => setMuted((m) => !m)}
        />
        {voiceStatus === 'error' && (
          <Text variant="caption" className="text-site-label text-moyo-danger">
            voice unavailable
          </Text>
        )}
      </View>
    </View>
  );
}
