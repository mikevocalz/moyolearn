/**
 * Classroom reads for the desktop: the teacher's classes, then one roster.
 *
 * Both go through the signed-in client (src/auth/session.ts) to
 * GET /api/teacher/classes and /api/teacher/classes/:id/roster on
 * app.moyolearn.com. The server scopes both to the acting teacher and refuses
 * a session with no organization membership (classes.service.ts READ_GATE on
 * main); a foreign class is 404, never 403. A result is applied only while
 * its ticket is current (requests.ts): a newer read of the same kind, a
 * sign-out, a server-ended session or a role change voids it, and so does a
 * different account being signed in by the time it returns.
 * SOT: packages/app/features/classes/classes.service.ts · docs/desktop/seams/D05.md
 * SOT-KEYWORDS: desktop classrooms load roster classes api request ticket account
 */
import { AuthHttpError, AuthOfflineError } from "../auth/client";
import { endSession, sessionClient } from "../auth/session";
import { useShellStore, type ClassroomsFailure } from "../store";
import { classesGate, rosterGate } from "./requests";
import { activeClasses, nextSelection } from "./roster";

function signedInAccountId(): string | null {
  const auth = useShellStore.getState().auth;
  return auth.status === "signed-in" ? auth.account.id : null;
}

function failure(cause: unknown): { reason: ClassroomsFailure; message: string } {
  if (cause instanceof AuthOfflineError) return { reason: "offline", message: cause.message };
  if (cause instanceof AuthHttpError) {
    if (cause.status === 403) return { reason: "permission", message: cause.message };
    if (cause.status === 404) return { reason: "not-found", message: cause.message };
  }
  return { reason: "error", message: cause instanceof Error ? cause.message : String(cause) };
}

async function signedOutByServer(cause: unknown): Promise<boolean> {
  if (cause instanceof AuthHttpError && cause.status === 401) {
    await endSession();
    return true;
  }
  return false;
}

export async function loadRoster(classId: string): Promise<void> {
  const ticket = rosterGate.start(signedInAccountId());
  if (ticket.accountId === null) return;
  useShellStore.getState().setRoster({ status: "loading", classId });
  try {
    const { roster } = await sessionClient.classRoster(classId);
    if (rosterGate.isCurrent(ticket, signedInAccountId())) {
      useShellStore.getState().setRoster({ status: "ready", classId, rows: roster });
    }
  } catch (cause) {
    if (!rosterGate.isCurrent(ticket, signedInAccountId())) return;
    if (await signedOutByServer(cause)) return;
    useShellStore.getState().setRoster({ status: "failed", classId, ...failure(cause) });
  }
}

/** A different class: clears the student selection and filter, then loads its roster. */
export function selectClass(classId: string): void {
  useShellStore.getState().selectClass(classId);
  void loadRoster(classId);
}

export async function loadClasses(): Promise<void> {
  const ticket = classesGate.start(signedInAccountId());
  if (ticket.accountId === null) return;
  useShellStore.getState().setClasses({ status: "loading" });
  try {
    const classes = activeClasses(await sessionClient.teacherClasses());
    if (!classesGate.isCurrent(ticket, signedInAccountId())) return;
    const store = useShellStore.getState();
    store.setClasses({ status: "ready", classes });
    const next = nextSelection(classes, store.selectedClassId);
    if (next.classId === null) {
      rosterGate.invalidate();
      store.selectClass(null);
      store.setRoster({ status: "idle" });
    } else if (next.unchanged) {
      // Same class: refresh its roster but keep the selected student and filter.
      void loadRoster(next.classId);
    } else {
      selectClass(next.classId);
    }
  } catch (cause) {
    if (!classesGate.isCurrent(ticket, signedInAccountId())) return;
    if (await signedOutByServer(cause)) return;
    // The roster on screen came from the list that just failed; drop it so the
    // pane shows the failure and Try Again, not a roster it can't vouch for.
    rosterGate.invalidate();
    const store = useShellStore.getState();
    store.setClasses({ status: "failed", ...failure(cause) });
    store.setRoster({ status: "idle" });
  }
}
