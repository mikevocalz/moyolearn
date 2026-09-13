// The spatial whiteboard's route, inside the learner shell.
//
// IT IS GUARDED BY BEING DECLARED, NOT BY BEING HERE. The file lives in
// `(learner)`, but `Stack.Protected` guards NAMES rather than directories: it
// collects the `Stack.Screen` names beneath a falsy guard and removes exactly
// those from the navigator. So this route's protection is the
// `<Stack.Screen name="tutor-xr" />` line in `(learner)/_layout.tsx`, and
// without it a child's board is reachable by deep link under any role.
// `headerShown: false` because the scene draws its own way out — a navigation
// header floating in front of a headset is chrome from the wrong medium.
//
// The screen itself arrives through `TutorXrEntry`, which resolves to the
// native fork that lazily imports the renderer. Nothing on this path evaluates
// `@reactvision/react-viro` until a board is actually opened in space.
// SOT: packages/app/features/tutor/tutor-xr-entry.native.tsx
// SOT-KEYWORDS: tutor xr route learner stack protected native lazy spatial whiteboard

import { useCallback, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { TutorXrEntry, useAppSession, useXrSession } from '@acme/app';

export default function TutorXrRoute() {
  const router = useRouter();
  /*
    The band comes from the same place `TutorScreen` reads it, and falls back
    the same way — so a K–2 learner's hit targets are the size the token says in
    space as well as on glass, and nothing here hardcodes one.
  */
  const { activeContext } = useAppSession();
  const queueAsk = useXrSession((s) => s.queueAsk);

  /*
    BOTH ENDS OF THE DOUBLE-ENTRY GUARD LIVE HERE, and neither can live in the
    screen. `entering` means "between the press and the route being on screen",
    and this component IS the route being on screen — so arriving clears it and
    leaving resets the whole lifecycle for the next entry.

    The screen cannot do it because it is behind a lazy import: a renderer that
    fails to fetch, or a child who presses Go back while it is still being
    fetched, means the screen never mounts at all. A guard only the screen could
    clear would leave the door into the spatial board saying "Opening…" and
    refusing presses for the rest of the session.
  */
  const arrive = useXrSession((s) => s.arrive);
  const exit = useXrSession((s) => s.exit);
  useEffect(() => {
    arrive();
    return exit;
  }, [arrive, exit]);

  /*
    Stable, not an inline arrow. The screen keeps the way out in a module-level
    holder the captured scene reads, and it re-runs that wiring whenever the
    callback changes identity — so a callback rebuilt on every render of this
    route is a holder rewritten on every render of this route.
  */
  const handleExit = useCallback(() => router.back(), [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TutorXrEntry
        ageBand={activeContext?.gradeBand ?? 'adult'}
        /*
          `back`, not a push to the tutor screen. The 2D workspace is still
          mounted underneath with its pane state, its composer draft and its
          session; replacing it would restore none of those and would read to a
          child as their lesson starting again.
        */
        onExit={handleExit}
        /*
          Handed back rather than sent from here: staging a board as an
          attachment is the tutor screen's one path, and a second copy of it
          would be a second rule about what a child may send.
        */
        onAsk={queueAsk}
      />
    </>
  );
}
