/**
 * A minimal, dependency-free RGBA8 PNG codec — doc 22 §8, §10.5.
 *
 * The golden gate needs to read a stored reference frame and write a diff
 * image, and this package deliberately has no image dependency. Adding one for
 * a format we only ever use in its simplest form (8-bit RGBA, no palette, no
 * interlace) would be a poor trade: `pngjs` and friends bring a dependency tree
 * into a package whose whole point is that it runs unchanged in Node, in CI and
 * on a device.
 *
 * WHERE THIS RUNS. **Host side only.** `deflate`/`inflate` come from
 * `node:zlib`, which exists in Node and does not exist in Hermes. That is not a
 * limitation to work around — it is the architecture: the device *captures*
 * raw RGBA and the host *compares* it (see `golden.ts`). Nothing on the device
 * path imports this file.
 *
 * DETERMINISM. Filter type 0 on every row and a fixed deflate level. A "smart"
 * per-row filter heuristic would make the bytes depend on the zlib build, and
 * these bytes are checked into the repo as goldens.
 *
 * SUPPORTED ON READ: 8-bit, colour type 6 (RGBA) and 2 (RGB), non-interlaced —
 * which is what this encoder emits and what every tool we use exports. Anything
 * else throws with the actual header values rather than returning something
 * plausible, because a golden that silently decodes wrong is worse than one
 * that fails to decode at all.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8, §10.5
 * SOT-KEYWORDS: png encode decode golden image codec zlib deterministic rgba
 */
import { deflateSync, inflateSync } from 'node:zlib';

export interface RgbaImage {
  width: number;
  height: number;
  /** Length `width * height * 4`, straight (non-premultiplied) alpha. */
  data: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; ++n) {
    let c = n;
    for (let k = 0; k < 8; ++k) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = -1;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`encodePng: expected ${expected} bytes for ${width}x${height}, got ${rgba.length}`);
  }
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; ++y) {
    raw[y * (stride + 1)] = 0; // filter: none, always
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Paeth predictor, straight from the PNG spec. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(png: Uint8Array): RgbaImage {
  for (let i = 0; i < SIGNATURE.length; ++i) {
    if (png[i] !== SIGNATURE[i]) throw new Error('decodePng: not a PNG');
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];

  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      png[offset + 4] as number,
      png[offset + 5] as number,
      png[offset + 6] as number,
      png[offset + 7] as number
    );
    const body = png.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const depth = png[offset + 16];
      const colourType = png[offset + 17];
      const interlace = png[offset + 20];
      if (depth !== 8 || (colourType !== 6 && colourType !== 2) || interlace !== 0) {
        // Say what it actually was — "unsupported PNG" sends the next person
        // to a hex editor.
        throw new Error(
          `decodePng: only 8-bit RGB/RGBA non-interlaced is supported ` +
            `(depth ${depth}, colourType ${colourType}, interlace ${interlace})`
        );
      }
      channels = colourType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (!width || !height) throw new Error('decodePng: no IHDR');
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat.map((b) => Buffer.from(b)))));

  const stride = width * channels;
  const lines = new Uint8Array(height * stride);
  for (let y = 0; y < height; ++y) {
    const filter = raw[y * (stride + 1)] as number;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; ++x) {
      const value = raw[src + x] as number;
      const a = x >= channels ? (lines[dst + x - channels] as number) : 0;
      const b = y > 0 ? (lines[dst - stride + x] as number) : 0;
      const c = x >= channels && y > 0 ? (lines[dst - stride + x - channels] as number) : 0;
      let out: number;
      switch (filter) {
        case 0:
          out = value;
          break;
        case 1:
          out = value + a;
          break;
        case 2:
          out = value + b;
          break;
        case 3:
          out = value + ((a + b) >> 1);
          break;
        case 4:
          out = value + paeth(a, b, c);
          break;
        default:
          throw new Error(`decodePng: unknown row filter ${filter} on row ${y}`);
      }
      lines[dst + x] = out & 0xff;
    }
  }

  if (channels === 4) return { width, height, data: lines };

  // Widen RGB to RGBA so callers only ever handle one layout.
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; ++i) {
    data[i * 4] = lines[i * 3] as number;
    data[i * 4 + 1] = lines[i * 3 + 1] as number;
    data[i * 4 + 2] = lines[i * 3 + 2] as number;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}
