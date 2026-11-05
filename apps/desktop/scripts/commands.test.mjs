// Role-gate and registry tests for src/commands.ts. Node 24 strips the
// file's types on import; commands.ts has type-only imports by design.
// SOT-KEYWORDS: desktop commands test role gate workspace
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMANDS,
  WORKSPACE_COMMANDS,
  WORKSPACE_ROLES,
  isCommandVisible,
  searchCommands,
  shortcutHint,
  visibleCommands,
} from "../src/commands.ts";

const workspaceIds = Object.values(WORKSPACE_COMMANDS);

test("a learner session sees no guardian, tutor, org or district command", () => {
  const visible = visibleCommands("menu", ["learner"]);
  for (const role of ["guardian", "tutor", "org", "district"]) {
    assert.equal(visible.includes(WORKSPACE_COMMANDS[role]), false, role);
  }
  assert.equal(visible.includes("workspace.learner"), true);
});

test("signed out hides every role-gated command", () => {
  for (const id of workspaceIds) assert.equal(isCommandVisible(id, []), false, id);
  for (const surface of ["menu", "palette", "context"]) {
    assert.deepEqual(visibleCommands(surface, []).filter((id) => workspaceIds.includes(id)), []);
  }
});

test("each role sees exactly its own workspace command", () => {
  for (const role of WORKSPACE_ROLES) {
    const visible = visibleCommands("menu", [role]).filter((id) => workspaceIds.includes(id));
    assert.deepEqual(visible, [WORKSPACE_COMMANDS[role]]);
  }
});

test("a session holding several roles sees each of them", () => {
  const visible = visibleCommands("palette", ["guardian", "tutor"]).filter((id) => workspaceIds.includes(id));
  assert.deepEqual(visible, ["workspace.guardian", "workspace.tutor"]);
});

test("ungated commands are visible signed out", () => {
  assert.equal(isCommandVisible("app.settings", []), true);
  assert.equal(isCommandVisible("help.report", []), true);
});

test("command search respects the role gate", () => {
  assert.deepEqual(searchCommands("tutor", ["learner"]), []);
  assert.deepEqual(searchCommands("tutor", ["tutor"]), ["workspace.tutor"]);
  assert.deepEqual(searchCommands("   ", ["tutor"]), []);
});

test("no two commands claim the same shortcut", () => {
  const seen = new Map();
  for (const [id, command] of Object.entries(COMMANDS)) {
    if (!command.shortcut) continue;
    const key = command.shortcut.toLowerCase();
    assert.equal(seen.has(key), false, `${id} and ${seen.get(key)} share ${command.shortcut}`);
    seen.set(key, id);
  }
});

test("menu labels that open a further step end in an ellipsis", () => {
  for (const id of ["app.settings", "file.chooseResource", "help.report", "help.diagnostics"]) {
    assert.match(COMMANDS[id].label, /…$/, id);
  }
});

test("shortcut hints use Apple modifier order", () => {
  assert.equal(shortcutHint("Cmd+K"), "⌘K");
  assert.equal(shortcutHint("Cmd+Ctrl+S"), "⌃⌘S");
  assert.equal(shortcutHint("Cmd+,"), "⌘,");
});
