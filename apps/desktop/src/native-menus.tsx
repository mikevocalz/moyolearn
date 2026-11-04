/**
 * Native macOS menus, popup buttons and dialogs for the desktop shell.
 *
 * Every control here is an AppKit object driven through Spark 0.0.2:
 *   useMenu          -> NSApplication main menu (@legendapp/spark/menus)
 *   showContextMenu  -> NSMenu popped at a measured point (@legendapp/spark/context-menu)
 *   Select / Button  -> NSPopUpButton / NSButton (@legendapp/spark/ui)
 *   openFileDialog   -> NSOpenPanel (@legendapp/spark/dialogs)
 *   showMessage      -> NSAlert (@legendapp/spark/dialogs; there is no
 *                       `@legendapp/spark/message-dialog` subpath in 0.0.2)
 * No React-positioned overlay stands in for any of them. When a native module
 * is missing, the control is disabled or the error is surfaced; nothing fakes it.
 *
 * Carried from draft #137 and cut to the D01 sections. PR-D02 replaces the ad-hoc
 * item ids with the `commands.ts` registry and adds the full menu bar.
 * SOT: docs/desktop/seams/SEAMS.md (every symbol below has a node_modules path)
 * SOT-KEYWORDS: desktop native menu context-menu select popup dialog appkit spark
 */
import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { openFileDialog, showMessage } from "@legendapp/spark/dialogs";
import { useMenu, type MenuRootItem } from "@legendapp/spark/menus";
import { getContextMenuAvailability, showContextMenu } from "@legendapp/spark/context-menu";
import {
  Button as NativeButton,
  Select as NativeSelect,
  getControlAvailability,
  type ControlRef,
} from "@legendapp/spark/ui";
import { DESKTOP_SECTIONS, isDensity, isSection } from "./layout";
import { describeNitroProbe, probeNitro } from "./nitro-readiness";
import { useShellStore } from "./store";
import { color, corner, space, textStyle, useScheme, type Scheme } from "./theme";

const SECTION_OPTIONS = DESKTOP_SECTIONS.map(({ id, label }) => ({ value: id, label }));
const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] as const;

const ITEM = {
  chooseResource: "moyo-resource-choose",
  toggleCompact: "moyo-layout-compact",
  diagnostics: "moyo-help-diagnostics",
  navPrefix: "moyo-nav-",
} as const;

export async function chooseResource(): Promise<void> {
  const store = useShellStore.getState();
  try {
    const result = await openFileDialog({ title: "Choose a Resource", multiple: false });
    if (result.canceled) return;
    // Keep the base name only. No path is persisted and the file is never read.
    const name = result.paths[0]?.split(/[\\/]/).pop();
    if (!name) return;
    store.setResourceName(name);
    store.setSection("resources");
    store.dismissError();
  } catch (cause) {
    store.reportError("Open panel", cause);
  }
}

async function showRuntimeDiagnostics(): Promise<void> {
  try {
    await showMessage({
      title: "Runtime Diagnostics",
      message: describeNitroProbe(probeNitro()),
      kind: "info",
    });
  } catch (cause) {
    useShellStore.getState().reportError("Runtime Diagnostics", cause);
  }
}

function applyItem(itemId: string): void {
  const store = useShellStore.getState();
  if (itemId === ITEM.chooseResource) {
    void chooseResource();
  } else if (itemId === ITEM.toggleCompact) {
    store.setDensity(store.density === "compact" ? "comfortable" : "compact");
  } else if (itemId === ITEM.diagnostics) {
    void showRuntimeDiagnostics();
  } else if (itemId.startsWith(ITEM.navPrefix)) {
    const target = itemId.slice(ITEM.navPrefix.length);
    if (isSection(target)) store.setSection(target);
  }
}

