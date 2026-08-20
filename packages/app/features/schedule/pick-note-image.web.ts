import type { PickNoteImage } from './pick-note-image.types.ts';

/**
 * The browser's own file dialog, filtered to images.
 *
 * expo-image-picker is a native module with no web build — importing it drags
 * untranspiled React Native source into the Next graph — so the input is built
 * here, the same way `pick-file.web` does it. It is DETACHED rather than
 * rendered into the editor: a hidden input in the tree has to be visually
 * removed without becoming unreachable to a keyboard, and the toolbar's image
 * button is already the affordance.
 *
 * The browser reports no dimensions on a `File`, but the caller needs them up
 * front (see pick-note-image.types.ts), so the object URL is decoded once by an
 * off-document <img> and its NATURAL size — the intrinsic pixels, not any laid
 * out size — is what gets returned.
 *
 * `cancel` is what settles a dismissed dialog; without it the promise would
 * hang forever on the (common) case of the user backing out.
 */
export const pickNoteImage: PickNoteImage = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

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
        // An undecodable file is the same outcome as a cancel for the caller;
        // the object URL is released so the failed pick leaks nothing.
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
