"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors this).
import { useLocalSearchParams } from "expo-router";
import { SessionReportScreen } from "@acme/app";

export default function ReportRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <SessionReportScreen sessionId={sessionId ?? ""} />;
}
