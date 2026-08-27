"use client";
import { ScheduleScreen, useScheduleStore } from "@acme/app";

// The org calendar. The booking sheet is mounted at the ROOT (app/_layout.tsx).
export default function OrgSchedule() {
  const openBooking = useScheduleStore((state) => state.openBooking);
  return <ScheduleScreen onNewBooking={openBooking} fill />;
}
