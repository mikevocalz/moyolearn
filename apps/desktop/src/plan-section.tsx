/**
 * Plan and account rows for the Settings window (doc 38 PW-02 manage plan,
 * FD-26 delete account), for signed-in adults only.
 *
 * Desktop uses the web billing path: status comes from GET /api/entitlements
 * and is projected with main's own `entitlementsFor` (packages/auth/src/entitlements.ts,
 * imported, not copied), and every change happens on app.moyolearn.com in the
 * browser. Paywall gates (PW-01/04/05) are struck until PR-D05 ships a desktop
 * surface that a plan unlocks; there is nothing on desktop to gate yet.
 * Learner accounts never reach this view (session.ts signs them out), so no
 * price or plan state can render on a learner surface.
 * Structure (docs/desktop/mobbin/D04.md): Mural's one row per fact with its
 * action on the same row; Podia puts Cancel last; here both live on the web.
 * SOT: docs/desktop/seams/D04.md · docs/38-front-door-and-flow.md
 * SOT-KEYWORDS: desktop plan entitlements settings manage plan delete account billing
 */
import { StyleSheet, Text, View } from "react-native";
import { openURL } from "@legendapp/spark/links";
import { Button as NativeButton } from "@legendapp/spark/ui";
import { daysLeft, entitlementsFor, type SubscriptionState } from "../../../packages/auth/src/entitlements.ts";
import type { PlanName } from "../../../packages/auth/src/billing-plans.ts";
import { AUTH_ORIGIN } from "./auth/client";
import { useShellStore, type AccountSummary } from "./store";
import { color, space, textStyle, type Scheme } from "./theme";

const PLAN_LABELS = {
  "family-early-bird": "Family (Early Bird)",
  family: "Family",
  "ops-solo": "Solo",
  "ops-studio": "Studio",
  "ops-scale": "Scale",
} as const satisfies Record<PlanName, string>;

function statusLine(subscription: SubscriptionState): string {
  const entitlements = entitlementsFor(subscription);
  const plan = subscription.plan ? PLAN_LABELS[subscription.plan] : "No plan";
  if (entitlements.trialing) {
    const days = daysLeft(subscription);
    return days === null ? `${plan}, trial` : `${plan}, trial ends in ${days} ${days === 1 ? "day" : "days"}`;
  }
  switch (subscription.status) {
    case "active":
      return `${plan}, active`;
    case "past_due":
      return `${plan}, payment needs attention`;
    case "canceled":
      return `${plan}, ended. Everything you set up stays readable and exportable.`;
    case "incomplete":
      return `${plan}, not started`;
    default:
      return "No plan";
  }
}

function ownerName(account: AccountSummary, referenceId: string | null): string {
  if (referenceId === account.id) return "You";
  return account.organizations.find((org) => org.id === referenceId)?.name ?? "Organization";
}

export function PlanSection({ scheme }: { scheme: Scheme }) {
  const auth = useShellStore((state) => state.auth);
  const plan = useShellStore((state) => state.plan);
  const reportError = useShellStore((state) => state.reportError);
  const styles = planStyles(scheme);
  if (auth.status !== "signed-in") return null;
  const open = (path: string, source: string) => openURL(`${AUTH_ORIGIN}${path}`).catch((cause) => reportError(source, cause));
  return (
    <View style={styles.section} accessibilityLabel="Plan and account">
      <Text accessibilityRole="header" style={styles.heading}>
        Plan
      </Text>
      {plan.status === "loading" || plan.status === "idle" ? <Text style={styles.body}>Loading your plan…</Text> : null}
      {plan.status === "failed" ? (
        <Text style={styles.body} selectable>
          Couldn’t load your plan: {plan.message}
        </Text>
      ) : null}
      {plan.status === "ready" && plan.subscriptions.length === 0 ? <Text style={styles.body}>No plan on this account.</Text> : null}
      {plan.status === "ready"
        ? plan.subscriptions.map((subscription) => (
            <Text key={subscription.referenceId ?? "none"} style={styles.body} selectable>
              {ownerName(auth.account, subscription.referenceId)}: {statusLine(subscription)}
            </Text>
          ))
        : null}
      <Text style={styles.body}>
        Plan changes and account deletion happen on app.moyolearn.com. Your browser may ask you to sign in there too.
      </Text>
      <View style={styles.actions}>
        <NativeButton variant="bordered" onPress={() => void open("/plan", "Manage Plan")} onError={(cause) => reportError("Manage Plan", cause)}>
          Manage Plan in Browser…
        </NativeButton>
        <NativeButton
          variant="borderless"
          onPress={() => void open("/account/delete", "Delete Account")}
          onError={(cause) => reportError("Delete Account", cause)}
        >
          Delete Account in Browser…
        </NativeButton>
      </View>
    </View>
  );
}

function planStyles(scheme: Scheme) {
  return StyleSheet.create({
    section: { gap: space.stack },
    heading: { ...textStyle("label"), color: color("text", scheme) },
    body: { ...textStyle("body"), color: color("text-muted", scheme) },
    actions: { flexDirection: "row", gap: space.stack, alignItems: "center" },
  });
}
