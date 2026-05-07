import test from "node:test";
import assert from "node:assert/strict";
import { classifyAction, ACTION_REGISTRY } from "../src/renderer/a2ui/actionBoundary.js";

test("classify read-only navigation actions", () => {
  assert.equal(classifyAction("focus-source").kind, "read-only");
  assert.equal(classifyAction("focus-pack").kind, "read-only");
  assert.equal(classifyAction("open-review").kind, "read-only");
  assert.equal(classifyAction("filter-library").kind, "read-only");
});

test("classify mutating actions and require confirmation", () => {
  const generate = classifyAction("generate-pack");
  assert.equal(generate.kind, "mutating");
  assert.equal(generate.requiresConfirmation, true);

  const exportPack = classifyAction("export-pack");
  assert.equal(exportPack.kind, "mutating");
  assert.equal(exportPack.requiresConfirmation, true);

  const updateSettings = classifyAction("update-settings");
  assert.equal(updateSettings.kind, "mutating");
  assert.equal(updateSettings.requiresConfirmation, true);
});

test("classify blocked actions (delete, cancel-job, raw-html)", () => {
  assert.equal(classifyAction("delete-source").kind, "blocked");
  assert.equal(classifyAction("delete-pack").kind, "blocked");
  assert.equal(classifyAction("cancel-job").kind, "blocked");
  assert.equal(classifyAction("raw-html").kind, "blocked");
});

test("classify unknown action falls back to blocked", () => {
  assert.equal(classifyAction("totally-made-up-action").kind, "blocked");
});

test("ACTION_REGISTRY descriptions are non-empty", () => {
  for (const entry of Object.values(ACTION_REGISTRY)) {
    assert.ok(entry.description.length > 0);
  }
});
