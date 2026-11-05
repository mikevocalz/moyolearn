/**
 * Which classroom reads are still wanted.
 *
 * Each classes or roster read takes a ticket: a request number and the account
 * id it was made for. A result is applied only if no newer read of the same
 * kind started, nothing invalidated the gate, and the signed-in account is
 * still the one the ticket names. `invalidateClassrooms()` runs on sign-out,
 * a server-ended session and the store's role-change reset, so a read that
 * returns after any of those is dropped.
 * No imports: session.ts, store.ts and load.ts all use it without a cycle, and
 * scripts/classrooms.test.mjs loads it under Node.
 * SOT: docs/desktop/seams/D05.md
 * SOT-KEYWORDS: desktop classrooms request ticket invalidate sign-out account stale
 */

export interface RequestTicket {
  readonly id: number;
  readonly accountId: string | null;
}

export function createRequestGate() {
  let latest = 0;
  return {
    start(accountId: string | null): RequestTicket {
      latest += 1;
      return { id: latest, accountId };
    },
    isCurrent(ticket: RequestTicket, accountId: string | null): boolean {
      return ticket.id === latest && ticket.accountId !== null && ticket.accountId === accountId;
    },
    invalidate(): void {
      latest += 1;
    },
  };
}

export const classesGate = createRequestGate();
export const rosterGate = createRequestGate();

/** Voids every classes and roster read in flight. */
export function invalidateClassrooms(): void {
  classesGate.invalidate();
  rosterGate.invalidate();
}
