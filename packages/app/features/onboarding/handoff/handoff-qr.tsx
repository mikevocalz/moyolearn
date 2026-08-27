'use client';
// The handoff code as a QR — doc 36 §2 promises "QR/short code" and doc 37 §2
// calls the QR moment "the product's first magic trick", so it renders beside
// the code, not instead of it (the code is still what gets read aloud across a
// room).
//
// ONE universal component, no platform fork, no SVG dependency: `qrcode` is a
// pure-JS encoder whose `create()` returns the module matrix synchronously,
// and the matrix is painted with kit Views — each row a flex-row of
// run-length segments weighted by `flex`. react-native-svg is deliberately NOT
// used: on web it drags Fabric native modules into the bundle and takes down
// every route under Turbopack (TrendLine.web.tsx documents the incident), and
// a fork to dodge that would leave two drawings of one code to keep in sync.
//
// Mobbin: https://mobbin.com/screens/6e3bd021-387b-4ee5-9ea3-1454202a1924
// (Posh — the code as the screen's one object; the QR sits under it as the
// same fact in a second shape) · https://mobbin.com/screens/f54d0305-c0b3-4f61-93e8-f833d8fc8efd
// (PayPal — code plus escape hatch; nothing else near the scan target).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/36-role-navigation-flows.md §2 · docs/pack/37-onboarding-dual-pane.md §2
// SOT-KEYWORDS: handoff qr code panel scan deep link universal views

import { create as createQr } from 'qrcode';
import { View } from '@acme/ui/tw';

/** One horizontal run of same-coloured modules; `length` becomes flex weight. */
interface ModuleRun {
  dark: boolean;
  length: number;
}

/**
 * Row-major run-length encoding of the QR matrix. A 25×25 code painted one
 * View per module is 625 nodes; as runs it is ~250, and the run shape maps
 * directly onto flex weights so the drawing needs no per-module geometry.
 */
function matrixRuns(value: string): ModuleRun[][] {
  // Error level M matches what phone cameras expect from on-screen codes; the
  // payload is a short deep link, so the matrix stays at version 2–3.
  const { modules } = createQr(value, { errorCorrectionLevel: 'M' });
  const rows: ModuleRun[][] = [];
  for (let row = 0; row < modules.size; row++) {
    const runs: ModuleRun[] = [];
    for (let col = 0; col < modules.size; col++) {
      const dark = modules.get(row, col) === 1;
      const last = runs[runs.length - 1];
      if (last && last.dark === dark) last.length += 1;
      else runs.push({ dark, length: 1 });
    }
    rows.push(runs);
  }
  return rows;
}

export interface HandoffQrProps {
  /** The full deep link (`moyo://handoff?code=…`), never the bare code. */
  value: string;
  /** What a screen reader says the square is for. */
  label: string;
}

export function HandoffQr({ value, label }: HandoffQrProps) {
  // Derived straight from props, no memo: the value changes only when a new
  // code is minted, which re-renders the whole panel anyway, and encoding a
  // 30-character payload is cheaper than the diff it would save.
  const rows = matrixRuns(value);

  return (
    <View
      accessibilityRole="image"
      aria-label={label}
      // bg-surface behind ink `bg-text` modules is the highest-contrast pair
      // the palette has, and the p-inset is the quiet zone scanners need —
      // structural, not decorative, so no border competes with the finder
      // patterns.
      className="aspect-square w-44 self-center bg-surface p-inset"
    >
      {rows.map((runs, rowIndex) => (
        <View key={rowIndex} className="flex-1 flex-row">
          {runs.map((run, runIndex) => (
            <View
              key={runIndex}
              style={{ flex: run.length }}
              className={run.dark ? 'bg-text' : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
