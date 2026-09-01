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

export interface VoiceClip {
  url: string;
  alignment?: BakedAlignment;
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
 * component because the compiler forbids mutating ref-aliased values there. */
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
  const begin = () => {
    audio.currentTime = 0;
    opts.onReady(audio.duration || 0);
    if (!opts.muted) audio.play().catch(opts.onError);
  };
  if (audio.readyState >= 1) begin();
  else audio.onloadedmetadata = begin;
}

async function resolveVoiceClip(piece: string): Promise<VoiceClip | null> {
  try {
    const response = await fetch(`${VOICE_BASE}/${piece}`, { cache: 'no-store' });
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
  const urlCacheRef = useRef<Record<string, { clip: VoiceClip; at: number }>>({});
  // Pre-buffered players, one per piece, so a tap starts speech immediately
  // instead of paying a resolve + CDN round-trip first.
  const audioCacheRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    detect();
  }, [detect]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Resolve a piece's signed URL and keep a buffered player for it.
  // Bunny signed URLs are one-hour; refresh if older than 50 minutes.
  const ensureClip = useCallback(async (piece: string) => {
    let cached = urlCacheRef.current[piece];
    if (!cached || Date.now() - cached.at > 50 * 60 * 1000) {
      const fresh = await resolveVoiceClip(piece);
      if (fresh?.url) {
        cached = { clip: fresh, at: Date.now() };
        urlCacheRef.current[piece] = cached;
        const audio = new Audio(fresh.url);
        audio.preload = 'auto';
        audioCacheRef.current[piece] = audio;
      }
    }
    return cached ?? null;
  }, []);

  // Preload every response so any tap is snappy, not just the first.
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

    const speakSilently = () => {
      setVoiceStatus('error');
      setAudioDuration(choice.duration);
      audioRef.current = null;
      setAlignment(captionAlignment(choice.caption, choice.duration));
    };

    const cached = await ensureClip(choice.voicePiece);
    if (!cached) {
      speakSilently();
      return;
    }

    setAlignment(cached.clip.alignment ?? null);

    const audio = audioCacheRef.current[choice.voicePiece] ?? new Audio(cached.clip.url);
    audioCacheRef.current[choice.voicePiece] = audio;
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
