/**
 * The macOS menu bar, focused shortcuts and appearance sync, all derived from
 * the command registry and the shell store.
 *
 * AppKit objects behind each call (confirmed in vendored native sources):
 *   useMenu          -> NSApplication main menu (spark-native-menu RNNativeMenu.mm)
 *   registerShortcut -> focused-app key monitor (spark-desktop-shortcuts)
 *   Appearance.setColorScheme -> NSApp.appearance (react-native-macos RCTAppearance.mm)
 *   addThermalStateListener   -> ProcessInfo thermal notification (moyo-desktop-core, Nitro)
 *
 * Existing host items are re-bound rather than duplicated: Settings… takes the
 * storyboard's ⌘, item (`target: { role: "settings" }`) and Choose Resource…
 * takes File > Open… (`target: { role: "open" }`), so each key equivalent has
 * one owner. View > Show Sidebar stays the host's item; the split view in
 * App.tsx answers its `toggleSidebar:` action. Edit and Window are untouched
 * system menus.
 * SOT: apps/desktop/src/commands.ts · docs/desktop/seams/D02.md
 * SOT-KEYWORDS: desktop menu bar nsmenu shortcuts appearance workspace role spark
 */
import { useEffect, useMemo } from "react";
import { Appearance } from "react-native";
import { useMenu, type MenuItem, type MenuRootItem } from "@legendapp/spark/menus";
import { getShortcutAvailability, registerShortcut } from "@legendapp/spark/shortcuts";
import { runCommand, runCommandItem } from "./command-actions";
import { loadDesktopCore } from "./desktop-core";
import {
  COMMANDS,
  WORKSPACE_COMMANDS,
  WORKSPACE_ROLES,
  isCommandVisible,
  type CommandId,
  type WorkspaceRole,
} from "./commands";
import { useShellStore } from "./store";

function action(id: CommandId, extra: Partial<Extract<MenuItem, { type: "action" }>> = {}): MenuItem {
  const command: { label: string; shortcut?: string } = COMMANDS[id];
  return {
    type: "action",
    id,
    label: command.label,
    ...(command.shortcut ? { shortcut: command.shortcut } : {}),
    ...extra,
  };
}

function workspaceItems(sessionRoles: readonly WorkspaceRole[], activeRole: WorkspaceRole | null): MenuItem[] {
  if (sessionRoles.length === 0) {
    return [{ type: "action", id: "workspace-signed-out", label: "Sign In to Switch Workspaces", disabled: true }];
  }
  return WORKSPACE_ROLES.map((role) => {
    const id = WORKSPACE_COMMANDS[role];
    return {
      type: "checkbox" as const,
      id,
      label: COMMANDS[id].label,
      checked: activeRole === role,
      hidden: !isCommandVisible(id, sessionRoles),
    };
  });
}

function buildMenuBar(state: {
  density: string;
  sessionRoles: readonly WorkspaceRole[];
  activeRole: WorkspaceRole | null;
}): MenuRootItem[] {
  return [
    {
      type: "submenu",
      id: "moyo-app",
      label: "Moyo Learn",
      target: { menu: "app" },
      items: [action("app.settings", { target: { role: "settings" } })],
    },
    {
      type: "submenu",
      id: "moyo-file",
      label: "File",
      target: { menu: "file" },
      items: [action("file.chooseResource", { target: { role: "open" } })],
    },
    {
      type: "submenu",
      id: "moyo-view",
      label: "View",
      target: { menu: "view" },
      items: [
        { type: "separator" },
        action("view.section.workspace"),
        action("view.section.resources"),
        { type: "separator" },
        { type: "checkbox", id: "view.toggleCompact", label: COMMANDS["view.toggleCompact"].label, checked: state.density === "compact" },
      ],
    },
    {
      type: "submenu",
      id: "moyo-workspace",
      label: "Workspace",
      placement: { before: { menu: "window" } },
      items: workspaceItems(state.sessionRoles, state.activeRole),
    },
    {
      type: "submenu",
      id: "moyo-help",
      label: "Help",
      target: { menu: "help" },
      items: [action("help.help"), action("help.report"), { type: "separator" }, action("help.diagnostics")],
    },
  ];
}

/** Publishes the menu bar and focused shortcuts; keeps NSApp.appearance in step. Renders nothing. */
export function DesktopShellControllers() {
  const density = useShellStore((state) => state.density);
  const sessionRoles = useShellStore((state) => state.sessionRoles);
  const activeRole = useShellStore((state) => state.activeRole);
  const appearance = useShellStore((state) => state.appearance);
  const items = useMemo(() => buildMenuBar({ density, sessionRoles, activeRole }), [density, sessionRoles, activeRole]);

  useMenu({
    id: "moyo-desktop-menu",
    items,
    onAction: ({ itemId }) => runCommandItem(itemId),
    onError: (cause) => useShellStore.getState().reportError("Menu bar", cause),
    onCleanupError: (cause) => useShellStore.getState().reportError("Menu bar", cause),
  });

  useEffect(() => {
    Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
  }, [appearance]);

  // Thermal pressure feeds the store for PR-D05 surfaces (docs/desktop/handoff/D03.md).
  // A missing HybridObject leaves `thermalState` null; Runtime Diagnostics says why.
  useEffect(() => {
    const probe = loadDesktopCore();
    if (!probe.available) return;
    const store = useShellStore.getState();
    try {
      // The listener also delivers the current state first; this read only
      // fills the store before that first callback crosses to the JS thread.
      store.setThermalState(probe.core.getPlatformInfo().thermalState);
      const subscription = probe.core.addThermalStateListener((state) => useShellStore.getState().setThermalState(state));
      return () => {
        try {
          subscription.remove();
        } catch (cause) {
          useShellStore.getState().reportError("Thermal state", cause);
        }
      };
    } catch (cause) {
      store.reportError("Thermal state", cause);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!getShortcutAvailability().available) return;
    const shortcut = COMMANDS["view.findCommand"].shortcut;
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    registerShortcut(shortcut, () => runCommand("view.findCommand"), { windowId: "main" })
      .then((registration) => {
        if (disposed) void registration.remove();
        else remove = () => registration.remove();
      })
      .catch((cause) => useShellStore.getState().reportError("Find Command shortcut", cause));
    return () => {
      disposed = true;
      remove?.().catch((cause) => useShellStore.getState().reportError("Find Command shortcut", cause));
    };
  }, []);

  return null;
}
