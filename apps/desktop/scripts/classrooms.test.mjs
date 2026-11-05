// Roster helper tests for src/classrooms/roster.ts.
// SOT-KEYWORDS: desktop classrooms test roster filter
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeClasses, countLabel, enrolledOn, filterRoster, nextSelection } from "../src/classrooms/roster.ts";

const rows = [
  { id: "1", learnerAuthId: "usr_Ada", program: "Algebra", status: "active", enrolledAt: "2026-03-04T12:00:00.000Z" },
  { id: "2", learnerAuthId: "usr_Grace", program: null, status: "inactive", enrolledAt: "2026-01-10T12:00:00.000Z" },
];

test("filter matches label and program, case-insensitively", () => {
  assert.deepEqual(filterRoster(rows, "ada").map((r) => r.id), ["1"]);
  assert.deepEqual(filterRoster(rows, "ALGEBRA").map((r) => r.id), ["1"]);
  assert.equal(filterRoster(rows, "  ").length, 2);
  assert.equal(filterRoster(rows, "nobody").length, 0);
});

test("10,000 rows filter well under a frame budget", () => {
  const big = Array.from({ length: 10_000 }, (_, i) => ({ ...rows[0], id: String(i), learnerAuthId: `usr_${i}` }));
  const start = performance.now();
  const hits = filterRoster(big, "usr_99");
  const elapsed = performance.now() - start;
  assert.equal(hits.length, 111);
  assert.ok(elapsed < 50, `filter took ${elapsed.toFixed(1)} ms`);
});

test("archived classes are left out", () => {
  assert.deepEqual(activeClasses([{ id: "a", name: "A", gradeBand: "3-5", code: "X", status: "archived" }]), []);
});

test("dates and counts read plainly", () => {
  assert.equal(enrolledOn("2026-03-04T12:00:00.000Z", "en-US"), "Mar 4, 2026");
  assert.equal(enrolledOn("not a date"), "Unknown");
  assert.equal(countLabel(1), "1 student");
  assert.equal(countLabel(10000), (10000).toLocaleString() + " students");
});

test("a class reload keeps the selected class while it is listed, else picks the first", () => {
  const classes = [
    { id: "a", name: "A", gradeBand: "3-5", code: "X", status: "active" },
    { id: "b", name: "B", gradeBand: "3-5", code: "Y", status: "active" },
  ];
  assert.deepEqual(nextSelection(classes, "b"), { classId: "b", unchanged: true });
  assert.deepEqual(nextSelection(classes, "gone"), { classId: "a", unchanged: false });
  assert.deepEqual(nextSelection([], "b"), { classId: null, unchanged: false });
});

// Request tickets (src/classrooms/requests.ts).
import { classesGate, createRequestGate, invalidateClassrooms, rosterGate } from "../src/classrooms/requests.ts";

test("invalidateClassrooms voids classes and roster reads already in flight", () => {
  const classes = classesGate.start("acct-1");
  const roster = rosterGate.start("acct-1");
  assert.equal(classesGate.isCurrent(classes, "acct-1"), true);
  assert.equal(rosterGate.isCurrent(roster, "acct-1"), true);
  invalidateClassrooms();
  assert.equal(classesGate.isCurrent(classes, "acct-1"), false);
  assert.equal(rosterGate.isCurrent(roster, "acct-1"), false);
});

test("a read made for one account is dropped once another account is signed in, or none", () => {
  const gate = createRequestGate();
  const ticket = gate.start("acct-1");
  assert.equal(gate.isCurrent(ticket, "acct-2"), false);
  assert.equal(gate.isCurrent(ticket, null), false);
  assert.equal(gate.isCurrent(ticket, "acct-1"), true);
  gate.start("acct-1");
  assert.equal(gate.isCurrent(ticket, "acct-1"), false, "a newer read supersedes it");
});

// Client parsing of the teacher classes API (src/auth/client.ts).
import { AuthHttpError, createAuthClient } from "../src/auth/client.ts";
import { createCookieJar } from "../src/auth/cookie-jar.ts";

function clientAnswering(status, body) {
  let value = "better-auth.session_token=t";
  const jar = createCookieJar({ get: async () => value, set: async (v) => void (value = v), delete: async () => void (value = null) });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(body === undefined ? "" : JSON.stringify(body), { status });
  return { client: createAuthClient(jar), restore: () => (globalThis.fetch = original) };
}

async function rejectsWith(promise, status, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AuthHttpError, `expected AuthHttpError, got ${error}`);
    assert.equal(error.status, status);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

for (const [label, body] of [
  ["no ok flag", { classes: [] }],
  ["no classes array", { ok: true }],
  ["classes not an array", { ok: true, classes: {} }],
  ["null body", null],
]) {
  test(`teacherClasses throws on a 200 with ${label} instead of returning no classes`, async () => {
    const { client, restore } = clientAnswering(200, body);
    try {
      await rejectsWith(client.teacherClasses(), 502, /without a class list/);
    } finally {
      restore();
    }
  });
}

for (const [label, body] of [
  ["no ok flag", { class: { id: "a" }, roster: [] }],
  ["no roster array", { ok: true, class: { id: "a" } }],
  ["no class", { ok: true, roster: [] }],
]) {
  test(`classRoster throws on a 200 with ${label} instead of returning an empty roster`, async () => {
    const { client, restore } = clientAnswering(200, body);
    try {
      await rejectsWith(client.classRoster("a"), 502, /without a class and its students/);
    } finally {
      restore();
    }
  });
}

test("well-formed classes and roster responses pass through", async () => {
  let net = clientAnswering(200, { ok: true, classes: [] });
  try {
    assert.deepEqual(await net.client.teacherClasses(), []);
  } finally {
    net.restore();
  }
  net = clientAnswering(200, { ok: true, class: { id: "a" }, roster: [{ id: "e1" }] });
  try {
    assert.deepEqual(await net.client.classRoster("a"), { class: { id: "a" }, roster: [{ id: "e1" }] });
  } finally {
    net.restore();
  }
});

test("an app route's { error } body becomes the error message", async () => {
  const { client, restore } = clientAnswering(404, { error: "Not found" });
  try {
    await rejectsWith(client.classRoster("a"), 404, /^Not found$/);
  } finally {
    restore();
  }
});
