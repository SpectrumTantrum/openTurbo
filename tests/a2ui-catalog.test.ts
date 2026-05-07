import test from "node:test";
import assert from "node:assert/strict";
import { definitions, definitionFor, knownComponentNames } from "../src/renderer/a2ui/definitions.js";

test("definitions cover the eight study components", () => {
  assert.deepEqual(
    knownComponentNames().sort(),
    [
      "GenerationPreviewCard",
      "JobStatusCard",
      "PackProgressCard",
      "ReviewQueueCard",
      "SourcePickerCard",
      "StudyPlanCard",
      "SyncStatusCard",
      "WeakAreasCard"
    ].sort()
  );
});

test("definitionFor returns undefined for unknown names", () => {
  assert.equal(definitionFor("UnknownThing"), undefined);
});

test("StudyPlanCard definition validates a well-formed payload", () => {
  const def = definitionFor("StudyPlanCard");
  assert.ok(def);
  if (!def) return;
  const result = def.validateProps({
    title: "Today",
    steps: [{ id: "s1", label: "Review" }]
  });
  assert.equal(result.ok, true);
});

test("StudyPlanCard definition rejects missing required fields", () => {
  const def = definitionFor("StudyPlanCard");
  assert.ok(def);
  if (!def) return;
  const result = def.validateProps({ title: "Today" });
  assert.equal(result.ok, false);
});

test("definitions has a description string for each component", () => {
  for (const def of Object.values(definitions)) {
    assert.equal(typeof def.description, "string");
    assert.ok(def.description.length > 10, `${def.name} description should be substantive`);
  }
});
