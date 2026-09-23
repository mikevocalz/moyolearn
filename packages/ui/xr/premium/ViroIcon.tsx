// ViroIcon.tsx — panel icons that actually render on the PICO.
//
// v1 used an SDF atlas + a custom surface shaderModifier. On-device the glyphs
// came out INVISIBLE (the modifier read diffuse_color before the atlas was
// sampled → alpha 0). v2 drops all of that for the one path proven to render in
// this scene: <ViroImage> with a pre-tinted transparent PNG — the same
// component that draws the Pokémon artwork. Tint is baked per-PNG (white/amber/
// muted) since ViroImage has no tintColor; the caller picks one by state.
'use client'
import { ViroImage } from '@reactvision/react-viro'
import { ICON_PNG, type IconName, type IconTint } from './icon-atlas/icons'

export type { IconName, IconTint }

/** Map the panel's semantic colours onto the three baked PNG tints. */
export type ViroIconColor = 'white' | 'amber' | 'muted' | 'ink' | 'steel' | 'red'
const TINT: Record<ViroIconColor, IconTint> = {
  white: 'white',
  amber: 'amber',
  muted: 'muted',
  ink: 'muted', // no dark PNG baked; muted reads on light chips
  steel: 'muted',
  red: 'amber',
}

export interface ViroIconProps {
  name: IconName
  /** Edge length in metres (square). Default 0.08. */
  size?: number
  color?: ViroIconColor
  position?: [number, number, number]
  opacity?: number
}

/** A single flat icon (transparent PNG on a ViroImage). Pair with a hit quad. */
export function ViroIcon({ name, size = 0.08, color = 'white', position, opacity = 1 }: ViroIconProps) {
  return (
    <ViroImage
      source={ICON_PNG[name][TINT[color]]}
      width={size}
      height={size}
      position={position}
      opacity={opacity}
      resizeMode="ScaleToFit"
      imageClipMode="None"
      mipmap
      ignoreEventHandling
    />
  )
}
