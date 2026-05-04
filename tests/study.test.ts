import test from "node:test";
import assert from "node:assert/strict";
import { calculateMastery, dueCards, scheduleReview } from "../src/shared/study.js";
import type { Flashcard } from "../src/shared/types.js";

test("scheduleReview moves a good card into the future", () => {
  const card = sampleCard();
  const reviewed = scheduleReview(card, "good", new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(reviewed.lapses, 0);
  assert.ok(new Date(reviewed.dueAt).getTime() > new Date("2026-01-01T00:00:00.000Z").getTime());
});

test("scheduleReview records lapses for again", () => {
  const reviewed = scheduleReview(sampleCard(), "again", new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(reviewed.lapses, 1);
  assert.ok(reviewed.ease < 2.5);
});

test("calculateMastery returns a percentage", () => {
  const mastery = calculateMastery([sampleCard({ dueAt: "2026-02-01T00:00:00.000Z", intervalDays: 10 })], new Date("2026-01-01T00:00:00.000Z"));
  assert.ok(mastery > 0);
  assert.ok(mastery <= 100);
});

test("dueCards filters cards due before now", () => {
  const cards = [
    sampleCard({ id: "due", dueAt: "2026-01-01T00:00:00.000Z" }),
    sampleCard({ id: "later", dueAt: "2026-02-01T00:00:00.000Z" })
  ];
  assert.deepEqual(
    dueCards(cards, new Date("2026-01-02T00:00:00.000Z")).map((card) => card.id),
    ["due"]
  );
});

function sampleCard(patch: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card",
    packId: "pack",
    front: "Front",
    back: "Back",
    dueAt: "2026-01-01T00:00:00.000Z",
    intervalDays: 1,
    ease: 2.5,
    lapses: 0,
    ...patch
  };
}
