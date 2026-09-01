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

const VOICE_BASE =
  import.meta.env.VITE_MOYO_VOICE_BASE_URL ?? '/api/marketing/voice/baked';

export interface VoiceClip {
  url: string;
  alignmentUrl?: string;
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
  const alignmentCacheRef = useRef<Record<string, BakedAlignment>>({});

  useEffect(() => {
    detect();
  }, [detect]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Preload the first likely response so the first tap is snappy.
  useEffect(() => {
    if (muted || !mounted || tier === 'C') return;
    const hint = PRESENCE_ACTIONS.hint;
    if (!hint) return;
    resolveVoiceClip(hint.voicePiece)
      .then((clip) => {
        if (clip) urlCacheRef.current[hint.voicePiece] = { clip, at: Date.now() };
      })
      .catch(() => undefined);
  }, [mounted, tier, muted]);

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

    let cached = urlCacheRef.current[choice.voicePiece];
    // Bunny signed URLs are one-hour; refresh if older than 50 minutes.
    if (!cached || Date.now() - cached.at > 50 * 60 * 1000) {
      const fresh = await resolveVoiceClip(choice.voicePiece);
      if (fresh) {
        cached = { clip: fresh, at: Date.now() };
        urlCacheRef.current[choice.voicePiece] = cached;
      }
    }

    if (!cached || !cached.clip.url) {
      setVoiceStatus('error');
      setAudioDuration(choice.duration);
      return;
    }

    let pieceAlignment: BakedAlignment | null = alignmentCacheRef.current[choice.voicePiece] ?? null;
    if (!pieceAlignment && cached.clip.alignmentUrl) {
      try {
        const alignmentResponse = await fetch(cached.clip.alignmentUrl, { cache: 'no-store' });
        if (alignmentResponse.ok) {
          pieceAlignment = (await alignmentResponse.json()) as BakedAlignment;
          alignmentCacheRef.current[choice.voicePiece] = pieceAlignment;
        }
      } catch {
        pieceAlignment = null;
      }
    }
    setAlignment(pieceAlignment);

    const audio = new Audio(cached.clip.url);
    audioRef.current = audio;
    audio.muted = muted;
    audio.preload = 'auto';

    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration || choice.duration);
      setVoiceStatus('idle');
      if (!muted) audio.play().catch(() => setVoiceStatus('error'));
    });

    audio.addEventListener('ended', () => onActionComplete());

    audio.addEventListener('error', () => {
      setVoiceStatus('error');
      // If the audio fails, the visual action can still complete by its fallback duration.
      setAudioDuration(choice.duration);
    });
  }, [action, muted, onActionComplete, stopAudio]);

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
