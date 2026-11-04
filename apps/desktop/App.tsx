import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { DesktopNativeMenus, NativeWorkspaceToolbar, chooseResource } from "./src/native-menus";
import { palette, semantic } from "../../packages/theme/tokens";
import { DESKTOP_SECTIONS, desktopShellMode, sectionTitle, type DesktopSection } from "./src/layout";
import { usePreviewStore } from "./src/store";
import { desktopNitroReadiness } from "./src/nitro-readiness";

/**
 * A real React Native / Hermes desktop surface, not an HTML shell.
 *
 * Feature components are intentionally local to this preview. The existing
 * @acme/app and @acme/ui barrels must be audited for macOS native dependencies
 * before they can be imported into a Spark SDK 55 build.
 */
const color = {
  ground: semantic.surface.light,
  raised: semantic["surface-raised"].light,
  sunken: semantic["surface-sunken"].light,
  text: semantic.text.light,
  muted: semantic["text-muted"].light,
  border: semantic.border.light,
  yellow: semantic.primary.light,
  inkOnYellow: semantic["on-primary"].light,
  plum: palette["moyo-purple"],
  teal: palette["moyo-teal"],
  coral: palette["moyo-coral"],
};

function Action({
  label, onPress, emphasis = false,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        emphasis ? styles.actionEmphasis : styles.actionNeutral,
        pressed && styles.pressed,
      ]}
    >
      <Text style={emphasis ? styles.actionEmphasisText : styles.actionNeutralText}>
        {label}
      </Text>
    </Pressable>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandIconWrap}>
        <Image
          source={require("./assets/mark.png")}
          style={styles.brandIcon}
          resizeMode="contain"
          accessibilityLabel="Moyo Learn brand mark"
        />
      </View>
      <View>
        <Text style={styles.brandTitle}>MOYO LEARN</Text>
        <Text style={styles.brandSubtitle}>DESKTOP EDITION</Text>
      </View>
    </View>
  );
}

