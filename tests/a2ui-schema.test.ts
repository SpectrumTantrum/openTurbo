import test from "node:test";
import assert from "node:assert/strict";
import { S, validate } from "../src/renderer/a2ui/schema.js";

test("S.string accepts strings, rejects others with path", () => {
  const ok = validate(S.string(), "hi");
  assert.deepEqual(ok, { ok: true, value: "hi" });
  const bad = validate(S.string(), 1);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /expected string/i);
});

test("S.number accepts numbers, S.boolean accepts booleans", () => {
  assert.deepEqual(validate(S.number(), 5), { ok: true, value: 5 });
  assert.deepEqual(validate(S.boolean(), true), { ok: true, value: true });
  assert.equal(validate(S.number(), "5").ok, false);
});

test("S.array enforces item schema and reports index", () => {
  const ok = validate(S.array(S.string()), ["a", "b"]);
  assert.deepEqual(ok, { ok: true, value: ["a", "b"] });
  const bad = validate(S.array(S.string()), ["a", 2]);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /\[1\]/);
});

test("S.object validates required fields, rejects extra fields by default", () => {
  const schema = S.object({ id: S.string(), count: S.number() });
  const ok = validate(schema, { id: "x", count: 2 });
  assert.deepEqual(ok, { ok: true, value: { id: "x", count: 2 } });
  const missing = validate(schema, { id: "x" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /\.count/);
  const extra = validate(schema, { id: "x", count: 2, hidden: true });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.match(extra.error, /unexpected field "hidden"/i);
});

test("S.optional allows undefined", () => {
  const schema = S.object({ id: S.string(), tag: S.optional(S.string()) });
  const ok = validate(schema, { id: "x" });
  assert.deepEqual(ok, { ok: true, value: { id: "x", tag: undefined } });
});

test("S.literal and S.enum match exact values", () => {
  assert.equal(validate(S.literal("notes"), "notes").ok, true);
  assert.equal(validate(S.literal("notes"), "flashcards").ok, false);
  assert.equal(validate(S.enum(["a", "b"] as const), "a").ok, true);
  assert.equal(validate(S.enum(["a", "b"] as const), "c").ok, false);
});
