'use client';
// The staged photo, re-encoded small enough to send to the coach — web.
//
// Same contract as the native fork and for the same reason: the on-device
// recogniser's charset has no `÷` and no `×`, so the operators only survive as
// pixels. See `photograph-for-model.native.ts` for the full account, including
// why this is a fork at all (Turbopack cannot bundle expo-image-manipulator).
//
// A canvas rather than a library, because the browser is the library: decode,
// draw at the target width, read it back as JPEG. The whole job is four lines
// of DOM and the alternative is a dependency for them.
// SOT: packages/app/features/capture/photograph-for-model.native.ts
// SOT-KEYWORDS: capture photograph model image base64 resize vision coach ocr operators web
import type { TurnImage } from '@acme/inference';

/** The vendor's own downscale ceiling — see the native fork. */
const MODEL_IMAGE_MAX_WIDTH = 1568;
const MODEL_IMAGE_QUALITY = 0.7;

const DATA_URL_PREFIX = /^data:image\/jpeg;base64,/;

function decode(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // The picker hands back a blob: or data: URL from this same document, so
    // there is no cross-origin fetch here and nothing to taint the canvas —
    // which matters, because a tainted canvas throws on `toDataURL` rather
    // than returning anything to check.
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the browser could not decode the photo'));
    image.src = uri;
  });
}

/**
 * Null rather than a throw, matching the native fork: a photo the browser
 * cannot re-encode costs the model its look at the operators, never the child
 * their turn.
 */
export async function photographForModel(uri: string): Promise<TurnImage | null> {
  try {
    const image = await decode(uri);
    // Never enlarge. On native the capture path caps every photo at 1600px so
    // the case does not arise; on web the source is whatever the child picked
    // off their own disk, and a 400px screenshot scaled to 1568 is bytes spent
    // on interpolation.
    const scale = Math.min(1, MODEL_IMAGE_MAX_WIDTH / image.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const encoded = canvas.toDataURL('image/jpeg', MODEL_IMAGE_QUALITY);
    // `toDataURL` falls back to PNG when the format is unsupported, and a PNG
    // announced as a JPEG is a 400 from the vendor rather than a bad photo. So
    // the prefix is checked rather than assumed away with a `split(',')`.
    if (!DATA_URL_PREFIX.test(encoded)) return null;
    return { mediaType: 'image/jpeg', data: encoded.replace(DATA_URL_PREFIX, '') };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[photographForModel] could not encode %s:', uri, error);
    }
    return null;
  }
}
