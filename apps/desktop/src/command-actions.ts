/**
 * Handlers for the command registry, keyed by `CommandId`.
 *
 * Separate from `commands.ts` because these reach native modules (NSOpenPanel,
 * NSAlert, NSWorkspace, Spark windows); `satisfies Record<CommandId, …>` keeps
 * the two tables in step at compile time. Every handler reports failure to the
 * shell store; none fails silently.
 * SOT: apps/desktop/src/commands.ts · docs/desktop/seams/D02.md
 * SOT-KEYWORDS: desktop command handlers menu actions dialogs settings window
 */
import { openFileDialog, showMessage } from "@legendapp/spark/dialogs";
import { openURL } from "@legendapp/spark/links";
import { COMMANDS, isCommandId, type CommandId, type WorkspaceRole } from "./commands";
import { focusCommandSearch } from "./command-search-focus";
import { describeNitroProbe, probeNitro } from "./nitro-readiness";
import { useShellStore } from "./store";
import { openSettingsWindow } from "./windows";

/** Public FAQ on the marketing site (apps/web-vite/src/routes/faq.tsx on main). */
const HELP_URL = "https://moyolearn.com/faq";
/** Support inbox named on the contact page (apps/web-vite/src/copy/content-pages.ts EMAIL). */
const REPORT_URL = "mailto:info@moyolearn.com?subject=Moyo%20Learn%20for%20Mac%3A%20problem%20report";
/** NSOpenPanel allow-list. macOS merges filter groups into one set. */
const RESOURCE_FILTERS = [
  { name: "Images", extensions: ["png", "jpg", "jpeg", "heic", "gif", "tiff", "webp"] },
  { name: "PDF", extensions: ["pdf"] },
] as const;

function report(source: string) {
  return (cause: unknown) => useShellStore.getState().reportError(source, cause);
}

export async function chooseResource(): Promise<void> {
  const store = useShellStore.getState();
  try {
    const result = await openFileDialog({ title: "Choose a Resource", multiple: false, filters: RESOURCE_FILTERS });
    if (result.canceled) return;
    // Keep the base name only. No path is persisted and the file is never read.
    const name = result.paths[0]?.split(/[\\/]/).pop();
    if (!name) return;
    store.setResourceName(name);
    store.setSection("resources");
    store.dismissError();
  } catch (cause) {
    report(COMMANDS["file.chooseResource"].label)(cause);
  }
}

async function showRuntimeDiagnostics(): Promise<void> {
  try {
    await showMessage({ title: "Runtime Diagnostics", message: describeNitroProbe(probeNitro()), kind: "info" });
  } catch (cause) {
    report("Runtime Diagnostics")(cause);
  }
}

function switchWorkspace(role: WorkspaceRole): void {
  useShellStore.getState().setActiveRole(role);
}

const HANDLERS = {
  "app.settings": () => void openSettingsWindow().catch(report("Settings")),
  "file.chooseResource": () => void chooseResource(),
  "file.clearResource": () => useShellStore.getState().setResourceName(null),
  "view.toggleSidebar": () => useShellStore.getState().toggleSidebar(),
  "view.toggleCompact": () => {
    const store = useShellStore.getState();
    store.setDensity(store.density === "compact" ? "comfortable" : "compact");
  },
  "view.section.workspace": () => useShellStore.getState().setSection("workspace"),
  "view.section.resources": () => useShellStore.getState().setSection("resources"),
  "view.findCommand": () => focusCommandSearch(),
  "workspace.learner": () => switchWorkspace("learner"),
  "workspace.guardian": () => switchWorkspace("guardian"),
  "workspace.tutor": () => switchWorkspace("tutor"),
  "workspace.org": () => switchWorkspace("org"),
  "workspace.district": () => switchWorkspace("district"),
  "help.help": () => void openURL(HELP_URL).catch(report("Moyo Learn FAQ")),
  "help.report": () => void openURL(REPORT_URL).catch(report("Report a Problem")),
  "help.diagnostics": () => void showRuntimeDiagnostics(),
} as const satisfies Record<CommandId, () => void>;

export function runCommand(id: CommandId): void {
  HANDLERS[id]();
}

/** Menu and context-menu item ids are command ids; anything else is ignored. */
export function runCommandItem(itemId: string): void {
  if (isCommandId(itemId)) runCommand(itemId);
}
