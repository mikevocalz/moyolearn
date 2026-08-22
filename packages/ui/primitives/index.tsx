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
