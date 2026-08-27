// Boots Sentry before anything else in the tree evaluates (slo.md §7 W-2). It
// is a side-effect import because the SDK has to be initialised, not rendered —
// see src/telemetry.ts for what is and is not enabled, and why.
import "../src/telemetry";

import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";
import { AppQueryProvider, SafeAreaProvider, SessionProvider , AttachSheet, AudioRecorderSheet, UrlSheet, VideoNoteSheet, UploadQueueProvider } from "@acme/app";
import { BookingSheet } from "../components/BookingSheet";
import { Toaster } from "@acme/ui";
import "../global.css";

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
              <Slot />
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
            {/* Last, so a toast paints above the sheets it reports on. */}
            <Toaster />
          </AppQueryProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
