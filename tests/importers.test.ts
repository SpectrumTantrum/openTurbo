import test from "node:test";
import assert from "node:assert/strict";
import { detectImportKind, unsupportedImporterMessage } from "../src/main/importers.js";

test("detectImportKind recognizes local source types", () => {
  assert.equal(detectImportKind("lecture.pdf").kind, "pdf");
  assert.equal(detectImportKind("notes.md").kind, "markdown");
  assert.equal(detectImportKind("recording.mp3").kind, "audio");
});

test("detectImportKind recognizes YouTube URLs", () => {
  assert.equal(detectImportKind("https://www.youtube.com/watch?v=abc").kind, "youtube");
  assert.equal(detectImportKind("https://youtu.be/abc").kind, "youtube");
});

test("unsupportedImporterMessage explains deferred workers", () => {
  assert.match(unsupportedImporterMessage("lecture.pdf") ?? "", /ocr worker/);
  assert.equal(unsupportedImporterMessage("notes.txt"), undefined);
});
