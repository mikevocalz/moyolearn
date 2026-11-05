/**
 * Desktop command registry: one definition per command.
 *
 * The menu bar, the sidebar context menus, the toolbar command search and the
 * focused shortcuts all read this table, so a label, shortcut or role gate is
 * written once. Handlers live in `command-actions.ts`, keyed by the same
 * `CommandId` with `satisfies Record<CommandId, …>`, because they reach native
 * modules; this file has type-only imports so `node --test` can load it
 * without React Native (scripts/commands.test.mjs).
 *
 * Role gate: a command with `roles` is visible only when the signed-in session
 * holds one of them. With no session every gated command is hidden. PR-D04
 * supplies session roles; until then the Workspace menu shows one disabled
 * line saying sign-in is required.
 *
 * Strikes recorded 2026-11-04 (PR-D02), each returns with the PR that ships
 * its backing object:
 * - File > New Session, Import Image…: no tutoring session or capture flow
 *   exists on desktop until PR-D05.
 * - View > Zoom (content scale): needs a type-scale contract from the
 *   design-system pass; macOS window zoom stays in the Window menu.
 * - Sidebar Rename / Archive / Move… and whiteboard object menus: the sidebar
 *   holds sections, not user-owned objects, until PR-D05.
 * - Detached Session Report window: no session data until PR-D05. The second
 *   window this PR ships is Settings.
 * SOT: docs/desktop/seams/D02.md · Moyo Learn Desktop PR pack §PR-D02
 * SOT-KEYWORDS: desktop commands registry role gate menu shortcut workspace
 */

export const WORKSPACE_ROLES = ["learner", "guardian", "tutor", "org", "district"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_LABELS = {
  learner: "Learner",
  guardian: "Guardian",
  tutor: "Tutor",
  org: "Organization",
  district: "District",
} as const satisfies Record<WorkspaceRole, string>;

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/** Where a command appears. `palette` is the toolbar command search. */
export type CommandSurface = "menu" | "palette" | "context";

export interface CommandDefinition {
  readonly label: string;
  /** Spark accelerator string (`parseAccelerator` in spark-desktop-app contracts/accelerator.ts). */
  readonly shortcut?: string;
  /** Visible only to sessions holding one of these roles. Omitted means everyone. */
  readonly roles?: readonly WorkspaceRole[];
  readonly surfaces: readonly CommandSurface[];
}

export const COMMANDS = {
  "app.settings": { label: "Settings…", shortcut: "Cmd+,", surfaces: ["menu", "palette"] },
  "file.chooseResource": { label: "Choose Resource…", shortcut: "Cmd+O", surfaces: ["menu", "palette", "context"] },
  "file.clearResource": { label: "Clear Resource", surfaces: ["palette", "context"] },
  // The host storyboard's View > Show Sidebar (⌃⌘S, `toggleSidebar:`) already
  // drives the AppKit split view, so this entry is search-only and claims no key.
  "view.toggleSidebar": { label: "Show or Hide Sidebar", surfaces: ["palette"] },
  "view.toggleCompact": { label: "Compact Layout", surfaces: ["menu", "palette", "context"] },
  "view.section.workspace": { label: "Workspace", shortcut: "Cmd+1", surfaces: ["menu", "palette", "context"] },
  "view.section.resources": { label: "Resources", shortcut: "Cmd+2", surfaces: ["menu", "palette", "context"] },
  "view.findCommand": { label: "Find Command", shortcut: "Cmd+K", surfaces: [] },
  "workspace.learner": { label: ROLE_LABELS.learner, roles: ["learner"], surfaces: ["menu", "palette"] },
  "workspace.guardian": { label: ROLE_LABELS.guardian, roles: ["guardian"], surfaces: ["menu", "palette"] },
  "workspace.tutor": { label: ROLE_LABELS.tutor, roles: ["tutor"], surfaces: ["menu", "palette"] },
  "workspace.org": { label: ROLE_LABELS.org, roles: ["org"], surfaces: ["menu", "palette"] },
  "workspace.district": { label: ROLE_LABELS.district, roles: ["district"], surfaces: ["menu", "palette"] },
  // The host's own "Moyo Learn Help" (showHelp:) stays: Spark 0.0.2 gives it no
  // role to retarget, and there is no Help Book yet. This item opens the web FAQ.
  "help.help": { label: "Moyo Learn FAQ", surfaces: ["menu", "palette"] },
  "help.report": { label: "Report a Problem…", surfaces: ["menu", "palette"] },
  "help.diagnostics": { label: "Runtime Diagnostics…", surfaces: ["menu", "palette"] },
} as const satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof COMMANDS;

export const WORKSPACE_COMMANDS = {
  learner: "workspace.learner",
  guardian: "workspace.guardian",
  tutor: "workspace.tutor",
  org: "workspace.org",
  district: "workspace.district",
} as const satisfies Record<WorkspaceRole, CommandId>;

export function isCommandId(value: string): value is CommandId {
  return Object.prototype.hasOwnProperty.call(COMMANDS, value);
}

export function commandOf(id: CommandId): CommandDefinition {
  return COMMANDS[id];
}

/** The role gate. `sessionRoles` is empty when nobody is signed in. */
export function isCommandVisible(id: CommandId, sessionRoles: readonly WorkspaceRole[]): boolean {
  const roles: readonly WorkspaceRole[] | undefined = (COMMANDS[id] as CommandDefinition).roles;
  if (roles === undefined) return true;
  return roles.some((role) => sessionRoles.includes(role));
}

/** Commands for a surface after the role gate, in registry order. */
export function visibleCommands(surface: CommandSurface, sessionRoles: readonly WorkspaceRole[]): CommandId[] {
  return (Object.keys(COMMANDS) as CommandId[]).filter(
    (id) => (COMMANDS[id].surfaces as readonly CommandSurface[]).includes(surface) && isCommandVisible(id, sessionRoles),
  );
}

/** Case-insensitive label match for the toolbar command search. */
export function searchCommands(query: string, sessionRoles: readonly WorkspaceRole[]): CommandId[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return visibleCommands("palette", sessionRoles).filter((id) => COMMANDS[id].label.toLowerCase().includes(needle));
}

const KEY_GLYPHS: Record<string, string> = { cmd: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" };

/** Apple's glyph order (⌃⌥⇧⌘) for shortcut hints shown next to command labels. */
export function shortcutHint(shortcut: string): string {
  const parts = shortcut.split("+");
  const key = parts.pop() ?? "";
  const order = ["ctrl", "alt", "shift", "cmd"];
  const modifiers = parts.map((part) => part.toLowerCase()).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return modifiers.map((part) => KEY_GLYPHS[part] ?? "").join("") + key.toUpperCase();
}
