'use client';
import { useEffect } from 'react';
import { Modal } from 'react-native';
import { SolitoImage } from 'solito/image';
import { useInstanceStore, useStore } from './use-instance-store';
import { Pressable, Text, View } from './primitives';

export interface LightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex = 0, open, onClose }: LightboxProps) {
  const store = useInstanceStore<{ index: number }>(() => ({ index: initialIndex }));
  const index = useStore(store, (s) => s.index);
  const setIndex = (updater: (i: number) => number) =>
    store.setState((s) => ({ index: updater(s.index) }));

  // Re-sync when reopened on a different image — initialIndex is otherwise
  // only read at mount.
  useEffect(() => {
    if (open) store.setState({ index: initialIndex });
  }, [open, initialIndex, store]);

  const count = images.length;

  // Keyboard navigation (web): ← → move, Escape closes. Native uses the
  // on-screen arrows and the Modal back handler.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') store.setState((s) => ({ index: Math.max(0, s.index - 1) }));
      else if (e.key === 'ArrowRight') store.setState((s) => ({ index: Math.min(count - 1, s.index + 1) }));
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, count, onClose, store]);

  if (!images.length) return null;
  const current = images[index] ?? '';
  const hasMultiple = images.length > 1;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950/95">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close image"
          className="absolute right-4 top-4 z-10 rounded-md bg-ink-800/80 p-2 active:opacity-70"
        >
          <Text className="text-xl leading-none text-ink-50">×</Text>
        </Pressable>

        {hasMultiple ? (
          <Pressable
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            accessibilityLabel="Previous image"
            className="absolute bottom-0 left-0 top-0 z-10 w-16 justify-center pl-4 active:opacity-70"
          >
            <Text className={`text-3xl leading-none ${index === 0 ? 'text-ink-700' : 'text-ink-50'}`}>‹</Text>
          </Pressable>
        ) : null}

        <SolitoImage src={current} alt="" fill unoptimized contentFit="contain" sizes="100vw" />

        {/* Pagination, in the brand's own yellow.
            Dots rather than "2 of 4": a child counting pages should not have to
            read a number, and four is few enough that the dots ARE the count.
            `bg-primary` is the semantic token — the palette calls this scale
            `gold` and it is electric yellow, which is exactly why feature code
            must never name the primitive.
            Tappable, because arrows at the screen edge are an adult's gesture:
            a small hand holding a phone two-handed cannot reach them. */}
        {hasMultiple ? (
          <View className="absolute inset-x-0 bottom-0 z-10 flex-row items-center justify-center gap-element pb-inset">
            {images.map((image, i) => (
              <Pressable
                key={image}
                onPress={() => store.setState({ index: i })}
                aria-label={`Image ${i + 1} of ${count}`}
                className="min-h-target-adult min-w-target-adult items-center justify-center"
              >
                <View
                  className={`h-2 rounded-full transition-all duration-fast motion-reduce:transition-none ${
                    i === index ? 'w-6 bg-primary' : 'w-2 bg-ink-50/40'
                  }`}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {hasMultiple ? (
          <Pressable
            onPress={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
            disabled={index === images.length - 1}
            accessibilityLabel="Next image"
            className="absolute bottom-0 right-0 top-0 z-10 w-16 items-end justify-center pr-4 active:opacity-70"
          >
            <Text className={`text-3xl leading-none ${index === images.length - 1 ? 'text-ink-700' : 'text-ink-50'}`}>›</Text>
          </Pressable>
        ) : null}

        {hasMultiple ? (
          <View className="absolute inset-x-0 bottom-8 flex-row justify-center gap-element">
            {images.map((_, i) => (
              <View
                key={i}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-ember-400' : 'bg-ink-500'}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
