"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors
// this). `classId` rides as a query param: the enrollment row is read through
// its class roster (no per-student API — see student-detail-content.tsx).
import { useLocalSearchParams } from "expo-router";
import { StudentDetailScreen } from "@acme/app";

export default function StudentRoute() {
  const { studentId, classId } = useLocalSearchParams<{ studentId: string; classId?: string }>();
  return <StudentDetailScreen studentId={studentId ?? ""} classId={classId} />;
}
