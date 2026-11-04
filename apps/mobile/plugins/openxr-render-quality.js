// Build-time OpenXR render quality for the 2026-10 device pass, read from the
// environment so each Baseline/Candidate cell can set it without editing
// app.config.ts.
//
//   MOYO_OPENXR_EYE_BUFFER_SCALE   number, 1..3          -> openxr.eyeBufferScale
//   MOYO_OPENXR_FOVEATION          off|low|medium|high  -> openxr.foveation.level
//   MOYO_OPENXR_FOVEATION_DYNAMIC  true|false            -> openxr.foveation.dynamic
//   MOYO_OPENXR_REFRESH_RATE       highest|<Hz 1..240>   -> openxr.displayRefreshRate
//
// The result goes under `android.openxr` in @reactvision/react-viro's plugin
// options. Only viro 3.0.3-moyo.1 and later read it (viro commits 8a8a9d2c and
// 3299e4ea, `plugins/util/openxrRenderQuality.ts`); they write
// com.viro.openxr.* manifest meta-data that ViroViewOpenXR reads when the
// session starts. With no variable set this returns undefined and the plugin
// options stay exactly as before, so a Baseline build is unchanged and a
// Candidate build uses the plugin's defaults (scale 1.3, foveation low,
// dynamic, no refresh-rate request).
//
// A malformed value throws here, before prebuild, instead of being dropped: a
// device cell built with a silently ignored setting is a void run.
// SOT: apps/mobile/app.config.ts · plugins/__tests__/openxr-render-quality.test.cjs
// SOT-KEYWORDS: openxr render quality eye buffer scale foveation refresh rate env device validation

const LEVELS = ['off', 'low', 'medium', 'high'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {undefined | {
 *   eyeBufferScale?: number,
 *   foveation?: { level: 'off' | 'low' | 'medium' | 'high', dynamic?: boolean },
 *   displayRefreshRate?: 'highest' | number,
 * }}
 */
function openxrRenderQualityFromEnv(env) {
  const scaleRaw = env.MOYO_OPENXR_EYE_BUFFER_SCALE;
  const levelRaw = env.MOYO_OPENXR_FOVEATION;
  const dynamicRaw = env.MOYO_OPENXR_FOVEATION_DYNAMIC;
  const rateRaw = env.MOYO_OPENXR_REFRESH_RATE;
  if ([scaleRaw, levelRaw, dynamicRaw, rateRaw].every((v) => v === undefined || v === '')) return undefined;

  const out = {};
  if (scaleRaw !== undefined && scaleRaw !== '') {
    const scale = Number(scaleRaw);
    if (!Number.isFinite(scale) || scale < 1 || scale > 3) {
      throw new RangeError(`MOYO_OPENXR_EYE_BUFFER_SCALE must be a number from 1 to 3, got ${scaleRaw}`);
    }
    out.eyeBufferScale = scale;
  }
  if (dynamicRaw !== undefined && dynamicRaw !== '' && (levelRaw === undefined || levelRaw === '')) {
    throw new TypeError('MOYO_OPENXR_FOVEATION_DYNAMIC needs MOYO_OPENXR_FOVEATION');
  }
  if (levelRaw !== undefined && levelRaw !== '') {
    if (!LEVELS.includes(levelRaw)) {
      throw new RangeError(`MOYO_OPENXR_FOVEATION must be one of ${LEVELS.join(', ')}, got ${levelRaw}`);
    }
    const foveation = { level: levelRaw };
    if (dynamicRaw !== undefined && dynamicRaw !== '') {
      if (dynamicRaw !== 'true' && dynamicRaw !== 'false') {
        throw new TypeError(`MOYO_OPENXR_FOVEATION_DYNAMIC must be true or false, got ${dynamicRaw}`);
      }
      foveation.dynamic = dynamicRaw === 'true';
    }
    out.foveation = foveation;
  }
  if (rateRaw !== undefined && rateRaw !== '') {
    if (rateRaw === 'highest') {
      out.displayRefreshRate = 'highest';
    } else {
      const hz = Number(rateRaw);
      if (!Number.isFinite(hz) || hz <= 0 || hz > 240) {
        throw new RangeError(`MOYO_OPENXR_REFRESH_RATE must be "highest" or Hz above 0 and at most 240, got ${rateRaw}`);
      }
      out.displayRefreshRate = hz;
    }
  }
  return out;
}

module.exports = { openxrRenderQualityFromEnv };
