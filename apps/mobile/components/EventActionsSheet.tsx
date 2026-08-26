'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'react-native';
import { palette } from '@acme/theme';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Trash2, Copy, Calendar } from '@acme/ui/icons';

export interface EventActionsSheetProps {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
  onDuplicate: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}

/**
 * Contextual actions for the selected event.
 *
 * INLINE `BottomSheet`, not `BottomSheetModal` — measured, not assumed.
 * `BottomSheetModal` mounts through a portal that renders nothing in this
 * stack: `present()` fired and the ref was set, but `uiautomator dump` reported
 * zero sheet nodes. The inline sheet renders correctly in the same app. See
 * `BookingSheet.tsx`, which hit the same wall.
 *
 * Driven imperatively from `open` for the same reason as the booking sheet: the
 * `index` prop alone stops closing the sheet once the user has dragged it,
 * because Gorhom's internal position diverges from the prop.
 */
export function EventActionsSheet({
  open,
  onClose,
  eventTitle,
  onDuplicate,
  onReschedule,
  onDelete,
}: EventActionsSheetProps) {
  const snapPoints = useMemo(() => ['38%'], []);
  const sheetRef = useRef<BottomSheet>(null);

  const isDark = useColorScheme() === 'dark';
  const ink = isDark ? palette.ink[50] : palette.ink[950];
  const surface = isDark ? '#211F1B' : palette.white;

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [open]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const actions = [
    { label: 'Duplicate', icon: Copy, onPress: onDuplicate, danger: false },
    { label: 'Reschedule', icon: Calendar, onPress: onReschedule, danger: false },
    { label: 'Delete', icon: Trash2, onPress: onDelete, danger: true },
  ];

  return (
    <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 top-0">
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onClose={handleClose}
        backgroundStyle={{
          backgroundColor: surface,
          borderWidth: 2,
          borderColor: ink,
          borderRadius: 14,
        }}
        handleIndicatorStyle={{ backgroundColor: ink }}
        style={{ marginHorizontal: 24, overflow: 'hidden', borderRadius: 14 }}
      >
        <BottomSheetView style={{ overflow: 'hidden' }}>
          <View className="gap-stack p-5">
            <Text numberOfLines={1} className="text-lg font-semibold text-text md:text-xl">
              {eventTitle}
            </Text>

            {actions.map((action) => (
              <Pressable
                key={action.label}
                aria-label={action.label}
                onPress={() => {
                  action.onPress();
                  onClose();
                }}
                className={`min-h-11 flex-row items-center gap-stack rounded-md border-2 border-border px-4 py-3 transition-colors duration-fast motion-reduce:transition-none ${
                  action.danger
                    ? 'bg-surface-raised hover:bg-danger/10 active:bg-danger/10'
                    : 'bg-surface-raised hover:bg-surface-sunken active:bg-surface-sunken'
                }`}
              >
                <action.icon
                  size={18}
                  className={action.danger ? 'text-danger' : 'text-text-muted'}
                />
                <Text
                  className={`text-base font-medium ${
                    action.danger ? 'text-danger' : 'text-text'
                  }`}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
