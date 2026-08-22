/**
 * Turns the face bus's named ARKit weights into the head's expression vector.
 *
 * There are two containers in play and they want different work, which is why
 * this is an interface rather than a function:
 *
 *   AUTHORING container (`gnm_head_web.bin`, 383 components) — the 19 named
 *   weights go through the 19x383 ARKit matrix, every frame.
 *
 *   RUNTIME container (the rebake, doc 22 §6.3) — `arkit-map.json` has already
 *   been folded into the expression basis, so `meta.expressionNames` IS the
 *   ARKit name list and the encoder is a name->index write. The matrix multiply
 *   that used to run on every speech frame does not exist any more.
 *
 * Picking the wrong one is silent and awful: run the matrix against a rebaked
 * container and you get a 19-long vector of garbage; write direct into an
 * authoring container and 19 of 383 components move at random. So the choice is
 * made once, from the container's own metadata, by `encoderForContainer`.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6.3
 * SOT-KEYWORDS: expression encoder arkit map direct matrix rebake container names
 */
import { ArkitMapper, type ArkitMap, type Shape } from './track.ts';

export interface ExpressionEncoder {
  /** Length of the vector this encoder writes — the head's expressionDim. */
  readonly dim: number;
  /** Named weights in, expression vector out. Allocation-free after the first call. */
  encode(shape: Shape): Float32Array;
}

/**
 * The rebaked path: `expressionNames` are ARKit channel names, so a weight is
 * written straight to its own slot. Names the head does not carry are ignored
 * rather than throwing — a face bus that emits one unknown channel should lose
 * that channel, not the whole frame.
 */
export function directEncoder(expressionNames: readonly string[]): ExpressionEncoder {
  const index = new Map<string, number>();
  expressionNames.forEach((name, i) => index.set(name, i));
  const out = new Float32Array(expressionNames.length);
  return {
    dim: expressionNames.length,
    encode(shape: Shape): Float32Array {
      out.fill(0);
      for (const name in shape) {
        const i = index.get(name);
        if (i === undefined) continue;
        out[i] = shape[name] as number;
      }
      return out;
    },
  };
}

/** The authoring path: the original 19xN matrix, unchanged. */
export function matrixEncoder(map: ArkitMap): ExpressionEncoder {
  const mapper = new ArkitMapper(map);
  return {
    dim: mapper.dim,
    encode: (shape) => mapper.map(shape),
  };
}

/** Minimal shape of the head metadata this decision needs. */
export interface EncoderContainerMeta {
  expressionDim: number;
  expressionNames: string[];
  bake?: { arkitChannels?: number } | undefined;
}

/**
 * Chooses from the container itself, so no caller has to remember which asset
 * it loaded. A rebaked container is identifiable two ways — it carries a `bake`
 * block, and its expression names are the ARKit names — and both are checked,
 * because a hand-built container could carry one without the other.
 */
export function encoderForContainer(
  meta: EncoderContainerMeta,
  authoringMap?: ArkitMap
): ExpressionEncoder {
  const rebaked =
    meta.bake?.arkitChannels === meta.expressionDim &&
    meta.expressionNames.length === meta.expressionDim;
  if (rebaked) return directEncoder(meta.expressionNames);
  if (!authoringMap) {
    throw new Error(
      `head container has ${meta.expressionDim} expression components and no ` +
        'bake block, so it is an authoring container — it needs arkit-map.json. ' +
        'Either pass the map or ship the rebaked container (doc 22 §6.3).'
    );
  }
  if (authoringMap.coeffs[0]?.length !== meta.expressionDim) {
    throw new Error(
      `arkit-map.json is ${authoringMap.coeffs[0]?.length ?? 0} wide but the head ` +
        `container has ${meta.expressionDim} expression components — mismatched bakes`
    );
  }
  return matrixEncoder(authoringMap);
}
