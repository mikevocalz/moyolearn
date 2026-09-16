// The three-panel arc's contract, in a file the Viro renderer does not own.
//
// Same reason as every other `*.types.ts` here: a type-only re-export is erased
// at build but still RESOLVED by a bundler, so naming `XrTriPanel.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web.
// SOT: packages/ui/xr/XrTriPanel.native.tsx
// SOT-KEYWORDS: xr tri panel props types platform neutral no viro slots arc

/** A row in a `PremiumXRMediaPanel` list — poke-xr's shape, restated. */
export interface XrPanelRow {
  id: string;
  text: string;
  label?: string;
  emphasis?: boolean;
  /** Makes the row a button. Omitted, the row is a readout. */
  onPress?: () => void;
  /** Draws the row as chosen — the tool in the child's hand. */
  active?: boolean;
  disabled?: boolean;
  /** Renders the row as a real ViroButton with this face. */
  face?: 'pen' | 'highlighter' | 'eraser' | 'undo' | 'redo' | 'clear' | 'ask';
  /** The ink swatch, on the one button whose face is its content. */
  swatchColor?: string;
}

export interface XrTriPanelProps {
  /** The board, as the engine's own PNG. Null until the first raster lands. */
  boardUri: string | null;
  boardLive: boolean;
  controlSize: number;
  /** The question, as the centre panel's title. */
  boardTitle: string;
  /** The child's head in world metres — what the arc is measured from. */
  headPosition: readonly [number, number, number];
  /** The child's facing about Y, in degrees. The whole arc turns with them. */
  headYawDeg: number;
  /** Oldest first. The right panel scrolls them; the caller does not window. */
  chatRows: readonly XrPanelRow[];
  /** What the rail offers, as readable lines on the left panel. */
  controlRows: readonly XrPanelRow[];
  tutorName: string;
  /** A 1x1 the media column falls back to — these panels are text, not art. */
  placeholderUri: string;
}
