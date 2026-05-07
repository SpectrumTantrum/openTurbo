import test from "node:test";
import assert from "node:assert/strict";
import {
  UnknownComponentError,
  InvalidPropsError,
  BlockedActionError,
  describeRendererFailure
} from "../src/renderer/a2ui/errors.js";

test("UnknownComponentError carries component name", () => {
  const err = new UnknownComponentError("FooCard");
  assert.equal(err.name, "UnknownComponentError");
  assert.equal(err.componentName, "FooCard");
});

test("InvalidPropsError carries name + validation detail", () => {
  const err = new InvalidPropsError("StudyPlanCard", ".steps[0].label: expected string");
  assert.equal(err.componentName, "StudyPlanCard");
  assert.match(err.detail, /steps\[0\]\.label/);
});

test("BlockedActionError carries action id and reason", () => {
  const err = new BlockedActionError("delete-source", "deletion not allowed via agent");
  assert.equal(err.actionId, "delete-source");
  assert.match(err.reason, /not allowed/);
});

test("describeRendererFailure returns a concise label in production mode", () => {
  const desc = describeRendererFailure(new InvalidPropsError("StudyPlanCard", ".steps[0]: oops"), { dev: false });
  assert.match(desc.headline, /Couldn.t render/);
  assert.equal(desc.detail, undefined);
});

test("describeRendererFailure returns detail in dev mode", () => {
  const desc = describeRendererFailure(new InvalidPropsError("StudyPlanCard", ".steps[0]: oops"), { dev: true });
  assert.match(desc.detail ?? "", /steps\[0\]/);
});
