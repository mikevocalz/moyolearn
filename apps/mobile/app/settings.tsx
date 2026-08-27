"use client";
import { Redirect } from "expo-router";
import { SettingsScreen, useAppSession } from "@acme/app";

// Preferences, outside the shell groups: Profile pushes /settings from more
// than one shell, and expo-router forbids one path living in two sibling
// groups. Local prefs only — no server data — but never a surface for anon.
export default function SettingsRoute() {
  const { status } = useAppSession();
  if (status === "anon") return <Redirect href="/" />;
  return <SettingsScreen />;
}
