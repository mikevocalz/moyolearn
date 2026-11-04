import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { openFileDialog } from "@legendapp/spark/dialogs";
import { useMenu, type MenuRootItem } from "@legendapp/spark/menus";
import { showContextMenu, getContextMenuAvailability } from "@legendapp/spark/context-menu";
import {
  Button as NativeButton,
  Select as NativeSelect,
  type ControlRef,
  getControlAvailability,
} from "@legendapp/spark/ui";
import { semantic } from "../../../packages/theme/tokens";
import {
  DESKTOP_SECTIONS,
  type DesktopSection,
  type DesktopDensity,
} from "./layout";
import { usePreviewStore } from "./store";

/**
 * Desktop dropdowns are native AppKit controls, not RN absolutely-positioned
 * popup overlays: Select -> NSPopUpButton, Button -> NSButton,
 * showContextMenu -> NSMenu, useMenu -> NSApplication menu bar.
 *
 * These APIs require a compatible Spark native runtime. Any missing native
 * module reports an error; never substitute a fake dropdown during preview.
 */

const SECTION_OPTIONS = DESKTOP_SECTIONS.map(({ id, label }) => ({ value: id, label }));
const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] as const;

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isSection(value: string): value is DesktopSection {
  return DESKTOP_SECTIONS.some((section) => section.id === value);
}

function isDensity(value: string): value is DesktopDensity {
  return value === "comfortable" || value === "compact";
}

export async function chooseResource(): Promise<void> {
  try {
    const result = await openFileDialog({
      title: "Choose a lesson resource",
      multiple: false,
    });
    if (result.canceled) return;
    // Never persist absolute paths or read/upload contents in an anonymous app.
    const fileName = result.paths[0]?.split(/[/\\]/).pop();
    if (!fileName) return;
    const state = usePreviewStore.getState();
    state.setResource(fileName);
    state.setSection("resources");
  } catch (cause) {
    usePreviewStore.getState().setError(errorText(cause));
  }
}

function applyMenuAction(itemId: string): void {
  const state = usePreviewStore.getState();
  if (itemId === "moyo-resource-open") {
    void chooseResource();
  } else if (itemId === "moyo-note-clear") {
    state.clearNote();
  } else if (itemId === "moyo-toggle-compact") {
    state.setDensity(state.density === "compact" ? "comfortable" : "compact");
  } else if (itemId.startsWith("moyo-nav-")) {
    const target = itemId.slice("moyo-nav-".length);
    if (isSection(target)) state.setSection(target);
  }
}

/** Native macOS File/View menus merge with the system's Edit/Window menus. */
export function DesktopNativeMenus() {
  const density = usePreviewStore((state) => state.density);
  const menuItems: MenuRootItem[] = useMemo(
    () => [
      {
        type: "submenu",
        id: "moyo-file-menu",
        label: "File",
        target: { menu: "file" },
        items: [
          {
            type: "action",
            id: "moyo-resource-open",
            label: "Choose Lesson Resource…",
            shortcut: "CmdOrCtrl+O",
          },
          { type: "separator" },
          {
            type: "action",
            id: "moyo-note-clear",
            label: "Clear Temporary Scratchpad",
          },
        ],
      },
      {
        type: "submenu",
        id: "moyo-view-menu",
        label: "View",
        target: { menu: "view" },
        items: [
          ...DESKTOP_SECTIONS.map(({ id, label }, index) => ({
            type: "action" as const,
            id: `moyo-nav-${id}`,
            label: `Go to ${label}`,
            shortcut: `CmdOrCtrl+${index + 1}`,
          })),
          { type: "separator" as const },
          {
            type: "checkbox",
            id: "moyo-toggle-compact",
            label: "Compact Workspace Spacing",
            checked: density === "compact",
          },
        ],
      },
    ],
    [density],
  );
  useMenu({
    id: "moyo-learn-desktop-menu",
    items: menuItems,
    onAction: ({ itemId }) => applyMenuAction(itemId),
    onError: (cause) => usePreviewStore.getState().setError(errorText(cause)),
    onCleanupError: (cause) => usePreviewStore.getState().setError(errorText(cause)),
  });
  return null;
}

