'use client';
// PLATFORM FORK — the ops trend line on web, drawn with plain DOM SVG.
//
// Not Skia here: @shopify/react-native-skia on web needs CanvasKit WASM loaded
// through WithSkiaWeb, which is a lot of bytes for one polyline, and doc 27 §3
// puts the web dashboards on a DOM renderer anyway. Not Recharts either — a
// single series with no legend, no tooltip axis and no second measure is a
// `<polyline>`, and Recharts earns its place at the district board pack where
// there are real axes and comparisons to draw.
// Not react-native-svg either, and this one was learned the hard way: under
// Turbopack + react-native-web it drags in Fabric native modules
// (`TurboModuleRegistry`, `codegenNativeComponent`) that RNW does not export and
// Turbopack cannot parse, and importing it anywhere in the kit barrel takes down
// every route in the app. A `.web` fork is DOM, so it uses DOM <svg>.
// The native fork uses react-native-graph for the Skia scrub gesture.
// SOT: docs/pack/27-reporting-charts-spec.md §3
// SOT-KEYWORDS: trendline chart web svg polyline sparkline revenue suppression
// Mobbin: https://mobbin.com/screens/b6059966-2a7a-4db1-b127-2afdf2803004 (Whop —
//   headline number and delta ABOVE the plot, plot carries no numbers of its own) ·
//   https://mobbin.com/screens/d787ab5a-5243-4ef6-bbd0-565e39a00936 (Midday —
//   recessive gridlines, first and last x labels only) ·
//   https://mobbin.com/screens/fe1f317d-f316-4eac-bc9d-015377a4b789 (Jobber —
//   y axis labelled at three stops, not every gridline) ·
//   https://mobbin.com/screens/a143048a-b558-41d4-a9b2-2395f40add51 (Fresha —
//   direct end-point marker instead of a value on every point)
import { Text, View } from './primitives';
import { useInstanceStore, useStore } from './use-instance-store';
import { isSuppressed } from './DataTable';
import type { TrendLineProps } from './TrendLine.types';

/** Three stops, not one per gridline — the axis is reference, not content. */
const GRID_STOPS = [0, 0.5, 1];

