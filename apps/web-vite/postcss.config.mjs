// Tailwind 4 has no `tailwind.config.js` and no autoprefixer step — the single
// `@tailwindcss/postcss` plugin does both, and the design tokens arrive through
// `@import '@acme/theme/theme.css'` in src/globals.css rather than a JS config.
// SOT: apps/storybook/postcss.config.mjs (same Vite + Tailwind 4 pairing)
// SOT-KEYWORDS: postcss tailwind4 web-vite css pipeline
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
