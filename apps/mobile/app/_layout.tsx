// Boots Sentry before anything else in the tree evaluates (slo.md §7 W-2). It
// is a side-effect import because the SDK has to be initialised, not rendered —
// see src/telemetry.ts for what is and is not enabled, and why.
import "../src/telemetry";
// Registers the ExecuTorch resource-fetcher adapter. Side-effect import, and it
// has to sit up here with telemetry rather than inside the capture feature: the
// adapter is module-level state in react-native-executorch and `useOCR` /
// `useSpeechToText` start fetching in their mount effect, so anything that runs
// during the capture screen's render is already too late. See
// src/executorch.native.ts for the failure this fixes (error code 186).
import "../src/executorch";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";
import { AppQueryProvider, SafeAreaProvider, SessionProvider , AccountSheet, AttachSheet, AudioRecorderSheet, SwitchProfileSheet, UrlSheet, VideoNoteSheet, UploadQueueProvider } from "@acme/app";
import { BookingSheet } from "../components/BookingSheet";
import { ShellHeader } from "../components/ShellHeader";
import { Toaster } from "@acme/ui";
import "../global.css";

// The root-level routes that are real destinations rather than front door, and
// the title each one's bar carries. Every other root child is either a shell
// group (which draws its own chrome), the dispatcher, or a pre-auth screen that
// owns its full-bleed hero — those keep `headerShown: false`.
//
// `/settings` and `/editor-settings` sit here rather than in a shell because
// more than one shell pushes them and expo-router forbids one path living in
// two sibling groups; the dev hatch sits here because it must be reachable
// before any shell exists. All three used to render with no bar at all.
const ROOT_TITLES: Record<string, string> = {
  "/settings": "Settings",
  "/editor-settings": "Editor",
  "/onboarding/dev": "Personas",
};

// className-capable gesture root (third-party component → withUniwind).
// Module scope, not render scope — withUniwind builds the wrapper eagerly.
//
// Uniwind's p-safe/m-safe/safe-* utilities are NOT wired: they need insets
// pushed in via a SafeAreaListener + Uniwind.updateInsets, and nothing in this
// repo uses them (the kit ships a SafeArea component instead). Add the listener
// here if those classes are ever adopted — docs.uniwind.dev/migration-from-nativewind.
const GestureRoot = withUniwind(GestureHandlerRootView);

export default function RootLayout() {
  return (
    <GestureRoot className="flex-1">
      {/* Follows the system theme; without this the bar is unstyled and its
          icons can vanish against a matching surface. */}
      <StatusBar style="auto" />
      {/*
        Installs the native WindowInsetsAnimationCallback subscription on
        Android and handles edge-to-edge. RN's built-in KeyboardAvoidingView
        relies on LayoutAnimation and a late keyboardDidShow, so Android content
        SNAPS instead of tracking the keyboard curve; this gives per-frame
        insets that both platforms map onto one animated value.
      */}
      <KeyboardProvider>
      <SafeAreaProvider>
        {/*
          Gorhom's modals mount into this provider, so it has to sit above every
          route that presents one. It must also be INSIDE GestureHandlerRootView
          — the sheet is gesture-driven and will not respond without it.
        */}
        <BottomSheetModalProvider>
          <AppQueryProvider>
            <SessionProvider>
              {/*
                A Stack, not a `<Slot>`. Slot renders the focused child and
                nothing else, which is why every root-level route — Settings,
                Editor settings, the dev hatch — arrived with no app bar and no
                back affordance while the shells all had one. Chrome is OFF by
                default here (the shell groups draw their own, the dispatcher is
                a redirect, and the front door owns its full-bleed hero); the
                three real destinations opt in below and get the same
                `ShellHeader` every shell route gets.
              */}
              <Stack
                screenOptions={{
                  headerShown: false,
                  header: ({ navigation, back }) => (
                    <ShellHeader
                      titles={ROOT_TITLES}
                      fallback="Moyo"
                      /* `back` is defined only when this route can pop — the
                         same signal the shell layouts read, so the wordmark
                         yields to the chevron on exactly the pushed screens. */
                      canGoBack={back !== undefined}
                      onBack={navigation.goBack}
                    />
                  ),
                }}
              >
                <Stack.Screen name="settings" options={{ headerShown: true }} />
                <Stack.Screen name="editor-settings/index" options={{ headerShown: true }} />
                {/* The QA hatch is a screen people actually navigate; leaving it
                    barless is how it stayed the one surface with no way out. */}
                <Stack.Screen name="onboarding/dev" options={{ headerShown: true }} />
              </Stack>
            </SessionProvider>
            {/*
              Mounted at the ROOT, directly under the provider. A Gorhom modal
              nested deeper — in the split layout, or in a route inside the
              split view's Slot — presents without rendering: present() fires
              and the ref is set, but nothing appears. A minimal probe route
              proved the modal itself works, so the host has to sit here.
              Visibility is global Zustand state, so this is also where it
              belongs architecturally.
            */}
            <BookingSheet />
            <AttachSheet />
            <AudioRecorderSheet />
            <VideoNoteSheet />
            <UploadQueueProvider />
            <UrlSheet />
            {/* ADR-106: Profile/You as chrome — opened from every shell
                header's avatar via useAccountSheet. */}
            <AccountSheet />
            {/* FD-24's "Who's here?" — the same avatar anchor, for the K–2/3–5
                bands whose settings stay guardian-side (ADR-106 amendment,
                recorded in components/ShellHeader.tsx). */}
            <SwitchProfileSheet />
            {/* Last, so a toast paints above the sheets it reports on. */}
            <Toaster />
          </AppQueryProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
