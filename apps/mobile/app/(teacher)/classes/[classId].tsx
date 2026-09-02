"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors this).
import { useLocalSearchParams } from "expo-router";
import { ClassDetailScreen } from "@acme/app";

export default function ClassRoute() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  return <ClassDetailScreen classId={classId ?? ""} />;
}
