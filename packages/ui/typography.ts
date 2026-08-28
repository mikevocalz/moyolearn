// The token-driven text layer, reachable without the root barrel.
//
// `Heading`, `Text` and `Container` are the components that own the type ramp,
// the tone scale and the content widths — the things any prose surface needs
// and the things a raw primitive deliberately does not provide. They are also
// genuinely cheap: each imports `tv` (tailwind-variants) and one primitive,
// and nothing else.
//
// They were only reachable through `./index.ts`, which re-exports the whole kit
// — Skia, Reanimated, gesture-handler, the Expo native modules — so a
// prerendered marketing page paid for a canvas library to render a paragraph.
// Measured on apps/web-vite: 199.11 kB gz of initial JS before this entry
// existed, 143.0 kB after. Same components, same markup.
//
// WHY A SEPARATE ENTRY AND NOT `./primitives`: primitives already exports a
// `Text` — the raw element these wrap. Two different components cannot share
// that name in one barrel, and `Text.tsx` imports the primitive `Text`, so
// re-exporting the styled one from there would also close a cycle. The split
// is real: primitives are elements, typography is the styled layer over them.
//
// This is an additional door onto existing components, never a second
// implementation. `./index.ts` still exports all three; nothing is moved.
// SOT: packages/ui/index.ts · docs/site/adr-001-ssr-lane.md
// SOT-KEYWORDS: typography entry point heading text container tree shaking ssr marketing bundle budget barrel
export { Heading, type HeadingProps } from './Heading';
export { Text, type TextProps } from './Text';
export { Container, type ContainerProps } from './layout/Container';
