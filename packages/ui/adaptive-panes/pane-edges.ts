"use client";
// Which safe-area edges the pane row insets itself for.
//
// The row takes `left` and `right` so no pane sits under a cutout or a
// system column. On iPhone Duo the shell's tab rail already lives in that
// trailing column (`useHardwareEdgeColumn`), and measured on the Duo the
// row's `SafeArea` still padded the full 84 dp inside the narrower scene —
// so the third pane ended a dead 84 dp short of the rail. The shell that
// places the rail says so through this context; screens outside the tabbed
// shell (the tutor session is a stack route) keep the default.
// SOT-KEYWORDS: adaptive panes safe area edges rail column iphone duo context
import { createContext, useContext } from "react";

export type PaneEdges = readonly ("left" | "right")[];

const BOTH: PaneEdges = ["left", "right"];

export const PaneEdgesContext = createContext<PaneEdges>(BOTH);

export function usePaneEdges(): PaneEdges {
  return useContext(PaneEdgesContext);
}
