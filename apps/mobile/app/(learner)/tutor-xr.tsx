// The spatial whiteboard's route, inside the learner shell.
//
// It lives in `(learner)` and nowhere else: the group is wrapped in
// `Stack.Protected guard={isLearner}`, so a route outside it would be a child's
// board reachable by someone who is not that child. `headerShown: false`
// because the scene draws its own way out — a navigation header floating in
// front of a headset is chrome from the wrong medium.
//
// The screen itself arrives through `TutorXrEntry`, which resolves to the
// native fork that lazily imports the renderer. Nothing on this path evaluates
// `@reactvision/react-viro` until a board is actually opened in space.
// SOT: packages/app/features/tutor/tutor-xr-entry.native.tsx
// SOT-KEYWORDS: tutor xr route learner stack protected native lazy spatial whiteboard

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
        onExit={() => router.back()}
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
