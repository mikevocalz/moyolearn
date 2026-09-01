import type { PickCamera } from './pick-camera.types.ts';

/**
 * Web in-session camera capture.
 *
 * `capture="environment"` asks the browser for the rear camera. The input is
 * detached and clicked programmatically, matching the `pick-note-image.web.ts`
 * pattern.
 */
export const pickCamera: PickCamera = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';

  return new Promise((resolve) => {
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        if (file === undefined) {
          resolve(null);
          return;
        }

        const uri = URL.createObjectURL(file);
        const probe = document.createElement('img');
        probe.addEventListener(
          'load',
          () => resolve({ uri, width: probe.naturalWidth, height: probe.naturalHeight }),
          { once: true },
        );
        probe.addEventListener(
          'error',
          () => {
            URL.revokeObjectURL(uri);
            resolve(null);
          },
          { once: true },
        );
        probe.src = uri;
      },
      { once: true },
    );
    input.click();
  });
};
