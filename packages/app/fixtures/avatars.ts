// The avatar base every mock person is drawn from.
//
// Extracted from the schedule fixtures, which owned it privately until a second
// roster needed the same faces. Copying the URL would have been the moment the
// two casts started drifting — different eyes, different mouths, the same people.
//
// Every visual feature is pinned per person. Seeded avatars come back random
// (bald, X-ed eyes), and photographic services skew so heavily white and East
// Asian that sampling 16 portraits turned up no Black faces. Pinning `skinColor`
// is what makes the roster's variety deliberate rather than a draw.
// SOT-KEYWORDS: avatar dicebear fixtures mock roster faces representation

export const AVATAR =
  'https://api.dicebear.com/9.x/avataaars/png?size=256&eyes=default&mouth=smile&eyebrows=default';

/** Builds a pinned avatar URL. `traits` are avataaars query parameters. */
export const avatarFor = (seed: string, traits: string) => `${AVATAR}&seed=${seed}&${traits}`;
