/**
 * Compile-time assertions for the art register.
 *
 * These are the register's invariants stated so that breaking one fails
 * `pnpm --filter @acme/art typecheck` rather than shipping. There is no
 * runtime code here and nothing imports it — `tsc` is the test runner.
 *
 * SOT: ./registry.ts
 * SOT-KEYWORDS: art registry invariants typecheck assertions never
 */

import type {
  ArtName,
  Band,
  FigureArtName,
  ObjectArtName,
  PhotoArtName,
  SceneArtName,
} from './registry';
import { ART } from './registry';
import { ART_PROVENANCE } from './registry.provenance';

type Assert<T extends true> = T;
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Extends<A, B> = A extends B ? true : false;

/**
 * Every runtime entry has provenance and vice versa. The `satisfies` clauses in
 * both files already enforce this; restating it here makes the failure message
 * name the register rather than a line in an object literal.
 */
type _HalvesInSync = Assert<Equals<ArtName, keyof typeof ART_PROVENANCE>>;

/**
 * The three illustration classes are empty until `docs/design/art-direction.md`
 * is approved, so their name types are `never` and every call site that would
 * mount one fails to compile. When the first scene lands, this assertion is the
 * thing that has to be edited — which is the moment to check the plates were
 * actually approved.
 */
type _NoScenesYet = Assert<Equals<SceneArtName, never>>;
type _NoSubjectArtYet = Assert<Equals<ObjectArtName, never>>;
type _NoFigureStillsYet = Assert<Equals<FigureArtName, never>>;

/** Photography exists and is adult-only. */
type _PhotographyExists = Assert<Extends<'hero-kitchen-table', PhotoArtName>>;
type _PhotosAreAdultOnly = Assert<
  Equals<(typeof ART)[PhotoArtName]['bands'][number], Extract<Band, 'adult'>>
>;

/** No entry may claim zero renditions or zero bands. */
type _WidthsNonEmpty = Assert<
  Extends<(typeof ART)[ArtName]['widths'][0], number>
>;
type _BandsNonEmpty = Assert<Extends<(typeof ART)[ArtName]['bands'][0], Band>>;
