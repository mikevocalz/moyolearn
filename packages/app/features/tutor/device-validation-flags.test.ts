import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceValidationFlags, initialDeviceValidationFlags } from './device-validation-flags.ts';

test('both switches default to off', () => {
  assert.deepEqual(initialDeviceValidationFlags({}), { nativeBoard: false, nativeRive: false });
});

test('a build variable of 1 or true turns a switch on; anything else leaves it off', () => {
  assert.deepEqual(
    initialDeviceValidationFlags({ EXPO_PUBLIC_MOYO_NATIVE_BOARD: '1', EXPO_PUBLIC_MOYO_NATIVE_RIVE: 'true' }),
    { nativeBoard: true, nativeRive: true },
  );
  assert.deepEqual(
    initialDeviceValidationFlags({ EXPO_PUBLIC_MOYO_NATIVE_BOARD: 'yes', EXPO_PUBLIC_MOYO_NATIVE_RIVE: '0' }),
    { nativeBoard: false, nativeRive: false },
  );
});

test('the process store starts off when the variables are unset', () => {
  assert.equal(process.env.EXPO_PUBLIC_MOYO_NATIVE_BOARD, undefined);
  assert.deepEqual(deviceValidationFlags.getState(), { nativeBoard: false, nativeRive: false });
});
