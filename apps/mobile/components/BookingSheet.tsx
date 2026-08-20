'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'react-native';
import { palette } from '@acme/theme';
import { View } from '@acme/ui/tw';
import { useRouter } from 'expo-router';
import { BookingForm, useScheduleStore } from '@acme/app';

/**
 * New-booking sheet — Gorhom, presented DETACHED.
 *
 * `detached` + `bottomInset` lifts the sheet off the bottom edge and
 * `marginHorizontal` supplies the lateral gap, per
 * gorhom.dev/react-native-bottom-sheet/detach-modal. Chosen over expo-router's
 * `presentation: 'formSheet'` because react-native-screens 4.26 has no detached
 * presentation at all — its sheet API is detents, grabber, corner radius and
 * insets only.
 *
 * INLINE SHEET, NOT BottomSheetModal — deliberately, after measurement.
 * BottomSheetModal registers with BottomSheetModalProvider and mounts through a
 * portal. Here `present()` fired and the ref was set, but the portal mounted
 * NOTHING: `uiautomator dump` reported zero sheet nodes, from the split layout,
 * from the detail route, and from the root beside the provider, with and
 * without `detached`. The inline sheet renders correctly in the same app, so
 * the portal path is what is broken, not the library.
 *
 * The inline sheet has no portal, so it needs a host that covers the screen —
 * hence the absolutely-positioned overlay. `pointerEvents="box-none"` lets taps
 * reach the grid while the sheet is closed; the sheet still gets its own.
 */
export function BookingSheet() {
  // expo-router's own router: solito's does not navigate on native here, which
  // is why the toolbar takes a callback rather than an href.
  const router = useRouter();
  const bookingOpen = useScheduleStore((state) => state.bookingOpen);
  const closeBooking = useScheduleStore((state) => state.closeBooking);

  const snapPoints = useMemo(() => ['60%', '90%'], []);

  /**
   * The `index` prop alone does not reliably close this sheet. Once the user
   * has dragged it, Gorhom's internal position diverges from the prop, and a
   * later change back to -1 is treated as already-satisfied — so Cancel left
   * the sheet on screen. Driving it imperatively from the same store value
   * keeps the two in step; `index={-1}` below is only the mount state.
   */
  const sheetRef = useRef<BottomSheet>(null);
  useEffect(() => {
    if (bookingOpen) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [bookingOpen]);

  // Gorhom's chrome takes style objects, not classNames, so the RetroUI slab
  // is applied from the tokens directly — the same pattern the tabs layout
  // uses for NativeTabs. Ink border + hard offset shadow, matching the app's
  // buttons and cards rather than the library's default borderless white.
  const isDark = useColorScheme() === 'dark';
  const ink = isDark ? palette.ink[50] : palette.ink[950];
  const surface = isDark ? '#211F1B' : palette.white;

  // Fires for a swipe-down dismiss too, so store state cannot drift out of
  // sync with what is actually on screen.
  const handleClose = useCallback(() => closeBooking(), [closeBooking]);

  return (
    <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 top-0">
      <BottomSheet
        ref={sheetRef}
        // Mount state only — the effect above owns open/close from here.
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        detached
        bottomInset={46}
        enablePanDownToClose
        // The sheet hosts a form, so it must track the keyboard rather than sit
        // under it. `interactive` follows the keyboard frame; `restore` returns
        // to the previous detent on blur.
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onClose={handleClose}
        backgroundStyle={{
          backgroundColor: surface,
          borderWidth: 2,
          borderColor: ink,
          borderRadius: 14,
        }}
        handleIndicatorStyle={{ backgroundColor: ink }}
        // overflow:hidden clips the scrolling content to the rounded, bordered
        // background. Without it the inner UI paints straight over the sheet's
        // bottom border, which reads as the border being cut out.
        style={{
          marginHorizontal: 24,
          overflow: 'hidden',
          borderRadius: 14,
          shadowColor: ink,
          elevation: 0,
        }}
      >
        {/* Scrollable: the form is taller than the 60% detent on a phone, and
            a sheet whose content is cut off with no way to reach the action is
            worse than one that scrolls. */}
        <BottomSheetScrollView
          /*
            Gorhom renders the background — which carries the border — as a
            SIBLING BEHIND the content, and both fill the same bounds. So any
            opaque child that reaches the edge paints straight over the border
            line, which is why the bottom edge went missing under the notes
            toolbar while the corners survived.

            Insetting the content by the border width is what fixes it: the
            scroll view now stops 2px short on every side, leaving the border
            visible all the way round. Clipping alone never could — the content
            was inside its own bounds; it was the BORDER that was underneath.
          */
          style={{ overflow: 'hidden', borderRadius: 12, margin: 2 }}
          /*
            Generous, not decorative. `EnrichedTextInput` is a NATIVE view that
            grows to fit its content — an inline video node makes it much taller
            — but that growth happens inside the native layout and RN's measured
            height for it does not follow. The scroll's content size is then
            short by exactly that difference, and the actions below it become
            unreachable: the list stops scrolling with Cancel and Create booking
            still clipped by the sheet edge.

            This padding is scrollable space RN *does* measure, so the actions
            stay reachable however far the editor has grown.
          */
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
        >
          <BookingForm
            onDone={closeBooking}
            onOpenEditorSettings={() => {
              // Close first: the sheet overlays the whole screen, so pushing
              // beneath it would land the user on a route they cannot see.
              closeBooking();
              router.push('/editor-settings');
            }}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
