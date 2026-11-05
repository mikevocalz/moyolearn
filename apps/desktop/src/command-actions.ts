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
import { signOut } from "./auth/session";
import { describePlatformInfo, loadDesktopCore } from "./desktop-core";
import { describeNitroProbe, probeNitro } from "./nitro-readiness";
import { useShellStore, type ResourceFingerprint } from "./store";
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

/**
 * The current pick. Every pick and every Clear Resource bumps it, and a hash
 * result is applied only while its id is still current, so a slow hash of an
 * earlier file (or of a cleared one) can never reappear.
 */
let fingerprintRequest = 0;

/** Hashes on MoyoDesktopCore's queue; the path lives only for this call. */
async function fingerprint(path: string, requestId: number): Promise<void> {
  const apply = (value: ResourceFingerprint) => {
    if (requestId === fingerprintRequest) useShellStore.getState().setResourceFingerprint(value);
  };
  const probe = loadDesktopCore();
  if (!probe.available) {
    apply({ status: "failed", message: `MoyoDesktopCore is not in this runtime. ${probe.detail}` });
    return;
  }
  try {
    apply({ status: "ready", sha256: await probe.core.hashFile(path) });
  } catch (cause) {
    apply({ status: "failed", message: cause instanceof Error ? cause.message : String(cause) });
  }
}

export async function chooseResource(): Promise<void> {
  const store = useShellStore.getState();
  try {
    const result = await openFileDialog({ title: "Choose a Resource", multiple: false, filters: RESOURCE_FILTERS });
    if (result.canceled) return;
    const path = result.paths[0];
    // Keep the base name only. The path is used once to hash and is never stored or uploaded.
    const name = path?.split(/[\\/]/).pop();
    if (!path || !name) return;
    // Name, pending state and request id change in one synchronous step.
    const requestId = ++fingerprintRequest;
    store.setResourceName(name);
    store.setResourceFingerprint({ status: "pending" });
    store.setSection("resources");
    store.dismissError();
    await fingerprint(path, requestId);
  } catch (cause) {
    report(COMMANDS["file.chooseResource"].label)(cause);
  }
}

function clearResource(): void {
  fingerprintRequest += 1;
  const store = useShellStore.getState();
  store.setResourceName(null);
  store.setResourceFingerprint(null);
}

async function showRuntimeDiagnostics(): Promise<void> {
  try {
    const core = loadDesktopCore();
    const platform = core.available
      ? describePlatformInfo(core.core.getPlatformInfo())
      : `MoyoDesktopCore is not in this runtime.\n${core.detail}`;
    await showMessage({ title: "Runtime Diagnostics", message: `${describeNitroProbe(probeNitro())}\n\n${platform}`, kind: "info" });
  } catch (cause) {
    report("Runtime Diagnostics")(cause);
  }
}

function switchWorkspace(role: WorkspaceRole): void {
  useShellStore.getState().setActiveRole(role);
}

const HANDLERS = {
  "app.settings": () => void openSettingsWindow().catch(report("Settings")),
  "account.signOut": () => void signOut(),
  "file.chooseResource": () => void chooseResource(),
  "file.clearResource": () => clearResource(),
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
