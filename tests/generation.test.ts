import test from "node:test";
import assert from "node:assert/strict";
import { answerFromSources, buildStudyPack } from "../src/shared/generation.js";

test("buildStudyPack creates notes, cards, quiz, mind map, and podcast script", () => {
  const pack = buildStudyPack({
    id: "source",
    title: "Membrane Transport",
    text: "The plasma membrane regulates movement in and out of the cell. Diffusion is passive transport. Active transport uses energy."
  });

  assert.equal(pack.sourceId, "source");
  assert.ok(pack.sections.length >= 3);
  assert.ok(pack.flashcards.length >= 3);
  assert.ok(pack.quiz.length >= 1);
  assert.equal(pack.mindMap.label, "Membrane Transport");
  assert.match(pack.podcastScript, /Membrane Transport/);
});

test("answerFromSources cites the best available source", () => {
  const answer = answerFromSources("How does diffusion work?", [
    { id: "a", title: "Cell Transport", text: "Diffusion moves particles down a concentration gradient." }
  ]);

  assert.match(answer.content, /Cell Transport/);
  assert.equal(answer.citations[0].sourceId, "a");
});
