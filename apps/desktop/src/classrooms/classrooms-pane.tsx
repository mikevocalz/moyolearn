/**
 * Classrooms: the signed-in teacher's classes on the left, the selected
 * class's roster on the right, read from the same API the web teacher pages use.
 *
 * The roster is a Legend List (`@legendapp/list/react-native`), recycled rows of
 * fixed height, so 10,000 enrollments render only what is on screen. Columns
 * follow the table rules: names left-aligned, the date right-aligned in
 * tabular figures. Rows carry the enrollment's `learnerAuthId` as their label
 * because the roster API returns no names; main's own class detail
 * (packages/app/features/classes/class-detail-content.tsx) shows the same.
 *
 * One primary action per row: select it, then Open Student in Browser… opens
 * the web student detail; Copy Student ID sits beside it. React Native macOS
 * 0.83 views expose no right-click event, Spark's `onContextMenu` exists only on
 * SidebarItem, and `onDoubleClick` is not in the `react-native` types this app
 * compiles against, so the per-row NSMenu and double-click are deferred.
 * There is no destructive roster action in the API, so no destructive state.
 *
 * States: loading (shown after 300 ms), empty, filtered-empty, error, offline,
 * permission, not-found, overflow (labels truncate, full value in the
 * accessibility label). A failed class list clears the roster and offers Try
 * Again in the pane; a failed roster does the same for that class. Desktop has no URL router, so states are reached from
 * real conditions, not route params.
 * Structure (docs/desktop/mobbin/D05.md): Coursera/Codecademy gradebook columns,
 * Gumloop's search at the table's right with the count beneath, Podia's
 * per-row actions with the primary first.
 * SOT: docs/desktop/seams/D05.md · docs/desktop/handoff/D05.md
 * SOT-KEYWORDS: desktop classrooms roster table legend list states teacher
 */
import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LegendList } from "@legendapp/list/react-native";
import { setStringAsync } from "@legendapp/spark/clipboard";
import { openURL } from "@legendapp/spark/links";
import { Button as NativeButton, TextInput as NativeTextInput } from "@legendapp/spark/ui";
import { AUTH_ORIGIN } from "../auth/client";
import { useShellStore, type ClassroomsFailure } from "../store";
import { color, corner, space, textStyle, type Scheme } from "../theme";
import { loadClasses, loadRoster, selectClass } from "./load";
import { countLabel, enrolledOn, filterRoster } from "./roster";
import type { Enrollment } from "./types";

const LOADING_DELAY_MS = 300;

const OFFLINE_COPY = "Moyo Learn can’t reach the internet. Check your connection, then try again.";
const PERMISSION_COPY = "Classrooms are for organization staff. Ask your organization’s owner to add you.";

/** The class list is one endpoint, so its 404 means the list itself is missing. */
const CLASS_LIST_COPY = {
  offline: OFFLINE_COPY,
  permission: PERMISSION_COPY,
  "not-found": "app.moyolearn.com didn’t return a class list. Try again in a few minutes.",
  error: "Classes didn’t load.",
} as const satisfies Record<ClassroomsFailure, string>;

/** A roster 404 is one class: archived, or no longer the teacher's. */
const ROSTER_COPY = {
  offline: OFFLINE_COPY,
  permission: PERMISSION_COPY,
  "not-found": "That class isn’t available any more. It may have been archived.",
  error: "The roster didn’t load.",
} as const satisfies Record<ClassroomsFailure, string>;

const NO_ROWS: readonly Enrollment[] = [];

/** Web pages from packages/app/features/classes/classes-paths.web.ts on main. */
const classesPath = () => "/teachers/classes";
const studentPath = (enrollmentId: string, classId: string) =>
  `/teachers/students/${encodeURIComponent(enrollmentId)}?classId=${encodeURIComponent(classId)}`;

function useDelayed(active: boolean): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return shown;
}

function openWeb(path: string, source: string): void {
  openURL(`${AUTH_ORIGIN}${path}`).catch((cause) => useShellStore.getState().reportError(source, cause));
}