/** Adds Moyo items to the system File, View and Help menus. Renders nothing. */
export function DesktopNativeMenus() {
  const density = useShellStore((state) => state.density);
  const items = useMemo<MenuRootItem[]>(
    () => [
      {
        type: "submenu",
        id: "moyo-file",
        label: "File",
        target: { menu: "file" },
        items: [
          { type: "action", id: ITEM.chooseResource, label: "Choose Resource…", shortcut: "CmdOrCtrl+O" },
        ],
      },
      {
        type: "submenu",
        id: "moyo-view",
        label: "View",
        target: { menu: "view" },
        items: [
          ...DESKTOP_SECTIONS.map(({ id, label }, index) => ({
            type: "action" as const,
            id: `${ITEM.navPrefix}${id}`,
            label,
            shortcut: `CmdOrCtrl+${index + 1}`,
          })),
          { type: "separator" as const },
          { type: "checkbox", id: ITEM.toggleCompact, label: "Compact Layout", checked: density === "compact" },
        ],
      },
      {
        type: "submenu",
        id: "moyo-help",
        label: "Help",
        target: { menu: "help" },
        items: [{ type: "action", id: ITEM.diagnostics, label: "Runtime Diagnostics…" }],
      },
    ],
    [density],
  );
  useMenu({
    id: "moyo-desktop-menu",
    items,
    onAction: ({ itemId }) => applyItem(itemId),
    onError: (cause) => useShellStore.getState().reportError("Menu bar", cause),
    onCleanupError: (cause) => useShellStore.getState().reportError("Menu bar", cause),
  });
  return null;
}

async function showQuickActions(point: { x: number; y: number }): Promise<void> {
  const store = useShellStore.getState();
  if (!getContextMenuAvailability().available) {
    store.reportError("More Actions", new Error("The native context-menu module is not in this runtime."));
    return;
  }
  try {
    const selection = await showContextMenu({
      windowId: "main",
      position: point,
      items: [
        { type: "action", id: ITEM.chooseResource, label: "Choose Resource…" },
        { type: "separator" },
        { type: "checkbox", id: ITEM.toggleCompact, label: "Compact Layout", checked: store.density === "compact" },
      ],
    });
    if (!selection.canceled) applyItem(selection.itemId);
  } catch (cause) {
    store.reportError("More Actions", cause);
  }
}

function MoreActionsButton() {
  const control = useRef<ControlRef>(null);
  return (
    <NativeButton
      ref={control}
      variant="bordered"
      testID="desktop-more-actions"
      accessibilityLabel="More actions"
      onError={(cause) => useShellStore.getState().reportError("More Actions", cause)}
      onPress={() => {
        // measureInWindow reports window logical coordinates, which is the
        // space showContextMenu expects for `windowId: "main"`.
        // Throws E_CLOSED when the control has unmounted (spark-ui control.ts).
        try {
          control.current?.measureInWindow((x, y, width, height) => {
            void showQuickActions({ x: x + width / 2, y: y + height });
          });
        } catch (cause) {
          useShellStore.getState().reportError("More Actions", cause);
        }
      }}
    >
      More Actions…
    </NativeButton>
  );
}

/** Section and layout NSPopUpButtons bound to the shell store. */
export function NativeWorkspaceToolbar() {
  const scheme = useScheme();
  const section = useShellStore((state) => state.section);
  const density = useShellStore((state) => state.density);
  const setSection = useShellStore((state) => state.setSection);
  const setDensity = useShellStore((state) => state.setDensity);
  const selectAvailable = getControlAvailability("select").available;
  const styles = toolbarStyles(scheme);

  return (
    <View style={styles.toolbar} accessibilityLabel="Workspace toolbar">
      <View style={styles.field}>
        <Text style={styles.label}>Section</Text>
        <NativeSelect
          testID="desktop-section-select"
          options={SECTION_OPTIONS}
          value={section}
          disabled={!selectAvailable}
          accessibilityLabel="Section"
          onValueChange={(value) => {
            if (isSection(value)) setSection(value);
          }}
          onError={(cause) => useShellStore.getState().reportError("Section menu", cause)}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Layout</Text>
        <NativeSelect
          testID="desktop-layout-select"
          options={DENSITY_OPTIONS}
          value={density}
          disabled={!selectAvailable}
          accessibilityLabel="Layout"
          onValueChange={(value) => {
            if (isDensity(value)) setDensity(value);
          }}
          onError={(cause) => useShellStore.getState().reportError("Layout menu", cause)}
        />
      </View>
      <MoreActionsButton />
    </View>
  );
}

function toolbarStyles(scheme: Scheme) {
  return StyleSheet.create({
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: space.stack,
      padding: space.tight,
      borderRadius: corner.card,
      backgroundColor: color("surface-raised", scheme),
    },
    field: { gap: space.hair },
    label: { ...textStyle("caption"), color: color("text-muted", scheme) },
  });
}
