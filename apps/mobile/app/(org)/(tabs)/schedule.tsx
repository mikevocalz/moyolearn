"use client";
import { ScheduleScreen, useScheduleStore } from "@acme/app";
import { SafeArea } from "@acme/ui";

// The org calendar. The booking sheet is mounted at the ROOT (app/_layout.tsx).
//
// This tab sets `headerShown: false`, so nothing above it reserves the status
// bar — the screen has to take that inset itself or its heading renders under
// the clock. Every route that opts out of the shell header owes the same inset;
// the tutor session gets it from `SessionToolbar`, capture takes it inline.
export default function OrgSchedule() {
  const openBooking = useScheduleStore((state) => state.openBooking);
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface-sunken">
      <ScheduleScreen onNewBooking={openBooking} fill />
    </SafeArea>
  );
}
