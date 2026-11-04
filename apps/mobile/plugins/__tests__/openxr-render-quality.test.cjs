const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openxrRenderQualityFromEnv } = require('../openxr-render-quality');

test('no variables leaves the viro plugin options untouched', () => {
  assert.equal(openxrRenderQualityFromEnv({}), undefined);
  assert.equal(openxrRenderQualityFromEnv({ MOYO_OPENXR_EYE_BUFFER_SCALE: '' }), undefined);
});

test('maps every variable onto android.openxr', () => {
  assert.deepEqual(
    openxrRenderQualityFromEnv({
      MOYO_OPENXR_EYE_BUFFER_SCALE: '1.5',
      MOYO_OPENXR_FOVEATION: 'medium',
      MOYO_OPENXR_FOVEATION_DYNAMIC: 'false',
      MOYO_OPENXR_REFRESH_RATE: '90',
    }),
    { eyeBufferScale: 1.5, foveation: { level: 'medium', dynamic: false }, displayRefreshRate: 90 },
  );
  assert.deepEqual(openxrRenderQualityFromEnv({ MOYO_OPENXR_REFRESH_RATE: 'highest' }), { displayRefreshRate: 'highest' });
  assert.deepEqual(openxrRenderQualityFromEnv({ MOYO_OPENXR_FOVEATION: 'off' }), { foveation: { level: 'off' } });
});

test('malformed values throw instead of being dropped', () => {
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_EYE_BUFFER_SCALE: '4' }), /from 1 to 3/);
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_EYE_BUFFER_SCALE: 'big' }), /from 1 to 3/);
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_FOVEATION: 'max' }), /one of off, low, medium, high/);
  assert.throws(
    () => openxrRenderQualityFromEnv({ MOYO_OPENXR_FOVEATION: 'low', MOYO_OPENXR_FOVEATION_DYNAMIC: 'yes' }),
    /true or false/,
  );
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_FOVEATION_DYNAMIC: 'true' }), /needs MOYO_OPENXR_FOVEATION/);
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_REFRESH_RATE: '0' }), /at most 240/);
  assert.throws(() => openxrRenderQualityFromEnv({ MOYO_OPENXR_REFRESH_RATE: '300' }), /at most 240/);
});
