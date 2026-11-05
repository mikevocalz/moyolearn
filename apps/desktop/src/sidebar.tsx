/**
 * Sidebar pane: brand row plus the AppKit source list of sections.
 *
 * `Sidebar` / `SidebarItem` are an NSOutlineView source list (spark-ui
 * sidebar). Right-click on a row arrives as `onContextMenu` with window
 * coordinates and opens an NSMenu through `showContextMenu`; the items come
 * from the command registry's `context` surface. Rename / Archive / Move… are
 * struck until rows are user-owned objects (PR-D05, see commands.ts).
 * SOT: apps/desktop/src/commands.ts · docs/desktop/seams/D02.md
 * SOT-KEYWORDS: desktop sidebar source list nsoutlineview context menu sections
 */
import { Image, StyleSheet, Text, View } from "react-native";
import { getContextMenuAvailability, showContextMenu, type MenuItem as ContextMenuItem } from "@legendapp/spark/context-menu";
import { Sidebar, SidebarItem, type SidebarContextMenuEvent } from "@legendapp/spark/ui/sidebar";
import { runCommandItem } from "./command-actions";
import { COMMANDS, type CommandId } from "./commands";
import { DESKTOP_SECTIONS, isSection, type DesktopSection } from "./layout";
import { useShellStore } from "./store";
import { color, space, target, textStyle, type Scheme } from "./theme";

const SECTION_COMMAND = {
  workspace: "view.section.workspace",
  resources: "view.section.resources",
} as const satisfies Record<DesktopSection, CommandId>;

function contextItems(section: DesktopSection): ContextMenuItem[] {
  const store = useShellStore.getState();
  const open: ContextMenuItem = { type: "action", id: SECTION_COMMAND[section], label: "Open" };
  const compact: ContextMenuItem = {
    type: "checkbox",
    id: "view.toggleCompact",
    label: COMMANDS["view.toggleCompact"].label,
    checked: store.density === "compact",
  };
  if (section === "resources") {
    return [
      open,
      { type: "separator" },
      { type: "action", id: "file.chooseResource", label: COMMANDS["file.chooseResource"].label },
      { type: "action", id: "file.clearResource", label: COMMANDS["file.clearResource"].label, disabled: store.resourceName === null },
      { type: "separator" },
      compact,
    ];
  }
  return [open, { type: "separator" }, compact];
}

async function openRowMenu(section: DesktopSection, event: SidebarContextMenuEvent): Promise<void> {
  const store = useShellStore.getState();
  if (!getContextMenuAvailability().available) {
    store.reportError("Sidebar menu", new Error("The native context-menu module is not in this runtime."));
    return;
  }
  try {
    const selection = await showContextMenu({ windowId: "main", position: event.windowPosition, items: contextItems(section) });
    if (!selection.canceled) runCommandItem(selection.itemId);
  } catch (cause) {
    store.reportError("Sidebar menu", cause);
  }
}

export function SidebarPane({ scheme }: { scheme: Scheme }) {
  const section = useShellStore((state) => state.section);
  const setSection = useShellStore((state) => state.setSection);
  const reportError = useShellStore((state) => state.reportError);
  const styles = sidebarStyles(scheme);
  return (
    <View style={styles.pane}>
      <View style={styles.brand}>
        <Image source={require("../assets/mark.png")} style={styles.mark} resizeMode="contain" accessible={false} />
        <Text style={styles.brandName}>Moyo Learn</Text>
      </View>
      <Sidebar
        style={styles.list}
        selectedId={section}
        accessibilityLabel="Sections"
        onSelectionChange={({ id }) => {
          if (id !== null && isSection(id)) setSection(id);
        }}
        onError={(cause) => reportError("Sidebar", cause)}
      >
        {DESKTOP_SECTIONS.map((item) => (
          <SidebarItem
            key={item.id}
            id={item.id}
            accessibilityLabel={item.label}
            onContextMenu={(event) => void openRowMenu(item.id, event)}
            onError={(cause) => reportError("Sidebar", cause)}
          >
            <Text style={styles.row} numberOfLines={1}>
              {item.label}
            </Text>
          </SidebarItem>
        ))}
      </Sidebar>
    </View>
  );
}

function sidebarStyles(scheme: Scheme) {
  return StyleSheet.create({
    pane: { flex: 1, paddingTop: space.section },
    brand: { flexDirection: "row", alignItems: "center", gap: space.element, paddingHorizontal: space.group, paddingBottom: space.stack },
    mark: { width: target, height: target },
    brandName: { ...textStyle("title"), color: color("text", scheme) },
    list: { flex: 1 },
    row: { ...textStyle("label"), color: color("text", scheme), paddingHorizontal: space.element },
  });
}
