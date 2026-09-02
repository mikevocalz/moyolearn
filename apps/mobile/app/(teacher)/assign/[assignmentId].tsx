"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors this).
import { useLocalSearchParams } from "expo-router";
import { AssignmentDetailScreen } from "@acme/app";

export default function AssignmentRoute() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  return <AssignmentDetailScreen assignmentId={assignmentId ?? ""} />;
}