/**
 * The native quick actions menu opens at the NSButton's measured position.
 * `windowId: main` is explicitly scoped to the host-created main window.
 */
async function showNativeQuickActions(point: { x: number; y: number }): Promise<void> {
  const availability = getContextMenuAvailability();
  if (!availability.available) {
    usePreviewStore.getState().setError("The native context-menu module is unavailable.");
    return;
  }

  const state = usePreviewStore.getState();
  try {
    const selection = await showContextMenu({
      windowId: "main",
      position: point,
      items: [
        { type: "action", id: "moyo-resource-open", label: "Choose Lesson Resource…" },
        { type: "action", id: "moyo-nav-planner", label: "Open Lesson Scratchpad" },
        { type: "action", id: "moyo-nav-overview", label: "Go to Overview" },
        { type: "separator" },
        {
          type: "checkbox",
          id: "moyo-toggle-compact",
          label: "Compact Workspace Spacing",
          checked: state.density === "compact",
        },
        {
          type: "action",
          id: "moyo-note-clear",
          label: "Clear Scratchpad",
          disabled: state.note.length === 0,
        },
      ],
    });
    if (!selection.canceled) applyMenuAction(selection.itemId);
  } catch (cause) {
    usePreviewStore.getState().setError(errorText(cause));
  }
}

function MoreActionsNativeButton() {
  const control = useRef<ControlRef>(null);
  return (
    <NativeButton
      ref={control}
      variant="bordered"
      testID="desktop-native-action-menu"
      accessibilityLabel="Open native workspace actions"
      style={styles.moreButton}
      onError={(cause) => usePreviewStore.getState().setError(errorText(cause))}
      onPress={() => {
        // Native control measurements are in window logical coordinates.
        control.current?.measureInWindow((x, y, width, height) => {
          void showNativeQuickActions({ x: x + width / 2, y: y + height });
        });
      }}
    >
      More actions…
    </NativeButton>
  );
}

/** Real AppKit NSPopUpButton controls, bound to the same Zustand UI state. */
export function NativeWorkspaceToolbar() {
  const section = usePreviewStore((state) => state.section);
  const density = usePreviewStore((state) => state.density);
  const setSection = usePreviewStore((state) => state.setSection);
  const setDensity = usePreviewStore((state) => state.setDensity);
  const nativeSelect = getControlAvailability("select");

  return (
    <View style={styles.toolbar} accessibilityLabel="Desktop workspace toolbar">
      <View style={styles.selector}>
        <Text style={styles.label}>WORKSPACE</Text>
        <NativeSelect
          testID="desktop-native-workspace-select"
          options={SECTION_OPTIONS}
          value={section}
          disabled={!nativeSelect.available}
          onValueChange={(value) => {
            if (isSection(value)) setSection(value);
          }}
          accessibilityLabel="Choose workspace"
          style={styles.workspaceSelect}
          onError={(cause) => usePreviewStore.getState().setError(errorText(cause))}
        />
      </View>
      <View style={styles.selector}>
        <Text style={styles.label}>LAYOUT</Text>
        <NativeSelect
          testID="desktop-native-density-select"
          options={DENSITY_OPTIONS}
          value={density}
          disabled={!nativeSelect.available}
          onValueChange={(value) => {
            if (isDensity(value)) setDensity(value);
          }}
          accessibilityLabel="Choose workspace spacing"
          style={styles.densitySelect}
          onError={(cause) => usePreviewStore.getState().setError(errorText(cause))}
        />
      </View>
      <View style={styles.actionColumn}>
        <MoreActionsNativeButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: semantic.border.light,
    backgroundColor: semantic["surface-raised"].light,
    borderRadius: 12,
  },
  selector: { gap: 5 },
  label: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "800",
    color: semantic["text-muted"].light,
  },
  workspaceSelect: { width: 205, height: 36 },
  densitySelect: { width: 156, height: 36 },
  actionColumn: { minHeight: 36, justifyContent: "flex-end" },
  moreButton: { width: 142, height: 36 },
});