export function TrendLine({
  data,
  title,
  format = (v) => String(v),
  height = 160,
  className,
}: TrendLineProps) {
  // Repo rule: zustand, never React state — a vanilla store in a ref is the
  // per-instance pattern the kit already uses.
  const store = useInstanceStore<{ hover: number | null }>(() => ({ hover: null }));
  const hover = useStore(store, (s) => s.hover);

  const plotted = data.map((p, i) => ({ ...p, i }));
  const shown = plotted.filter((p) => !isSuppressed(p.value));
  const suppressedCount = plotted.length - shown.length;

  /*
    The scale starts at ZERO, and that is not a preference.

    A filled area encodes quantity by its AREA, so baselining it at the data
    minimum inflates the change — $2,140 → $4,210 was drawn as a rise from
    nothing to full height, a doubling-and-more that did not happen. A plain
    line may truncate its axis; the moment it is filled, it may not.
  */
  const values = shown.map((p) => (p.value as { value: number }).value);
  const min = 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;

  /*
    The plot is INSET inside the viewBox. Mapping straight to the box edges put
    the peak on the top border and clipped the end-point marker in half against
    the right edge — a chart whose maximum touches the frame reads as truncated
    data, which is a different claim from "this is the maximum".
  */
  const VB_W = 100;
  const VB_H = 40;
  // Generous inset: at PAD_Y 4 the peak sat ON the top gridline and read as a
  // clipped series. Nothing in a chart should touch its own frame.
  const PAD_X = 4;
  const PAD_Y = 7;
  const plotW = VB_W - PAD_X * 2;
  const plotH = VB_H - PAD_Y * 2;
  const x = (i: number) =>
    plotted.length > 1 ? PAD_X + (i / (plotted.length - 1)) * plotW : VB_W / 2;
  const y = (v: number) => PAD_Y + plotH - ((v - min) / span) * plotH;

  /*
    Suppressed points BREAK the line rather than interpolating across the hole.
    Bridging them would draw a confident trend through data nobody is allowed to
    see, which is the same lie as plotting a zero (doc 27 §4).
  */
  const segments: { line: string; area: string }[] = [];
  let run: { x: number; y: number }[] = [];
  const baseline = VB_H - PAD_Y;
  const flush = () => {
    const first = run[0];
    const lastPt = run[run.length - 1];
    if (run.length > 1 && first && lastPt) {
      const line = run.map((pt) => `${pt.x},${pt.y}`).join(' ');
      // The area closes down to the baseline at both ends, so a broken segment
      // still reads as a filled band rather than a floating sliver.
      const area = `${first.x},${baseline} ${line} ${lastPt.x},${baseline}`;
      segments.push({ line, area });
    }
    run = [];
  };
  for (const p of plotted) {
    if (isSuppressed(p.value)) {
      flush();
      continue;
    }
    run.push({ x: x(p.i), y: y(p.value.value) });
  }
  flush();

  /*
    A band spans a RUN of hidden points from the last visible point to the next
    one, not half a step either side of each. Banding ±half a step left bare
    slivers between the end of the line and the start of the band, so the chart
    still had unexplained empty space beside the explained kind — which is the
    exact ambiguity the band exists to remove.
  */
  const suppressedSpans: { from: number; to: number }[] = [];
  for (let i = 0; i < plotted.length; i += 1) {
    const point = plotted[i];
    if (!point || !isSuppressed(point.value)) continue;
    let end = i;
    while (end + 1 < plotted.length && isSuppressed(plotted[end + 1]!.value)) end += 1;
    suppressedSpans.push({
      from: i === 0 ? PAD_X : x(i - 1),
      to: end === plotted.length - 1 ? VB_W - PAD_X : x(end + 1),
    });
    i = end;
  }

  const lastShown = shown[shown.length - 1];
  const lastValue = lastShown ? (lastShown.value as { value: number }).value : null;
  const firstShown = shown[0];
  const firstValue = firstShown ? (firstShown.value as { value: number }).value : null;

  /*
    The chart's own sentence, for anyone who cannot see it. Direction and the
    hidden count are the two facts the picture carries that the header does not.
  */
  const direction =
    firstValue === null || lastValue === null
      ? 'no data'
      : lastValue > firstValue
        ? 'rising'
        : lastValue < firstValue
          ? 'falling'
          : 'flat';
  const summary =
    `${title}: ${direction} from ${firstValue === null ? '—' : format(firstValue)} in ` +
    `${plotted[0]?.label ?? ''} to ${lastValue === null ? '—' : format(lastValue)} in ` +
    `${plotted[plotted.length - 1]?.label ?? ''}` +
    (suppressedCount > 0
      ? `. ${suppressedCount} ${suppressedCount === 1 ? 'period is' : 'periods are'} not shown, because the group is too small.`
      : '.');

  const hovered = hover === null ? null : plotted[hover];
  const hoveredValue =
    hovered && !isSuppressed(hovered.value) ? (hovered.value as { value: number }).value : null;

  return (
    <View className={`gap-element ${className ?? ''}`}>
      {/* The number lives in the header, never on the plot — Whop's pattern and
          the reason the chart itself needs no value labels at all. */}
      <View className="flex-row items-baseline justify-between gap-element">
        <Text className="text-label text-text-muted">{title}</Text>
        {lastValue !== null ? (
          <Text className="font-mono text-data-lg text-text">{format(lastValue)}</Text>
        ) : null}
      </View>

      <View className="w-full flex-row gap-element">
        {/* Three y stops, labelled — a gridline with no number is decoration.
            Column is fixed-width so the plot's left edge does not jitter as the
            figures change length. */}
        <View className="w-12 shrink-0 justify-between py-0.5">
          {[max, min + span / 2, min].map((v) => (
            <Text key={v} className="text-right font-mono text-caption text-text-muted">
              {format(Math.round(v))}
            </Text>
          ))}
        </View>
        {/*
          A real <div> for the pointer surface: this is the web fork, and the
          hit area has to be the PLOT, not the SVG's painted marks — hovering a
          chart should not require finding a 2px line.
        */}
        <div
          style={{ height }}
          className="relative min-w-0 flex-1"
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left) / box.width;
            // Map the pointer to the NEAREST point rather than the one to its
            // left: snapping backwards makes the readout feel a step behind.
            const index = Math.round(ratio * Math.max(plotted.length - 1, 1));
            store.setState({ hover: Math.min(Math.max(index, 0), plotted.length - 1) });
          }}
          onPointerLeave={() => store.setState({ hover: null })}
        >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          /*
            role="img" + a summary, rather than aria-hidden. A decorative flag
            would hide the only place this trend is stated — the header carries
            the latest figure, not the shape or the hole.
          */
          role="img"
          aria-label={summary}
        >
          {GRID_STOPS.map((stop) => (
            <line
              key={stop}
              x1={PAD_X}
              x2={VB_W - PAD_X}
              y1={PAD_Y + stop * plotH}
              y2={PAD_Y + stop * plotH}
              stroke="var(--color-border-faint)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {segments.map((seg) => (
            <polygon
              key={`area-${seg.line}`}
              points={seg.area}
              fill="var(--color-ballpoint)"
              opacity={0.14}
            />
          ))}
          {segments.map((seg) => (
            <polyline
              key={seg.line}
              points={seg.line}
              fill="none"
              stroke="var(--color-ballpoint)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/*
            No end-point marker. `preserveAspectRatio="none"` is what lets the
            line fill any container width, and it stretches a circle into an
            ellipse — the marker rendered as a slash. The value already sits in
            the header, so the dot was decoration with a bug attached.
          */}
          {/* Crosshair. Drawn last so it sits over the fill, and with a
              non-scaling stroke so it stays a hairline at any container width. */}
          {hovered ? (
            <line
              x1={x(hovered.i)}
              x2={x(hovered.i)}
              y1={PAD_Y}
              y2={PAD_Y + plotH}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {/*
          Suppressed months are HATCHED and LABELLED IN PLACE.

          They were a flat grey rectangle with the explanation parked in the
          footer, and the first person to see it asked whether the data was
          missing — which is the exact question the band exists to answer. Flat
          grey reads as "nothing rendered"; a 45° hatch reads as "deliberately
          excluded", and doc 08 §4.3 already uses a 45° hatch for exactly that
          meaning elsewhere in the kit, so this is the system's vocabulary
          rather than a new one. Ink, not redpen: nobody got this wrong.

          HTML rather than an SVG <pattern>: the plot carries
          `preserveAspectRatio="none"` so it can fill any width, which shears a
          pattern off 45°. An overlay is measured in screen space and stays
          true. Inline style because a repeating gradient has no token — and
          this is the .web fork, where gradients exist at all.
        */}
        {suppressedSpans.map((band) => (
          <View
            key={`gap-${band.from}`}
            className="absolute items-center justify-end"
            style={{
              left: `${(band.from / VB_W) * 100}%`,
              width: `${((band.to - band.from) / VB_W) * 100}%`,
              top: `${(PAD_Y / VB_H) * 100}%`,
              height: `${(plotH / VB_H) * 100}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--color-border-faint) 0 1px, transparent 1px 7px)',
            }}
          >
            <Text className="pb-element text-caption text-text-muted">Not shown</Text>
          </View>
        ))}

        {/*
          Marker and tooltip are HTML, positioned in percentages. In SVG they
          would inherit `preserveAspectRatio="none"` and stretch — the same
          distortion that turned the old end-point dot into a slash.
        */}
        {hovered && hoveredValue !== null ? (
          <View
            aria-hidden
            className="absolute h-2 w-2 rounded-full border-2 border-surface-raised bg-ballpoint"
            style={{
              left: `${(x(hovered.i) / VB_W) * 100}%`,
              top: `${(y(hoveredValue) / VB_H) * 100}%`,
              transform: [{ translateX: -4 }, { translateY: -4 }],
            }}
          />
        ) : null}

        {hovered ? (
          <View
            role="status"
            className="absolute top-0 gap-0 rounded-control border-2 border-border bg-surface-raised px-inset-tight py-element shadow-card"
            style={{
              left: `${(x(hovered.i) / VB_W) * 100}%`,
              // Flip the tooltip to the left of the crosshair past the midpoint
              // so it never runs off the panel's right edge.
              transform: [{ translateX: x(hovered.i) > VB_W / 2 ? -108 : 8 }],
            }}
          >
            <Text className="text-caption text-text-muted">{hovered.label}</Text>
            <Text className="font-mono text-data text-text">
              {hoveredValue === null ? 'Not shown' : format(hoveredValue)}
            </Text>
          </View>
        ) : null}
        </div>
      </View>

      <View className="flex-row items-center justify-between gap-element">
        <Text className="text-caption text-text-muted">{plotted[0]?.label}</Text>
        {/* The count moved onto the band itself; this line only has to explain
            WHY, since the band already says where. */}
        {suppressedCount > 0 ? (
          <Text className="text-caption text-text-muted">Hidden: group too small</Text>
        ) : null}
        <Text className="text-caption text-text-muted">{plotted[plotted.length - 1]?.label}</Text>
      </View>
    </View>
  );
}
