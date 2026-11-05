/**
 * Secondary windows, registered once as their own AppRegistry roots.
 *
 * `createWindowsNavigator` registers `spark.window.<id>` with AppRegistry at
 * module load (spark-desktop-windows createWindowsNavigator.tsx), so this file
 * is imported from index.ts before the main root registers. Settings is the
 * only secondary window in PR-D02; the Session Report window is struck until
 * PR-D05 has session data (see commands.ts).
 * SOT: docs/desktop/seams/D02.md
 * SOT-KEYWORDS: desktop windows navigator settings window appregistry spark
 */
import { SparkError } from "@legendapp/spark/contracts";
import { createWindowsNavigator } from "@legendapp/spark/windows";
import { SettingsWindow } from "./settings-window";

export const windows = createWindowsNavigator({
  settings: {
    id: "settings",
    component: SettingsWindow,
    options: {
      title: "Settings",
      size: { width: 480, height: 300 },
      minSize: { width: 480, height: 300 },
      resizable: false,
      minimizable: false,
    },
  },
});

let settingsRequest: Promise<void> | null = null;

/**
 * One Settings window: a second ⌘, brings the open one forward. Requests are
 * serialized so a double ⌘, before the window exists opens it once.
 */
export function openSettingsWindow(): Promise<void> {
  if (settingsRequest) return settingsRequest;
  settingsRequest = (async () => {
    try {
      await windows.show("settings");
    } catch (cause) {
      if (!(cause instanceof SparkError) || cause.code !== "E_NOT_FOUND") throw cause;
      await windows.open("settings");
    }
  })().finally(() => {
    settingsRequest = null;
  });
  return settingsRequest;
}
