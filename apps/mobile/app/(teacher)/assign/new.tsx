"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors
// this). `classId` rides as an optional query param: class detail's "Assign
// work to this class" pre-fills the form's picker with it.
import { useLocalSearchParams } from "expo-router";
import { AssignmentFormScreen } from "@acme/app";

export default function NewAssignmentRoute() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  return <AssignmentFormScreen classId={classId} />;
}
