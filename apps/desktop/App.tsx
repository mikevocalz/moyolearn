/**
 * Moyo Learn desktop main window: AppKit split view with the section source
 * list on the left and the toolbar plus the active section on the right.
 *
 * `SidebarSplitView` is an NSSplitView (spark-ui appkit-split-view); it answers
 * the host's View > Show Sidebar (⌃⌘S) itself and reports the change through
 * `onSidebarCollapsedChange`, which the store mirrors. Sign-in, roles and
 * learning surfaces are out of PR-D02 (PR-D04, PR-D05), so the workspace says
 * where that work happens today and opens it.
 * Structure (docs/desktop/mobbin/D02.md): Linear's sidebar order (identity,
 * then sections); Loom's rule that a slot never goes blank.
 * SOT: docs/desktop/seams/D02.md · packages/theme/tokens.ts
 * SOT-KEYWORDS: desktop app shell split view sidebar workspace empty-state spark
 */
import { useEffect } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import { openURL } from "@legendapp/spark/links";
import { Button as NativeButton } from "@legendapp/spark/ui";
import { SidebarSplitView } from "@legendapp/spark/ui/split-view";
import { contentWidths, navChrome } from "../../packages/theme/tokens";
import { chooseResource } from "./src/command-actions";
import { sectionById, type DesktopSection } from "./src/layout";
import { DesktopShellControllers } from "./src/native-menus";
import { SidebarPane } from "./src/sidebar";
import { useShellStore } from "./src/store";
import { WorkspaceToolbar } from "./src/toolbar";
import { color, corner, space, textStyle, toPoints, useScheme, type Scheme } from "./src/theme";

/** Same origin mobile ships to (apps/mobile/eas.json EXPO_PUBLIC_APP_URL). */
const WEB_APP_URL = "https://app.moyolearn.com";
const SIDEBAR_WIDTH = toPoints(navChrome.railExpanded);

function ErrorNotice({ scheme }: { scheme: Scheme }) {
  const error = useShellStore((state) => state.error);
  const dismiss = useShellStore((state) => state.dismissError);
  // accessibilityLiveRegion is Android-only; VoiceOver on macOS hears the error
  // through an explicit announcement.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(`${error.source}: ${error.message}`);
  }, [error]);
  if (!error) return null;
  const styles = contentStyles(scheme);
  return (
    <View style={styles.notice} accessible accessibilityRole="alert">
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

function FingerprintLine({ scheme }: { scheme: Scheme }) {
  const fingerprint = useShellStore((state) => state.resourceFingerprint);
  const styles = contentStyles(scheme);
  if (!fingerprint) return null;
  if (fingerprint.status === "pending") return <Text style={styles.body}>Computing SHA-256…</Text>;
  if (fingerprint.status === "failed") {
    return (
      <Text style={styles.body} selectable>
        Couldn’t compute the fingerprint: {fingerprint.message}
      </Text>
    );
  }
  return (
    <Text style={[styles.body, styles.mono]} selectable accessibilityLabel="SHA-256 fingerprint, 64 characters. Select to copy.">
      SHA-256 {fingerprint.sha256}
    </Text>
  );
}

function ResourcesPanel({ scheme }: { scheme: Scheme }) {
  const resourceName = useShellStore((state) => state.resourceName);
  const styles = contentStyles(scheme);
  return (
    <View style={styles.panel}>
      <Text style={styles.heading} selectable>
        {resourceName ?? "No file chosen"}
      </Text>
      <FingerprintLine scheme={scheme} />
      <Text style={styles.body}>
        Moyo Learn reads the file on this Mac only to compute its fingerprint. It keeps the name, not the location, and never uploads the file.
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

function ContentPane({ scheme }: { scheme: Scheme }) {
  const section = useShellStore((state) => state.section);
  const density = useShellStore((state) => state.density);
  const styles = contentStyles(scheme);
  const current = sectionById(section);
  return (
    <ScrollView
      style={styles.main}
      contentContainerStyle={[styles.content, density === "compact" && styles.contentCompact]}
      keyboardShouldPersistTaps="handled"
    >
      <WorkspaceToolbar />
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          {current.label}
        </Text>
        <Text style={styles.subtitle}>{current.description}</Text>
      </View>
      <ErrorNotice scheme={scheme} />
      <SectionBody section={section} scheme={scheme} />
    </ScrollView>
  );
}

export default function App() {
  const scheme = useScheme();
  const sidebarVisible = useShellStore((state) => state.sidebarVisible);
  const setSidebarVisible = useShellStore((state) => state.setSidebarVisible);
  const reportError = useShellStore((state) => state.reportError);
  const hydrated = useShellStore((state) => state.hydrated);
  const styles = contentStyles(scheme);
  // Settings load from disk asynchronously; painting before they arrive would
  // flash the default appearance and sidebar state. The window background shows meanwhile.
  if (!hydrated) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <DesktopShellControllers />
      <SidebarSplitView
        style={styles.split}
        sidebar={<SidebarPane scheme={scheme} />}
        content={<ContentPane scheme={scheme} />}
        sidebarWidth={SIDEBAR_WIDTH}
        sidebarMinWidth={SIDEBAR_WIDTH}
        contentMinWidth={toPoints(contentWidths["content-feed"]) / 2}
        sidebarCollapsed={!sidebarVisible}
        onSidebarCollapsedChange={(collapsed) => setSidebarVisible(!collapsed)}
        onError={(cause) => reportError("Split view", cause)}
      />
    </View>
  );
}

function contentStyles(scheme: Scheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: color("surface", scheme) },
    split: { flex: 1 },
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
    mono: { fontVariant: ["tabular-nums"] },
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
