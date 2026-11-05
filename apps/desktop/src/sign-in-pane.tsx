/**
 * Desktop sign-in (doc 38 FD-02 Log in, FD-05 Check your email, FD-25 Session
 * ended), for guardians, tutors and organization and district staff.
 *
 * Email and password go to Better Auth's `/sign-in/email` (src/auth/session.ts).
 * The password field is React Native's TextInput with `secureTextEntry`, which
 * Fabric backs with RCTUISecureTextField, an NSSecureTextField
 * (react-native-macos RCTTextInputComponentView.mm:1435); the password stays in
 * component state only for the life of the form.
 *
 * Struck 2026-11-04 (PR-D04), each with its blocker:
 * - Code entry (FD-05 OTP): the server has no emailOTP plugin; verification is
 *   a link. The verify-email notice says so.
 * - Browser sign-in through `@legendapp/spark/auth-session`: no server route
 *   hands a session to a native callback for adults (no social provider, magic
 *   link or one-time token). Needs a server change first.
 * - Forgot / reset (FD-06/07): no reset route exists in apps/web or apps/mobile
 *   on main. The pane points to the support inbox instead of a dead link.
 * - Switch profile (FD-24): multiSession is on the server, but the desktop has
 *   one Keychain slot; deferred until a second account has a desktop use.
 * Structure (docs/desktop/mobbin/D04.md): Melio's session-ended screen (reason,
 * one line, one action); Docusign pre-fills the last email.
 * SOT: docs/desktop/seams/D04.md · docs/38-front-door-and-flow.md
 * SOT-KEYWORDS: desktop sign-in login session ended verify email form
 */
import { useState } from "react";
import { StyleSheet, Text, TextInput as RNTextInput, View } from "react-native";
import { openURL } from "@legendapp/spark/links";
import { Button as NativeButton, TextInput as NativeTextInput } from "@legendapp/spark/ui";
import { signIn } from "./auth/session";
import { useShellStore, type AuthNotice } from "./store";
import { color, corner, space, textStyle, toPoints, type Scheme } from "./theme";
import { contentWidths } from "../../../packages/theme/tokens";

const SUPPORT_URL = "mailto:info@moyolearn.com?subject=Moyo%20Learn%20for%20Mac%3A%20password%20help";

function noticeText(notice: AuthNotice): string {
  switch (notice.kind) {
    case "invalid-credentials":
      return "That email and password don’t match an account.";
    case "verify-email":
      return "Confirm your email first. We sent a link to your inbox; open it, then sign in here.";
    case "session-ended":
      return "You were signed out. Sign in again to continue.";
    case "learner-on-desktop":
      return "Learner accounts use Moyo Learn on the web or on a phone for now.";
    case "offline":
      return "Moyo Learn can’t reach the internet. Check your connection, then try again.";
    case "error":
      return `Sign-in didn’t work: ${notice.message}`;
  }
}

export function SignInPane({ scheme }: { scheme: Scheme }) {
  const auth = useShellStore((state) => state.auth);
  const reportError = useShellStore((state) => state.reportError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const styles = signInStyles(scheme);
  const busy = auth.status === "signing-in" || auth.status === "checking";
  const notice = auth.status === "signed-out" ? auth.notice : null;
  const canSubmit = !busy && email.trim().includes("@") && password.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const secret = password;
    setPassword("");
    void signIn(email, secret);
  };

  return (
    <View style={styles.panel} accessibilityLabel="Sign in to Moyo Learn">
      <Text accessibilityRole="header" style={styles.heading}>
        {notice?.kind === "session-ended" ? "Your session ended" : "Sign in to Moyo Learn"}
      </Text>
      {notice ? (
        <Text style={styles.notice} selectable accessibilityRole="alert">
          {noticeText(notice)}
        </Text>
      ) : null}
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <NativeTextInput
          value={email}
          onChangeText={setEmail}
          disabled={busy}
          accessibilityLabel="Email"
          style={styles.input}
          onError={(cause) => reportError("Email field", cause)}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <RNTextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
          autoComplete="current-password"
          textContentType="password"
          accessibilityLabel="Password"
          onSubmitEditing={submit}
          style={[styles.input, styles.secure]}
        />
      </View>
      <View style={styles.actions}>
        <NativeButton variant="default" disabled={!canSubmit} onPress={submit} onError={(cause) => reportError("Sign In", cause)}>
          {busy ? "Signing In…" : "Sign In"}
        </NativeButton>
        <NativeButton
          variant="borderless"
          onPress={() => openURL(SUPPORT_URL).catch((cause) => reportError("Password Help", cause))}
          onError={(cause) => reportError("Password Help", cause)}
        >
          Password Help…
        </NativeButton>
      </View>
    </View>
  );
}

function signInStyles(scheme: Scheme) {
  return StyleSheet.create({
    panel: {
      alignSelf: "flex-start",
      width: "100%",
      maxWidth: toPoints(contentWidths["content-feed"]),
      gap: space.stack,
      padding: space.roomy,
      borderRadius: corner.card,
      backgroundColor: color("surface-raised", scheme),
    },
    heading: { ...textStyle("title"), color: color("text", scheme) },
    notice: { ...textStyle("body"), color: color("text", scheme) },
    field: { gap: space.hair },
    label: { ...textStyle("caption"), color: color("text-muted", scheme) },
    input: { width: "100%", height: space.section + space.stack },
    secure: {
      ...textStyle("body"),
      color: color("text", scheme),
      paddingHorizontal: space.tight,
      borderRadius: corner.control,
      backgroundColor: color("surface", scheme),
    },
    actions: { flexDirection: "row", gap: space.stack, alignItems: "center" },
  });
}
