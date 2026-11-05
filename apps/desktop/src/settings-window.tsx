/**
 * Settings window (⌘,): appearance and layout density.
 *
 * Mac settings apply as they change, so there is no Save button and nothing
 * can be left unsaved. Appearance and Layout are NSPopUpButtons bound to the
 * shell store, persisted through `@legendapp/spark/settings`. Signed in, the
 * Plan section (plan-section.tsx, PR-D04) follows.
 * Structure (Mobbin pass, docs/desktop/mobbin/D02.md): Todoist and Height keep
 * settings in their own window with labelled rows; Moyo has two preferences,
 * so it is one pane with no category list.
 * SOT: apps/desktop/src/store.ts · docs/desktop/handoff/D02.md
 * SOT-KEYWORDS: desktop settings window appearance density nspopupbutton
 */
import { StyleSheet, Text, View } from "react-native";
import { Select as NativeSelect, getControlAvailability } from "@legendapp/spark/ui";
import { isDensity } from "./layout";
import { PlanSection } from "./plan-section";
import { useShellStore, type AppearancePreference } from "./store";
import { color, space, textStyle, useScheme, type Scheme } from "./theme";

const APPEARANCE_OPTIONS = [
  { value: "system", label: "Match System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;
const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] as const;

function isAppearance(value: string): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function SettingsWindow() {
  const scheme = useScheme();
  const appearance = useShellStore((state) => state.appearance);
  const density = useShellStore((state) => state.density);
  const setAppearance = useShellStore((state) => state.setAppearance);
  const setDensity = useShellStore((state) => state.setDensity);
  const reportError = useShellStore((state) => state.reportError);
  const selectAvailable = getControlAvailability("select").available;
  const styles = settingsStyles(scheme);
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.label}>Appearance</Text>
        <NativeSelect
          options={APPEARANCE_OPTIONS}
          value={appearance}
          disabled={!selectAvailable}
          accessibilityLabel="Appearance"
          onValueChange={(value) => {
            if (isAppearance(value)) setAppearance(value);
          }}
          onError={(cause) => reportError("Appearance", cause)}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Layout</Text>
        <NativeSelect
          options={DENSITY_OPTIONS}
          value={density}
          disabled={!selectAvailable}
          accessibilityLabel="Layout"
          onValueChange={(value) => {
            if (isDensity(value)) setDensity(value);
          }}
          onError={(cause) => reportError("Layout", cause)}
        />
      </View>
      <PlanSection scheme={scheme} />
      {selectAvailable ? null : (
        <Text style={styles.note} selectable>
          Pop-up menus are not available in this runtime, so these settings are read-only.
        </Text>
      )}
    </View>
  );
}

function settingsStyles(scheme: Scheme) {
  return StyleSheet.create({
    root: { flex: 1, padding: space.section, gap: space.group, backgroundColor: color("surface", scheme) },
    row: { flexDirection: "row", alignItems: "center", gap: space.stack },
    label: { ...textStyle("label"), color: color("text", scheme), minWidth: space.section * 4, textAlign: "right" },
    note: { ...textStyle("caption"), color: color("text-muted", scheme) },
  });
}