function Sidebar({ compact }: { compact: boolean }) {
  const section = usePreviewStore((store) => store.section);
  const setSection = usePreviewStore((store) => store.setSection);
  return (
    <View style={[styles.sidebar, compact ? styles.sidebarCompact : styles.sidebarWide]}>
      <Brand />
      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        style={compact ? styles.compactNavScroll : styles.wideNavScroll}
        contentContainerStyle={compact ? styles.compactNav : styles.wideNav}
      >
        {DESKTOP_SECTIONS.map((item, index) => {
          const active = item.id === section;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSection(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.navItem,
                compact && styles.navItemCompact,
                active && styles.navActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.navIndex, active && styles.navActiveText]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={[styles.navLabel, active && styles.navActiveText]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!compact && (
        <View style={styles.sidebarFooter}>
          <View style={styles.sidebarFooterRule} />
          <Text style={styles.sidebarFooterTitle}>A bigger space for big ideas.</Text>
          <Text style={styles.sidebarFooterCaption}>
            Native macOS preview. Mobile, web, foldables and XR remain unchanged.
          </Text>
        </View>
      )}
    </View>
  );
}

function Hero() {
  const setSection = usePreviewStore((store) => store.setSection);
  return (
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>LEARNING HAS NO LIMITS  /  01</Text>
        <Text style={styles.heroHeadline}>
          Ideas that grow with you.
        </Text>
        <Text style={styles.heroBody}>
          Welcome to the desktop foundation of Moyo Learn. Your planning,
          resources and future teaching workspace belong in one beautiful native window.
        </Text>
        <View style={styles.heroActions}>
          <Action label="Open lesson scratchpad" emphasis onPress={() => setSection("planner")} />
          <Action label="Choose a resource" onPress={() => void chooseResource()} />
        </View>
      </View>
      <View style={styles.heroArtwork} accessible accessibilityLabel="Layered colorful Moyo lesson sheets">
        <View style={styles.heroCardOne} />
        <View style={styles.heroCardTwo} />
        <View style={styles.heroCardThree}>
          <View style={styles.heroCardLineWide} />
          <View style={styles.heroCardLineShort} />
          <View style={styles.heroCardDot} />
        </View>
      </View>
    </View>
  );
}

function Scratchpad() {
  const note = usePreviewStore((store) => store.note);
  const setNote = usePreviewStore((store) => store.setNote);
  const clearNote = usePreviewStore((store) => store.clearNote);
  return (
    <View style={styles.workspace}>
      <View style={styles.workspaceTop}>
        <View style={styles.workspaceCopy}>
          <Text style={styles.sectionHeading}>Lesson scratchpad</Text>
          <Text style={styles.sectionSubheading}>
            Draft a lesson idea. Notes are in-memory only and disappear when the app quits.
          </Text>
        </View>
        <Action label="Clear" onPress={clearNote} />
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Temporary lesson scratchpad"
        placeholder="What will your learner discover today?"
        placeholderTextColor={color.muted}
        style={styles.scratchpadInput}
      />
      <Text style={styles.workspaceFootnote}>
        PERSONAL SCRATCHPAD · NO CLOUD SYNC · NO STUDENT DATA
      </Text>
    </View>
  );
}

function ResourceChooser() {
  const selected = usePreviewStore((store) => store.selectedResource);
  return (
    <View style={styles.workspace}>
      <View style={styles.workspaceTop}>
        <View style={styles.workspaceCopy}>
          <Text style={styles.sectionHeading}>Reference material</Text>
          <Text style={styles.sectionSubheading}>
            Choose a local file using a native macOS dialog.
          </Text>
        </View>
        <Action emphasis label="Choose file…" onPress={() => void chooseResource()} />
      </View>
      <View style={styles.resourceDetail}>
        <Text style={styles.resourceSymbol}>{selected ? "DOC" : "+"}</Text>
        <View style={styles.resourceCopy}>
          <Text style={styles.resourceLabel}>
            {selected ? selected : "Nothing selected yet"}
          </Text>
          <Text style={styles.resourceDescription}>
            Only the file name is shown. The file is never read, parsed or uploaded.
          </Text>
        </View>
      </View>
    </View>
  );
}

function UnavailableWorkspace({ section }: { section: DesktopSection }) {
  return (
    <View style={styles.workspace}>
      <View style={styles.lockLabel}>
        <Text style={styles.lockLabelText}>INTEGRATION GATE</Text>
      </View>
      <Text style={styles.sectionHeading}>{sectionTitle(section)}</Text>
      <Text style={styles.sectionSubheading}>
        This screen will use your existing Moyo learning features after a
        compatible native build, authenticated role guards and platform adapters
        pass validation. It is intentionally not connected to student data yet.
      </Text>
    </View>
  );
}

const NEXT_CAPABILITIES = [
  {
    number: "01", title: "Tutor room",
    description: "Guided lessons, shared conferencing and the persistent AI tutor.",
  },
  {
    number: "02", title: "Learning canvas",
    description: "Your native whiteboard, handwriting and document workspace.",
  },
  {
    number: "03", title: "School operations",
    description: "Guardian, educator, school and district role-aware views.",
  },
] as const;

function FutureCapabilities() {
  return (
    <View style={styles.capabilityGrid}>
      {NEXT_CAPABILITIES.map((item) => (
        <View style={styles.capabilityCard} key={item.number}>
          <Text style={styles.capabilityNumber}>{item.number} / EXPANSION</Text>
          <Text style={styles.capabilityTitle}>{item.title}</Text>
          <Text style={styles.capabilityText}>{item.description}</Text>
          <Text style={styles.capabilityFoot}>PENDING NATIVE INTEGRATION</Text>
        </View>
      ))}
    </View>
  );
}

function MainContent({ section }: { section: DesktopSection }) {
  const error = usePreviewStore((store) => store.error);
  const density = usePreviewStore((store) => store.density);
  const nitro = desktopNitroReadiness();
  return (
    <ScrollView
      style={styles.mainScroll}
      contentContainerStyle={[styles.mainContent, density === "compact" && styles.mainContentCompact]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pageMeta}>
        <Text style={styles.pageMetaLeft}>MOYO  /  NATIVE WORKSPACE</Text>
        <View style={styles.previewTag}>
          <Text style={styles.previewTagText}>PREVIEW BUILD</Text>
        </View>
      </View>
      <NativeWorkspaceToolbar />
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          {sectionTitle(section)}
        </Text>
        <Text style={styles.pageDescription}>
          {DESKTOP_SECTIONS.find((item) => item.id === section)?.description}
        </Text>
      </View>
      {error && (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <Action label="Dismiss" onPress={() => usePreviewStore.getState().setError(null)} />
        </View>
      )}
      {(section === "overview" || section === "planner") && <Hero />}
      {(section === "overview" || section === "planner") && <Scratchpad />}
      {section === "resources" && <ResourceChooser />}
      {(section === "tutor" || section === "classrooms") && (
        <UnavailableWorkspace section={section} />
      )}
      <View style={styles.nextHeader}>
        <Text style={styles.nextEyebrow}>NEXT, TOGETHER</Text>
        <Text style={styles.nextTitle}>Built for the whole learning journey.</Text>
      </View>
      <FutureCapabilities />
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Expo 58 mobile and XR remain untouched. Nitro v1 desktop bridge:
          {nitro.ready ? " validated" : " not yet validated"}.
          No authentication or learner data is available in this preview.
        </Text>
      </View>
    </ScrollView>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const compact = desktopShellMode(width) === "stacked";
  const section = usePreviewStore((store) => store.section);
  return (
    <View style={styles.root}>
      <DesktopNativeMenus />
      <View style={[styles.appFrame, compact && styles.appFrameCompact]}>
        <Sidebar compact={compact} />
        <MainContent section={section} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  appFrame: { flex: 1, flexDirection: "row" },
  appFrameCompact: { flexDirection: "column" },
  sidebar: { backgroundColor: color.plum },
  sidebarWide: { width: 240, paddingTop: 34, paddingHorizontal: 13 },
  sidebarCompact: { paddingTop: 15, paddingHorizontal: 14, paddingBottom: 9 },
  brand: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 10, marginBottom: 27 },
  brandIconWrap: { width: 48, height: 48, borderRadius: 11, backgroundColor: color.raised, alignItems: "center", justifyContent: "center" },
  brandIcon: { width: 39, height: 39 },
  brandTitle: { fontSize: 16, letterSpacing: 0.8, color: color.raised, fontWeight: "800" },
  brandSubtitle: { marginTop: 4, fontSize: 10, letterSpacing: 2, color: color.raised, opacity: 0.75 },
  wideNavScroll: { flexGrow: 0 },
  compactNavScroll: { maxHeight: 54 },
  wideNav: { gap: 6 },
  compactNav: { flexDirection: "row", alignItems: "center", gap: 5 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 13, borderRadius: 10, minHeight: 48 },
  navItemCompact: { paddingVertical: 10, paddingHorizontal: 10, minHeight: 43 },
  navActive: { backgroundColor: color.yellow },
  navIndex: { color: color.raised, fontSize: 11, fontWeight: "700", opacity: 0.7 },
  navLabel: { color: color.raised, fontSize: 14, fontWeight: "700" },
  navActiveText: { color: color.inkOnYellow, opacity: 1 },
  pressed: { opacity: 0.72 },
  sidebarFooter: { marginTop: "auto", paddingHorizontal: 11, paddingBottom: 28, gap: 8 },
  sidebarFooterRule: { height: 1, backgroundColor: color.raised, opacity: 0.3, marginBottom: 12 },
  sidebarFooterTitle: { color: color.raised, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  sidebarFooterCaption: { color: color.raised, fontSize: 12, lineHeight: 18, opacity: 0.75 },
  mainScroll: { flex: 1, backgroundColor: color.ground },
  mainContent: { maxWidth: 1440, width: "100%", alignSelf: "center", paddingVertical: 29, paddingHorizontal: 34, gap: 24 },
  mainContentCompact: { paddingVertical: 15, paddingHorizontal: 18, gap: 14 },
  pageMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  pageMetaLeft: { color: color.plum, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  previewTag: { borderWidth: 1, borderColor: color.border, borderRadius: 30, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: color.raised },
  previewTagText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: color.plum },
  titleGroup: { gap: 5 },
  pageTitle: { color: color.text, fontSize: 34, letterSpacing: -0.9, fontWeight: "800" },
  pageDescription: { fontSize: 15, color: color.muted, lineHeight: 22 },
  hero: { backgroundColor: color.plum, borderRadius: 22, padding: 27, flexDirection: "row", alignItems: "center", minHeight: 256, overflow: "hidden" },
  heroCopy: { flex: 1, gap: 11, minWidth: 0 },
  heroEyebrow: { color: color.yellow, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  heroHeadline: { color: color.raised, fontSize: 27, lineHeight: 33, fontWeight: "800", maxWidth: 470 },
  heroBody: { color: color.raised, opacity: 0.88, fontSize: 14, lineHeight: 21, maxWidth: 530 },
  heroActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 },
  heroArtwork: { width: 144, height: 156, marginLeft: 15, alignItems: "center", justifyContent: "center" },
  heroCardOne: { width: 105, height: 132, backgroundColor: color.teal, borderRadius: 13, position: "absolute", transform: [{ rotate: "13deg" }], top: 10, right: 6 },
  heroCardTwo: { width: 107, height: 134, backgroundColor: color.coral, borderRadius: 13, position: "absolute", transform: [{ rotate: "-12deg" }], top: 8, left: 7 },
  heroCardThree: { width: 105, height: 134, backgroundColor: color.yellow, borderRadius: 13, borderWidth: 2, borderColor: color.border, transform: [{ rotate: "2deg" }], padding: 17, gap: 11 },
  heroCardLineWide: { height: 7, backgroundColor: color.plum, borderRadius: 7, marginTop: 12 },
  heroCardLineShort: { height: 7, width: "65%", backgroundColor: color.plum, borderRadius: 7 },
  heroCardDot: { width: 25, height: 25, backgroundColor: color.teal, borderRadius: 25, marginTop: 10 },
  action: { borderWidth: 1, borderColor: color.border, borderRadius: 10, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  actionEmphasis: { backgroundColor: color.yellow },
  actionNeutral: { backgroundColor: color.raised },
  actionEmphasisText: { color: color.inkOnYellow, fontSize: 13, fontWeight: "700" },
  actionNeutralText: { color: color.text, fontSize: 13, fontWeight: "700" },
  workspace: { padding: 24, borderWidth: 1, borderColor: color.border, borderRadius: 17, backgroundColor: color.raised, gap: 18 },
  workspaceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  workspaceCopy: { flexShrink: 1, gap: 6 },
  sectionHeading: { fontSize: 21, color: color.text, fontWeight: "800" },
  sectionSubheading: { fontSize: 14, lineHeight: 21, color: color.muted, maxWidth: 620 },
  scratchpadInput: { borderWidth: 1, borderColor: color.border, backgroundColor: color.ground, borderRadius: 12, minHeight: 155, padding: 16, color: color.text, fontSize: 15, lineHeight: 23 },
  workspaceFootnote: { fontSize: 10, letterSpacing: 1.2, fontWeight: "700", color: color.muted },
  resourceDetail: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: color.ground, borderRadius: 12 },
  resourceSymbol: { width: 51, fontSize: 18, color: color.plum, fontWeight: "800", textAlign: "center" },
  resourceCopy: { flex: 1, gap: 5 },
  resourceLabel: { fontSize: 15, color: color.text, fontWeight: "700" },
  resourceDescription: { fontSize: 13, color: color.muted, lineHeight: 19 },
  lockLabel: { alignSelf: "flex-start", backgroundColor: color.yellow, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  lockLabelText: { fontSize: 10, fontWeight: "800", color: color.inkOnYellow, letterSpacing: 1.2 },
  nextHeader: { marginTop: 7, gap: 7 },
  nextEyebrow: { fontSize: 10, color: color.teal, letterSpacing: 1.5, fontWeight: "800" },
  nextTitle: { fontSize: 22, color: color.text, fontWeight: "800" },
  capabilityGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  capabilityCard: { flex: 1, minWidth: 205, padding: 20, borderRadius: 14, backgroundColor: color.raised, borderWidth: 1, borderColor: color.border, gap: 10 },
  capabilityNumber: { fontSize: 10, color: color.teal, fontWeight: "800", letterSpacing: 1.1 },
  capabilityTitle: { fontSize: 18, fontWeight: "800", color: color.text },
  capabilityText: { fontSize: 13, color: color.muted, lineHeight: 20, flexGrow: 1 },
  capabilityFoot: { fontSize: 10, fontWeight: "700", color: color.plum, letterSpacing: 0.8, marginTop: 6 },
  footer: { borderTopWidth: 1, borderColor: color.border, paddingTop: 16 },
  footerText: { color: color.muted, fontSize: 12, lineHeight: 19 },
  error: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: color.coral, backgroundColor: color.raised, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  errorText: { color: color.text, fontSize: 13, flex: 1 },
});