function ClassList({ scheme }: { scheme: Scheme }) {
  const classes = useShellStore((state) => state.classes);
  const selected = useShellStore((state) => state.selectedClassId);
  const reportError = useShellStore((state) => state.reportError);
  const styles = usePaneStyles(scheme);
  const showLoading = useDelayed(classes.status === "loading");
  if (classes.status !== "ready") {
    return (
      <View style={styles.classList}>
        {showLoading ? <Text style={styles.muted}>Loading classes…</Text> : null}
        {classes.status === "failed" ? (
          <>
            <Text style={styles.muted} selectable>
              {CLASS_LIST_COPY[classes.reason]}
              {classes.reason === "error" ? ` ${classes.message}` : ""}
            </Text>
            <NativeButton variant="bordered" onPress={() => void loadClasses()} onError={(cause) => reportError("Reload Classes", cause)}>
              Try Again
            </NativeButton>
          </>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.classList} accessibilityRole="list" accessibilityLabel="Classes">
      {classes.classes.map((item) => {
        const active = item.id === selected;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${item.name}, grade ${item.gradeBand}`}
            onPress={() => selectClass(item.id)}
            style={[styles.classRow, active && styles.classRowActive]}
          >
            <Text style={[styles.className, active && styles.classNameActive]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.classMeta, active && styles.classNameActive]} numberOfLines={1}>
              {item.subject ? `${item.subject} · ` : ""}Grade {item.gradeBand} · Code {item.code}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Memoized: Legend List re-renders visible rows on scroll and on every filter keystroke. */
const RosterRow = memo(function RosterRow({ row, scheme }: { row: Enrollment; scheme: Scheme }) {
  const selected = useShellStore((state) => state.selectedEnrollmentId === row.id);
  const selectEnrollment = useShellStore((state) => state.selectEnrollment);
  const styles = usePaneStyles(scheme);
  const date = enrolledOn(row.enrolledAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Student ${row.learnerAuthId}, ${row.program ?? "no program"}, ${row.status}, enrolled ${date}`}
      onPress={() => selectEnrollment(row.id)}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <Text style={[styles.cell, styles.cellName]} numberOfLines={1} ellipsizeMode="middle">
        {row.learnerAuthId}
      </Text>
      <Text style={[styles.cell, styles.cellProgram]} numberOfLines={1}>
        {row.program ?? "—"}
      </Text>
      <Text style={[styles.cell, styles.cellStatus]} numberOfLines={1}>
        {row.status === "active" ? "Active" : "Inactive"}
      </Text>
      <Text style={[styles.cell, styles.cellDate]} numberOfLines={1}>
        {date}
      </Text>
    </Pressable>
  );
});

function Roster({ scheme }: { scheme: Scheme }) {
  const roster = useShellStore((state) => state.roster);
  const classes = useShellStore((state) => state.classes);
  const query = useShellStore((state) => state.rosterQuery);
  const setQuery = useShellStore((state) => state.setRosterQuery);
  const selectedEnrollment = useShellStore((state) => state.selectedEnrollmentId);
  const reportError = useShellStore((state) => state.reportError);
  const styles = usePaneStyles(scheme);
  const showLoading = useDelayed(roster.status === "loading");
  // Hooks run before the early returns below; filtering 10,000 rows reruns
  // only when the rows or the query change, not on selection or scroll.
  const allRows = roster.status === "ready" ? roster.rows : NO_ROWS;
  const rows = useMemo(() => filterRoster(allRows, query), [allRows, query]);
  const selectedRow = useMemo(() => allRows.find((row) => row.id === selectedEnrollment) ?? null, [allRows, selectedEnrollment]);

  if (classes.status === "ready" && classes.classes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.heading}>No classes yet</Text>
        <Text style={styles.muted}>Classes you create on app.moyolearn.com appear here with their rosters.</Text>
        <NativeButton variant="bordered" onPress={() => openWeb(classesPath(), "Create a Class")} onError={(cause) => reportError("Create a Class", cause)}>
          Create a Class in Browser…
        </NativeButton>
      </View>
    );
  }
  if (roster.status === "idle") return null;
  if (roster.status === "loading") return showLoading ? <Text style={styles.muted}>Loading roster…</Text> : null;
  if (roster.status === "failed") {
    return (
      <View style={styles.empty}>
        <Text style={styles.muted} selectable>
          {ROSTER_COPY[roster.reason]}
          {roster.reason === "error" ? ` ${roster.message}` : ""}
        </Text>
        <NativeButton variant="bordered" onPress={() => void loadRoster(roster.classId)} onError={(cause) => reportError("Reload Roster", cause)}>
          Try Again
        </NativeButton>
      </View>
    );
  }

  return (
    <View style={styles.roster}>
      <View style={styles.rosterBar}>
        <Text style={styles.count} accessibilityRole="text">
          {query.trim() ? `${rows.length.toLocaleString()} of ${countLabel(roster.rows.length)}` : countLabel(roster.rows.length)}
        </Text>
        <NativeTextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Filter roster"
          style={styles.filter}
          onError={(cause) => reportError("Filter roster", cause)}
        />
      </View>
      <View style={styles.rosterBar}>
        <NativeButton
          variant="bordered"
          disabled={!selectedRow}
          onPress={() => selectedRow && openWeb(studentPath(selectedRow.id, roster.classId), "Open Student")}
          onError={(cause) => reportError("Open Student", cause)}
        >
          Open Student in Browser…
        </NativeButton>
        <NativeButton
          variant="borderless"
          disabled={!selectedRow}
          onPress={() => {
            if (!selectedRow) return;
            setStringAsync(selectedRow.learnerAuthId).catch((cause) => reportError("Copy Student ID", cause));
          }}
          onError={(cause) => reportError("Copy Student ID", cause)}
        >
          Copy Student ID
        </NativeButton>
      </View>
      <View style={[styles.row, styles.headerRow]} accessibilityRole="header">
        <Text style={[styles.headerCell, styles.cellName]}>Student</Text>
        <Text style={[styles.headerCell, styles.cellProgram]}>Program</Text>
        <Text style={[styles.headerCell, styles.cellStatus]}>Status</Text>
        <Text style={[styles.headerCell, styles.cellDate]}>Enrolled</Text>
      </View>
      {roster.rows.length === 0 ? (
        <Text style={styles.muted}>No students in this class yet. Share the class code so students can join.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.muted} selectable>
          No student matches “{query.trim()}”.
        </Text>
      ) : (
        <LegendList
          style={styles.list}
          data={rows}
          keyExtractor={(row) => row.id}
          estimatedItemSize={space.section + space.tight}
          recycleItems
          renderItem={({ item }) => <RosterRow row={item} scheme={scheme} />}
        />
      )}
    </View>
  );
}

