/**
 * Window toolbar: Workspace and Layout pop-up buttons and the command search.
 *
 * Controls: NSPopUpButton (`Select`), NSSearchField (`TextInputSearch`) and
 * NSButton (`Button`) from Spark 0.0.2. Search results are an inline list of
 * rows under the toolbar, in the content flow (like a table, not a menu), so
 * nothing here imitates a menu with a positioned overlay. Rows are Pressables
 * because NSButton has no intrinsic size Yoga can measure (spark-ui desktop.tsx
 * fixes it at 160×36) and centers its title. ⌘K focuses the field when the
 * shortcut module is in the runtime; the label only advertises ⌘K then.
 *
 * The Workspace pop-up lists the session's roles. Signed out (all of PR-D02),
 * it is disabled and says so; PR-D04 fills `sessionRoles`.
 * Structure (docs/desktop/mobbin/D02.md): Fibery and Snowflake put the
 * role switch in a dedicated control with the current one marked; Linear puts
 * search on the header row.
 * SOT: apps/desktop/src/commands.ts · docs/desktop/handoff/D02.md
 * SOT-KEYWORDS: desktop toolbar workspace select search command palette nssearchfield
 */
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getShortcutAvailability } from "@legendapp/spark/shortcuts";
import { Select as NativeSelect, getControlAvailability } from "@legendapp/spark/ui";
import { TextInputSearch, getSearchAvailability, type TextInputSearchRef } from "@legendapp/spark/ui/search";
import { runCommand } from "./command-actions";
import { registerCommandSearch } from "./command-search-focus";
import {
  COMMANDS,
  ROLE_LABELS,
  isWorkspaceRole,
  searchCommands,
  shortcutHint,
  type CommandId,
} from "./commands";
import { isDensity } from "./layout";
import { useShellStore } from "./store";
import { color, corner, space, textStyle, useScheme, type Scheme } from "./theme";

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] as const;
const SIGNED_OUT_OPTION = { value: "signed-out", label: "Not Signed In" } as const;

function resultLabel(id: CommandId, sidebarVisible: boolean): string {
  if (id === "view.toggleSidebar") return sidebarVisible ? "Hide Sidebar" : "Show Sidebar";
  return COMMANDS[id].label;
}

function CommandResults({ scheme }: { scheme: Scheme }) {
  const query = useShellStore((state) => state.query);
  const sessionRoles = useShellStore((state) => state.sessionRoles);
  const sidebarVisible = useShellStore((state) => state.sidebarVisible);
  const setQuery = useShellStore((state) => state.setQuery);
  const styles = toolbarStyles(scheme);
  if (!query.trim()) return null;
  const results = searchCommands(query, sessionRoles);
  return (
    <View style={styles.results} accessibilityLabel="Matching commands">
      {results.length === 0 ? (
        <Text style={styles.empty} selectable>
          No command matches “{query.trim()}”.
        </Text>
      ) : (
        results.map((id) => {
          const shortcut: string | undefined = (COMMANDS[id] as { shortcut?: string }).shortcut;
          const label = resultLabel(id, sidebarVisible);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={shortcut ? `${label}, ${shortcutHint(shortcut)}` : label}
              onPress={() => {
                setQuery("");
                runCommand(id);
              }}
              style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
            >
              <Text style={styles.resultLabel} numberOfLines={1}>
                {label}
              </Text>
              {shortcut ? <Text style={styles.resultShortcut}>{shortcutHint(shortcut)}</Text> : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

export function WorkspaceToolbar() {
  const scheme = useScheme();
  const density = useShellStore((state) => state.density);
  const sessionRoles = useShellStore((state) => state.sessionRoles);
  const activeRole = useShellStore((state) => state.activeRole);
  const query = useShellStore((state) => state.query);
  const setDensity = useShellStore((state) => state.setDensity);
  const setActiveRole = useShellStore((state) => state.setActiveRole);
  const setQuery = useShellStore((state) => state.setQuery);
  const reportError = useShellStore((state) => state.reportError);
  const selectAvailable = getControlAvailability("select").available;
  const searchAvailable = getSearchAvailability().available;
  const findShortcut = getShortcutAvailability().available ? ` (${shortcutHint(COMMANDS["view.findCommand"].shortcut)})` : "";
  const signedIn = sessionRoles.length > 0;
  const workspaceOptions = signedIn
    ? sessionRoles.map((role) => ({ value: role, label: ROLE_LABELS[role] }))
    : [SIGNED_OUT_OPTION];
  const searchRef = useCallback((ref: TextInputSearchRef | null) => registerCommandSearch(ref), []);
  const styles = toolbarStyles(scheme);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar} accessible={false} accessibilityRole="toolbar" accessibilityLabel="Workspace toolbar">
        <View style={styles.field}>
          <Text style={styles.label}>Workspace</Text>
          <NativeSelect
            testID="desktop-workspace-select"
            options={workspaceOptions}
            value={signedIn && activeRole ? activeRole : SIGNED_OUT_OPTION.value}
            disabled={!selectAvailable || !signedIn}
            accessibilityLabel={signedIn ? "Workspace" : "Workspace, sign in to switch"}
            onValueChange={(value) => {
              if (isWorkspaceRole(value)) setActiveRole(value);
            }}
            onError={(cause) => reportError("Workspace menu", cause)}
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
            onError={(cause) => reportError("Layout menu", cause)}
          />
        </View>
        <View style={[styles.field, styles.searchField]}>
          <Text style={styles.label}>Find Command{findShortcut}</Text>
          <TextInputSearch
            ref={searchRef}
            testID="desktop-command-search"
            placeholder="Search commands"
            accessibilityLabel="Search commands"
            value={query}
            disabled={!searchAvailable}
            onChangeText={setQuery}
            onError={(cause) => reportError("Command search", cause)}
            style={styles.search}
          />
        </View>
      </View>
      <CommandResults scheme={scheme} />
    </View>
  );
}

function toolbarStyles(scheme: Scheme) {
  return StyleSheet.create({
    wrap: { gap: space.hair },
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
    searchField: { flexGrow: 1 },
    search: { minWidth: space.section * 6 },
    label: { ...textStyle("caption"), color: color("text-muted", scheme) },
    results: {
      alignItems: "stretch",
      gap: space.hair,
      padding: space.tight,
      borderRadius: corner.card,
      backgroundColor: color("surface-raised", scheme),
    },
    empty: { ...textStyle("body"), color: color("text-muted", scheme) },
    result: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.stack,
      minHeight: space.section,
      paddingHorizontal: space.tight,
      borderRadius: corner.control,
    },
    resultPressed: { backgroundColor: color("surface-sunken", scheme) },
    resultLabel: { ...textStyle("body"), color: color("text", scheme), flexShrink: 1 },
    resultShortcut: { ...textStyle("caption"), color: color("text-muted", scheme), fontVariant: ["tabular-nums"] },
  });
}
