"use client";
// Thin param unwrapper — the screen owns everything else (web page mirrors
// this). `classId` rides as an optional query param: class detail's "Assign
// work to this class" pre-fills the form's picker with it. `assignmentId`
// puts the same form in edit mode for an existing draft (editAssignmentPath).
import { useLocalSearchParams } from "expo-router";
import { AssignmentFormScreen } from "@acme/app";

export default function NewAssignmentRoute() {
  const { classId, assignmentId } = useLocalSearchParams<{
    classId?: string;
    assignmentId?: string;
  }>();
  return <AssignmentFormScreen classId={classId} assignmentId={assignmentId} />;
}
