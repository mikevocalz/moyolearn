// The semantic HTML elements moved to ./html — this keeps
// '@acme/ui/primitives' working for existing imports.
export * from '../html';
// Layout primitives live in ../tw; keep them reachable through the same
// primitives barrel so feature code has one import surface.
// Names that already exist in ../html are intentionally not re-exported.
export {
  View, Pressable, TextInput, ScrollView,
  H1, H2, H3, P,
} from '../tw';
// useHydrated is SSR plumbing rather than a component, and it has no
// dependencies at all — an SSR surface needs it without dragging the root
// barrel's Skia/Reanimated/Expo closure in to ask a boolean.
// Container and the styled Heading/Text live at '@acme/ui/typography': they are
// the styled layer OVER these elements, and the styled `Text` cannot share this
// barrel with the raw `Text` it wraps.
export { useHydrated } from '../use-hydrated';
