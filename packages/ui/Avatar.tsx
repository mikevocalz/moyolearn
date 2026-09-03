// Avatar — a person's picture, or their initials while there isn't one.
// SOT: this file · packages/theme/tokens.ts
// SOT-KEYWORDS: avatar initials identity picture fallback well

import { tv, type VariantProps } from './tv';
import { SolitoImage } from 'solito/image';
import { View, Text } from './primitives';

const avatar = tv({
  slots: {
    /*
      A NEUTRAL WELL, not an accent chip. This was `bg-burgundy-200` /
      `text-burgundy-800` — raw primitives (banned) resolving to a pale yellow,
      which made every avatar a brand mark. On the K–2 hub that put a third
      yellow beside the Snap tile and the rail's selected marker, and it was the
      weakest of the three: an accent spent on the one element that carries no
      action and no state.

      What this box actually is, is the frame around a photo. When the photo is
      missing the frame should still read as a photo slot, so it takes the
      sunken paper the rest of the kit uses for a recess. Identity colour, where
      a surface wants it, is added OUTSIDE by the caller — AvatarSheet already
      rings this component in the door's accent.
    */
    root: 'relative items-center justify-center overflow-hidden rounded-md border-2 border-border bg-surface-sunken',
    initials: 'font-semibold text-text',
  },
  variants: {
    size: {
      sm: { root: 'h-8 w-8', initials: 'text-xs' },
      md: { root: 'h-11 w-11', initials: 'text-sm' },
      lg: { root: 'h-16 w-16', initials: 'text-xl' },
      xl: { root: 'h-24 w-24', initials: 'text-3xl' },
    },
  },
  defaultVariants: { size: 'md' },
});

export interface AvatarProps extends VariantProps<typeof avatar> {
  name: string;
  imageUri?: string;
  className?: string;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export function Avatar({ name, imageUri, size, className }: AvatarProps) {
  const { root, initials } = avatar({ size });
  return (
    <View className={root({ className })} aria-label={name}>
      {imageUri ? (
        <SolitoImage
          src={imageUri}
          alt={name}
          fill
          unoptimized
          contentFit="cover"
          sizes="64px"
        />
      ) : (
        <Text className={initials()}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}