export function ClassroomsPane({ scheme }: { scheme: Scheme }) {
  const status = useShellStore((state) => state.classes.status);
  const styles = usePaneStyles(scheme);
  useEffect(() => {
    if (status === "idle") void loadClasses();
  }, [status]);
  return (
    <View style={styles.pane}>
      <ClassList scheme={scheme} />
      <Roster scheme={scheme} />
    </View>
  );
}

/** One StyleSheet per scheme, shared by every row instead of built per render. */
function usePaneStyles(scheme: Scheme) {
  return useMemo(() => paneStyles(scheme), [scheme]);
}

const paneStyleCache = new Map<Scheme, ReturnType<typeof buildPaneStyles>>();

function paneStyles(scheme: Scheme) {
  let styles = paneStyleCache.get(scheme);
  if (!styles) {
    styles = buildPaneStyles(scheme);
    paneStyleCache.set(scheme, styles);
  }
  return styles;
}

function buildPaneStyles(scheme: Scheme) {
  const rowHeight = space.section + space.tight;
  return StyleSheet.create({
    pane: { flexDirection: "row", gap: space.group, minHeight: rowHeight * 12 },
    classList: { width: space.section * 7, gap: space.hair },
    classRow: { paddingVertical: space.tight, paddingHorizontal: space.stack, borderRadius: corner.control, gap: space.hair },
    classRowActive: { backgroundColor: color("primary", scheme) },
    className: { ...textStyle("label"), color: color("text", scheme) },
    classMeta: { ...textStyle("caption"), color: color("text-muted", scheme) },
    classNameActive: { color: color("on-primary", scheme) },
    roster: { flex: 1, gap: space.stack },
    rosterBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.stack },
    count: { ...textStyle("caption"), color: color("text-muted", scheme), fontVariant: ["tabular-nums"] },
    filter: { width: space.section * 6 },
    list: { flex: 1, minHeight: rowHeight * 10 },
    headerRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color("surface-sunken", scheme) },
    headerCell: { ...textStyle("caption"), color: color("text-muted", scheme) },
    row: { flexDirection: "row", alignItems: "center", height: rowHeight, paddingHorizontal: space.tight, gap: space.stack },
    rowSelected: { backgroundColor: color("surface-sunken", scheme), borderRadius: corner.control },
    cell: { ...textStyle("body"), color: color("text", scheme) },
    cellName: { flex: 3, textAlign: "left" },
    cellProgram: { flex: 2, textAlign: "left" },
    cellStatus: { flex: 1, textAlign: "left" },
    cellDate: { flex: 2, textAlign: "right", fontVariant: ["tabular-nums"] },
    empty: { flex: 1, alignItems: "flex-start", gap: space.stack },
    heading: { ...textStyle("title"), color: color("text", scheme) },
    muted: { ...textStyle("body"), color: color("text-muted", scheme) },
  });
}
