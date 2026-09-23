"use client";
import { Redirect } from "expo-router";
import { DeleteAccountScreen, useAppSession } from "@acme/app";

// FD-26 · Delete account. Outside the shell groups for the same reason
// `settings.tsx` is: Settings pushes here from more than one shell, and
// expo-router forbids one path living in two sibling groups. Doc 38 puts
// `account/*` inside every authed guard, which is what this anon redirect is.
export default function DeleteAccountRoute() {
  const { status } = useAppSession();
  if (status === "anon") return <Redirect href="/" />;
  return <DeleteAccountScreen />;
}
