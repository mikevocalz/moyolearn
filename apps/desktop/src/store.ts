/**
 * Desktop shell UI state (Zustand). The only store in apps/desktop.
 *
 * Holds view state for the windows: active section, layout density, sidebar
 * visibility, appearance, the command-search query, the session's workspace
 * roles, the name and SHA-256 of a file the user picked, the macOS thermal
 * state, and the last native-control error.
 * Every Spark window renders from this one JS runtime, so the Settings window
 * and the main window read the same store.
 *
 * Persisted (through `@legendapp/spark/settings`, a JSON file under the app's
 * data directory): appearance, density and sidebar visibility. App.tsx waits
 * for rehydration before the first paint (`hydrated`), so a stored
 * Dark appearance never flashes Light first. Section, query,
 * resource name, roles and errors are per launch. No credentials, learner
 * records or school data live here; the session arrives with PR-D04 and fills
 * `sessionRoles` from server claims, never from this store's own input.
 * SOT: apps/desktop/src/store.ts · docs/desktop/seams/D02.md
 * SOT-KEYWORDS: desktop zustand shell store section density appearance roles persist
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { settings } from "@legendapp/spark/settings";
import type { ThermalState } from "moyo-desktop-core";
import type { WorkspaceRole } from "./commands";
import { isDensity, type DesktopDensity, type DesktopSection } from "./layout";

export type ShellError = { readonly source: string; readonly message: string };
export type AppearancePreference = "system" | "light" | "dark";
/**
 * SHA-256 of the chosen resource, computed on this Mac by MoyoDesktopCore.
 * command-actions.ts drops results from superseded picks before they get here.
 */
export type ResourceFingerprint =
  | { readonly status: "pending" }
  | { readonly status: "ready"; readonly sha256: string }
  | { readonly status: "failed"; readonly message: string };

interface ShellState {
  section: DesktopSection;
  density: DesktopDensity;
  appearance: AppearancePreference;
  sidebarVisible: boolean;
  query: string;
  /** Roles from the signed-in session. Empty while signed out. */
  sessionRoles: readonly WorkspaceRole[];
  /** The workspace the window shows; always one of `sessionRoles` or null. */
  activeRole: WorkspaceRole | null;
  /** Base name only. The absolute path is never stored, read or uploaded. */
  resourceName: string | null;
  resourceFingerprint: ResourceFingerprint | null;
  /** Last value from MoyoDesktopCore's thermal listener; null until the first read. */
  thermalState: ThermalState | null;
  error: ShellError | null;
  /** Persisted settings have been read (or the read failed and defaults stand). */
  hydrated: boolean;
  setSection: (section: DesktopSection) => void;
  setDensity: (density: DesktopDensity) => void;
  setAppearance: (appearance: AppearancePreference) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setQuery: (query: string) => void;
  setSessionRoles: (roles: readonly WorkspaceRole[]) => void;
  setActiveRole: (role: WorkspaceRole) => void;
  setResourceName: (name: string | null) => void;
  setResourceFingerprint: (fingerprint: ResourceFingerprint | null) => void;
  setThermalState: (state: ThermalState) => void;
  reportError: (source: string, cause: unknown) => void;
  dismissError: () => void;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const SETTINGS_KEY = "moyo-shell";

const PERSISTED_DEFAULTS = { density: "comfortable", appearance: "system", sidebarVisible: true } as const;
type PersistedShell = { density: DesktopDensity; appearance: AppearancePreference; sidebarVisible: boolean };

function isAppearance(value: unknown): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Rehydrated values come from a file on disk, so each one is checked before it
 * reaches `Select` or `Appearance.setColorScheme`, both of which throw on an
 * unknown value at render. Anything invalid falls back to its default.
 */
function validPersisted(value: unknown): PersistedShell {
  const record = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    density: typeof record.density === "string" && isDensity(record.density) ? record.density : PERSISTED_DEFAULTS.density,
    appearance: isAppearance(record.appearance) ? record.appearance : PERSISTED_DEFAULTS.appearance,
    sidebarVisible: typeof record.sidebarVisible === "boolean" ? record.sidebarVisible : PERSISTED_DEFAULTS.sidebarVisible,
  };
}

/**
 * Zustand's async storage contract over Spark's settings file store.
 * Persist calls `setItem` on every `set`, including search keystrokes, so an
 * unchanged value is not rewritten. A failed write is reported once per
 * message; reporting sets `error`, which is not persisted, so it cannot loop.
 */
let lastWritten: string | null = null;
const sparkSettingsStorage: StateStorage = {
  async getItem(name) {
    const value = await settings.get(name);
    lastWritten = typeof value === "string" ? value : null;
    return lastWritten;
  },
  async setItem(name, value) {
    if (value === lastWritten) return;
    try {
      await settings.set(name, value);
      lastWritten = value;
    } catch (cause) {
      const store = useShellStore.getState();
      const message = cause instanceof Error ? cause.message : String(cause);
      if (store.error?.message !== message) store.reportError("Settings", cause);
    }
  },
  async removeItem(name) {
    await settings.remove(name);
    lastWritten = null;
  },
};

export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      section: "workspace",
      ...PERSISTED_DEFAULTS,
      query: "",
      sessionRoles: [],
      activeRole: null,
      resourceName: null,
      resourceFingerprint: null,
      thermalState: null,
      error: null,
      hydrated: false,
      setSection: (section) => set({ section }),
      setDensity: (density) => set({ density }),
      setAppearance: (appearance) => set({ appearance }),
      toggleSidebar: () => set({ sidebarVisible: !get().sidebarVisible }),
      setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
      setQuery: (query) => set({ query }),
      setSessionRoles: (sessionRoles) => {
        const activeRole = get().activeRole;
        set({
          sessionRoles,
          activeRole: activeRole && sessionRoles.includes(activeRole) ? activeRole : (sessionRoles[0] ?? null),
        });
      },
      setActiveRole: (role) => {
        if (get().sessionRoles.includes(role)) set({ activeRole: role });
      },
      setResourceName: (resourceName) => set({ resourceName }),
      setResourceFingerprint: (resourceFingerprint) => set({ resourceFingerprint }),
      setThermalState: (thermalState) => set({ thermalState }),
      reportError: (source, cause) => set({ error: { source, message: messageOf(cause) } }),
      dismissError: () => set({ error: null }),
    }),
    {
      name: SETTINGS_KEY,
      storage: createJSONStorage(() => sparkSettingsStorage),
      partialize: (state): PersistedShell => ({
        density: state.density,
        appearance: state.appearance,
        sidebarVisible: state.sidebarVisible,
      }),
      merge: (persisted, current) => ({ ...current, ...validPersisted(persisted) }),
      // Runs after a read and after a failed read; zustand leaves
      // `persist.hasHydrated()` false on failure, so the window gates on `hydrated`.
      onRehydrateStorage: () => (_state, error) => {
        if (error) useShellStore.getState().reportError("Settings", error);
        useShellStore.setState({ hydrated: true });
      },
    },
  ),
);

