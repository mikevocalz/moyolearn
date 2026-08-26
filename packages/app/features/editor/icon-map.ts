import * as Icons from '@acme/ui/icons';

/**
 * Registry icon names resolved to components.
 *
 * The registry stores a NAME rather than a component so it stays a plain,
 * serialisable value that the settings screen and the tests can import without
 * pulling in the icon set.
 *
 * `IconName` is derived from the icon module rather than written down, so a
 * capability naming an icon that does not exist fails `pnpm typecheck` instead
 * of throwing when the toolbar renders. This used to be `Record<string, …>`
 * behind an `as unknown` cast — which made every name compile and moved the
 * whole class of error to runtime, where it crashes the toolbar rather than the
 * build. A `Video` capability shipped with no `Video` icon is how that was
 * found.
 */
/*
  Spread into a plain object rather than indexing the namespace directly:
  `import/namespace` cannot validate a computed reference into an imported
  namespace, and disabling the rule would give up the check everywhere else it
  is doing real work. The type is still derived from the module, so the guard is
  unchanged.
*/
const ICONS = { ...Icons };

export type IconName = keyof typeof ICONS;

export function iconFor(name: IconName): React.FC<{ size?: number; className?: string }> {
  return ICONS[name] as React.FC<{ size?: number; className?: string }>;
}
