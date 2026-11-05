/**
 * Focus handle for the toolbar NSSearchField, so ⌘K can reach it.
 *
 * The search field registers its ref here on mount; the Find Command handler
 * calls `focus()`. A ref is not view state, so it stays out of the Zustand
 * store. When no field is mounted (sidebar-only layouts, Settings window in
 * front) the handler reports that instead of doing nothing.
 * SOT: apps/desktop/src/toolbar.tsx
 * SOT-KEYWORDS: desktop command search focus shortcut nssearchfield ref
 */
import type { TextInputSearchRef } from "@legendapp/spark/ui/search";
import { useShellStore } from "./store";

let field: TextInputSearchRef | null = null;

export function registerCommandSearch(ref: TextInputSearchRef | null): void {
  field = ref;
}

export function focusCommandSearch(): void {
  try {
    if (!field) throw new Error("The command search field is not on screen.");
    field.focus();
  } catch (cause) {
    useShellStore.getState().reportError("Find Command", cause);
  }
}
