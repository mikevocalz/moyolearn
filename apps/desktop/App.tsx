/**
 * Moyo Learn desktop shell: brand mark, shared tokens, native toolbar and an
 * empty workspace. React Native views rendered by Hermes in a Spark window.
 *
 * PR-D01 scope is the shell only. Sign-in, roles and learning surfaces are out
 * of scope (PR-D04, PR-D05), so the workspace says where that work happens
 * today and opens it, instead of rendering placeholder cards.
 * The Mobbin structure pass for this window has not run yet (see PR body).
 * SOT: docs/desktop/seams/SEAMS.md · packages/theme/tokens.ts
 * SOT-KEYWORDS: desktop app shell sidebar workspace empty-state spark
 */
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { openURL } from "@legendapp/spark/links";
import { Button as NativeButton } from "@legendapp/spark/ui";
import { contentWidths, navChrome } from "../../packages/theme/tokens";
import { DESKTOP_SECTIONS, sectionById, type DesktopSection } from "./src/layout";
import { DesktopNativeMenus, NativeWorkspaceToolbar, chooseResource } from "./src/native-menus";
import { useShellStore } from "./src/store";
import { color, corner, space, target, textStyle, toPoints, useScheme, type Scheme } from "./src/theme";

/** Same origin mobile ships to (apps/mobile/eas.json EXPO_PUBLIC_APP_URL). */
const WEB_APP_URL = "https://app.moyolearn.com";

function Sidebar({ scheme }: { scheme: Scheme }) {
  const section = useShellStore((state) => state.section);
  const setSection = useShellStore((state) => state.setSection);
  const styles = sidebarStyles(scheme);
  return (
    <View style={styles.sidebar} accessibilityLabel="Sections">
      <View style={styles.brand}>
        <Image
          source={require("./assets/mark.png")}
          style={styles.mark}
          resizeMode="contain"
          accessibilityLabel="Moyo Learn"
        />
        <Text style={styles.brandName}>Moyo Learn</Text>
      </View>
      {DESKTOP_SECTIONS.map((item) => {
        const active = item.id === section;
        return (
          <Pressable
            key={item.id}
            onPress={() => setSection(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ErrorNotice({ scheme }: { scheme: Scheme }) {
  const error = useShellStore((state) => state.error);
  const dismiss = useShellStore((state) => state.dismissError);
  if (!error) return null;
  const styles = contentStyles(scheme);
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text style={styles.body} selectable>
        {error.source}: {error.message}
      </Text>
      <NativeButton
        variant="bordered"
        onPress={dismiss}
        onError={(cause) => useShellStore.getState().reportError("Dismiss", cause)}
      >
        Dismiss
      </NativeButton>
    </View>
  );
}

function WorkspaceEmpty({ scheme }: { scheme: Scheme }) {
  const reportError = useShellStore((state) => state.reportError);
  const styles = contentStyles(scheme);
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Nothing to show here yet</Text>
      <Text style={styles.body}>
        Lessons, tutoring and classrooms run in Moyo Learn on the web and on your phone.
        They move into this window once desktop sign-in is ready.
      </Text>
      <NativeButton
        variant="bordered"
        onPress={() => {
          openURL(WEB_APP_URL).catch((cause) => reportError("Open in Browser", cause));
        }}
        onError={(cause) => reportError("Open in Browser", cause)}
      >
        Open Moyo Learn on the Web
      </NativeButton>
    </View>
  );
}

function ResourcesPanel({ scheme }: { scheme: Scheme }) {
  const resourceName = useShellStore((state) => state.resourceName);
  const styles = contentStyles(scheme);
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{resourceName ?? "No file chosen"}</Text>
      <Text style={styles.body}>
        Moyo Learn shows the file name only. It does not open, read or upload the file.
      </Text>
      <NativeButton
        variant="bordered"
        onPress={() => void chooseResource()}
        onError={(cause) => useShellStore.getState().reportError("Choose Resource", cause)}
      >
        Choose Resource…
      </NativeButton>
    </View>
  );
}

function SectionBody({ section, scheme }: { section: DesktopSection; scheme: Scheme }) {
  if (section === "resources") return <ResourcesPanel scheme={scheme} />;
  return <WorkspaceEmpty scheme={scheme} />;
}

export default function App() {
  const scheme = useScheme();
  const section = useShellStore((state) => state.section);
  const density = useShellStore((state) => state.density);
  const styles = contentStyles(scheme);
  const current = sectionById(section);
  return (
    <View style={styles.root}>
      <DesktopNativeMenus />
      <Sidebar scheme={scheme} />
      <ScrollView
        style={styles.main}
        contentContainerStyle={[styles.content, density === "compact" && styles.contentCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <NativeWorkspaceToolbar />
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={styles.title}>
            {current.label}
          </Text>
          <Text style={styles.subtitle}>{current.description}</Text>
        </View>
        <ErrorNotice scheme={scheme} />
        <SectionBody section={section} scheme={scheme} />
      </ScrollView>
    </View>
  );
}

function sidebarStyles(scheme: Scheme) {
  return StyleSheet.create({
    sidebar: {
      width: toPoints(navChrome.railExpanded),
      paddingVertical: space.group,
      paddingHorizontal: space.element,
      gap: space.hair,
      backgroundColor: color("surface-stage", scheme),
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.element,
      paddingHorizontal: space.element,
      paddingBottom: space.group,
    },
    mark: { width: target, height: target },
    brandName: { ...textStyle("title"), color: color("on-surface-stage", scheme) },
    item: {
      minHeight: target,
      justifyContent: "center",
      paddingHorizontal: space.stack,
      borderRadius: corner.control,
    },
    itemActive: { backgroundColor: color("primary", scheme) },
    itemLabel: { ...textStyle("label"), color: color("on-surface-stage", scheme) },
    itemLabelActive: { color: color("on-primary", scheme) },
  });
}

function contentStyles(scheme: Scheme) {
  return StyleSheet.create({
    root: { flex: 1, flexDirection: "row", backgroundColor: color("surface", scheme) },
    main: { flex: 1 },
    content: { padding: space.section, gap: space.group },
    contentCompact: { padding: space.group, gap: space.stack },
    titleGroup: { gap: space.hair },
    title: { ...textStyle("title-lg"), color: color("text", scheme) },
    subtitle: { ...textStyle("body"), color: color("text-muted", scheme) },
    panel: {
      alignItems: "flex-start",
      gap: space.stack,
      padding: space.roomy,
      borderRadius: corner.card,
      backgroundColor: color("surface-raised", scheme),
    },
    heading: { ...textStyle("title"), color: color("text", scheme) },
    body: { ...textStyle("body"), color: color("text-muted", scheme), maxWidth: toPoints(contentWidths["content-feed"]) },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.stack,
      padding: space.tight,
      borderRadius: corner.card,
      backgroundColor: color("surface-sunken", scheme),
    },
  });
}
