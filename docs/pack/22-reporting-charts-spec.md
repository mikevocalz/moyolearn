# Reporting Charts & Graphs — one data contract, three rendering layers
**Doc 22 · Moyo platform pack · Date:** Aug 21, 2026
**Question answered:** what renders the charts for guardian progress, tutor/teacher views, ops dashboards, and the doc-19 district reporting product — and where `react-native-graph` fits. Verdict: it fits, as a scalpel. The toolbox is Victory Native. Kids don't get charts at all — they get celebrations.

---

## 1. What each audience actually sees (inventory before libraries)
- **Learners:** mastery rings, path progress, streak flames — *not chart-library territory.* Kids' progress visuals are custom Skia compositions in the doc-08 band voice: no axes, no gridlines, pure delight. A 7-year-old doesn't read a y-axis; she reads "my ring is almost full."
- **Guardians:** mastery-growth line over time (the emotional artifact — "she's climbing"), time-well-spent bars, skill breakdown.
- **Tutors/teachers (doc 19 teacher tier):** class mastery heatmap, stuck-skill lists, per-learner growth sparklines in the roster.
- **Ops Cloud:** revenue/utilization lines and bars, funnels, schedule-fill.
- **District (doc 19 §4):** dosage-attainment bars per building, growth-vs-expected lines, equity small-multiples, benchmark comparisons — and the same views frozen into the board pack.

## 2. Native stack — three layers, zero new native dependencies
The happy accident: [`react-native-graph`](https://github.com/margelo/react-native-graph)'s install list is `reanimated + gesture-handler + @shopify/react-native-skia` — and [Victory Native's](https://nearform.com/open-source/victory-native/docs) is *the same three*. Everything below rides deps the stack already carries (doc 20's size ratchet barely notices).
1. **Victory Native (formerly Victory Native XL) — the general chart layer.** The 2026 consensus pick: a from-scratch rewrite on Skia + Reanimated + Gesture Handler, line/bar/area/pie, gesture tooltips via `useChartPressState`, 100+ fps on low-end devices, composable and theme-able against our tokens. It **requires the New Architecture** (Skia's JSI) — a blocking constraint for old-arch teams and a non-issue for us (starter is New Arch, dev builds not Expo Go). Serves: guardian skill bars, ops dashboards, district dosage/growth/benchmark charts on native.
2. **`react-native-graph` — the scalpel, adopted for exactly what it is.** By its own README it is *"a Line Graph implementation"* built on Skia — native path interpolation, cubic bezier, up to 120 fps, and the best scrub gesture in the ecosystem (`onGestureStart/onPointSelected/onGestureEnd`, made for haptic-labeled exploration). No bars, no pies, no real axes (min/max labels only). It serves the two surfaces shaped like a price chart: the **guardian mastery-growth line** (scrub through the semester, haptic tick per point, label updates live) and the **ops revenue line**. Bonus: its `animated:false` mode is a lightweight renderer *"optimal for displaying a lot of graphs in large lists"* — exactly the teacher-roster **sparklines**. Caveats recorded honestly: wallet-app pedigree, modest commit count; maintenance cadence and New-Arch example verified at the PR before adoption, with Victory's line chart as the drop-in fallback if it stalls.
3. **Custom composition — where chart libraries would be wrong.** Learner progress visuals (rings/paths/streaks) are bespoke Skia. The **class heatmap** is a colored grid — build it from plain Views/Skia rects with our tokens; pulling a WebView-based ECharts into a kids' app for one grid fails the size ratchet and the a11y bar.

## 3. Web stack (Next 16) — dashboards and the board pack from one source
- **Recharts** renders the district/ops dashboards on web — React-idiomatic, composable, right-sized for aggregate data scale. Chart components are **client leaf components** (the doc-20 `"use client"` boundary audit applies; data arrives as chart-ready series from server components).
- **The board pack is the dashboard, printed.** A dedicated print-layout route renders the same components with the same data, and a headless browser job (pg-boss scheduled, doc 19 §5) prints it to PDF. One source of truth: what the superintendent presents *is* what the admin saw live — a separate chart-image pipeline that can drift is explicitly rejected.

## 4. The suppression rule — the chart layer's one non-negotiable
Doc 19's k-anonymity suppression must survive rendering: **a suppressed cell renders as an explicit "not shown (small group)" state — never zero, never silently omitted.** An omitted bar reads as zero to a school board, and a zero where a small group was hidden is a lie with an equity consequence. Typed at the contract level: `ChartCell = { value: number } | { suppressed: true }` — every chart component in every layer must render both variants, enforced by a shared story/test per component.

## 5. Shared data contract
`ChartSeries`/`ChartCell`/`ChartMeta` live in `packages/types` (registry-adjacent, doc 10); **transforms from rollup tables → series are pure functions in `packages/app`** shared by web and native — and, being pure, they're first-wave `bun test` targets (doc 21). Components fork per platform via the doc-10 `.native.tsx` pattern: same series in, Recharts out on web, Victory/graph out on native. Charts never query; they receive.

## 6. Accessibility, tokens, motion
Colorblind-safe categorical palette derived from brand tokens (yellow `#FFDB33` as highlight, not as the only encoding — value differences always double-encoded by position/label, contrast-checked on paper `#FFFDF7`); every reporting chart ships a **data-table toggle** (screen-reader path + the district ADA answer); animation keys off the doc-17 tokenized motion scale and respects reduced-motion (graph/Victory `animated` flags read it); numeric axes and time series stay LTR even under RTL locales (doc 16), with labels localized.

## 7. PRs
- **PR-68 · Chart foundation:** types + suppression variants, pure transforms, palettes, shared stories/tests.
- **PR-69 · Native charts:** Victory Native adoption, `react-native-graph` for the two scrub lines + roster sparklines (maintenance check first), learner Skia visuals.
- **PR-70 · Web dashboards + board pack:** Recharts surfaces, print route, headless PDF job.
- **PR-71 · A11y pass:** table toggles, reduced-motion verification, contrast audit.

## 8. Sources (linked)
[margelo/react-native-graph](https://github.com/margelo/react-native-graph) · [Victory Native docs (Nearform)](https://nearform.com/open-source/victory-native/docs) · [Victory Native 2026 tutorial](https://reactnativerelay.com/article/react-native-charts-victory-native-interactive-data-visualizations-expo) · [2026 RN charting comparison (PkgPulse)](https://www.pkgpulse.com/guides/victory-native-vs-react-native-chart-kit-vs-echarts-rn-2026) · [RN chart-library landscape](https://getnerdify.com/blog/charts-react-native) · [Victory Native XL guide](https://digitalthriveai.com/en-gb/resources/how-to/web-development/creating-victory-charts-react-native/) · Pack docs 08/10/16/17/19/20/21.
