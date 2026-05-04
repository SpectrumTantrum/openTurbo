import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OpenTurboStore } from "../src/main/database.js";

test("OpenTurboStore persists import, generation, chat, review, and export flows", () => {
  const dir = mkdtempSync(join(tmpdir(), "openturbo-test-"));
  const store = new OpenTurboStore({
    databasePath: join(dir, "openturbo.sqlite"),
    storagePath: join(dir, "files"),
    exportPath: join(dir, "exports")
  });

  try {
    const source = store.importText({
      spaceId: "space_default",
      title: "Neural Signaling",
      text: "Neurons communicate through action potentials and synapses. Neurotransmitters cross synaptic clefts.",
      tags: ["neuroscience"]
    });
    const pack = store.generate({ sourceId: source.id, outputs: ["notes", "flashcards", "quiz"] });
    const message = store.chat({ scopeId: pack.id, message: "What crosses synaptic clefts?" });
    const reviewed = store.review({ cardId: pack.flashcards[0].id, rating: "easy" });
    const outputPath = store.exportPack(pack.id, "markdown");
    const snapshot = store.snapshot();

    assert.equal(source.title, "Neural Signaling");
    assert.equal(pack.sourceId, source.id);
    assert.equal(message.role, "assistant");
    assert.equal(reviewed.id, pack.id);
    assert.ok(outputPath.endsWith(".md"));
    assert.ok(snapshot.sources.some((candidate) => candidate.id === source.id));
    assert.ok(snapshot.jobs.length >= 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
