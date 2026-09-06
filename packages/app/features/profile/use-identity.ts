'use client';
// useIdentity — who is signed in, for the chrome that draws them.
//
// One seam, because identity had been living in `profile.store` as literals:
// `name: 'Nina Alvarez'`, `handle: '@nina'`, `email: 'nina@example.com'` and a
// pinned DiceBear URI. Every shell header on both platforms read it, so every
// signed-in person — guardians, tutors, and children — was drawn as the same
// invented adult, on surfaces whose own copy said "how you appear across the
// app". `useAppSession` had carried the real name the whole time; the chrome
// simply never asked it.
//
// `AppUser` is `{ id, name, kind }`. There is no email and no image on it, so
// this hook returns the one field that exists. The avatar falls back to
// initials, which is `Avatar`'s documented behaviour when there is no picture
// ("a person's picture, or their initials while there isn't one") rather than a
// stand-in face.
//
// The empty-string fallback is deliberate: it renders a blank well, and blank
// is the honest drawing of an unknown person. A placeholder name would put a
// second invented identity where the first one just left.
// SOT: packages/app/providers/session/types.ts · packages/ui/Avatar.tsx ·
//      docs/design/reset/04-guardian-fixture-audit.md
// SOT-KEYWORDS: identity name avatar session chrome header profile fixture initials

import { useAppSession } from '../../providers/session';

export interface Identity {
  /** The signed-in person's name, or '' when nobody is. */
  name: string;
}

export function useIdentity(): Identity {
  const { user } = useAppSession();
  return { name: user?.name ?? '' };
}
