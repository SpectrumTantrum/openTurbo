import type { Flashcard, ReviewInput } from "./types.js";

const ratingMultipliers: Record<ReviewInput["rating"], number> = {
  again: 0,
  hard: 0.6,
  good: 1,
  easy: 1.8
};

export function scheduleReview(card: Flashcard, rating: ReviewInput["rating"], now = new Date()): Flashcard {
  const multiplier = ratingMultipliers[rating];
  const lapses = rating === "again" ? card.lapses + 1 : card.lapses;
  const ease = Math.max(1.3, card.ease + (rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : rating === "again" ? -0.25 : 0));
  const nextInterval = rating === "again" ? 0.02 : Math.max(1, Math.round((card.intervalDays || 1) * ease * multiplier));
  const due = new Date(now);
  due.setMinutes(due.getMinutes() + Math.round(nextInterval * 24 * 60));

  return {
    ...card,
    ease,
    lapses,
    intervalDays: nextInterval,
    dueAt: due.toISOString()
  };
}

export function calculateMastery(cards: Flashcard[], now = new Date()): number {
  if (cards.length === 0) {
    return 0;
  }

  const dueMs = now.getTime();
  const score = cards.reduce((total, card) => {
    const isDue = new Date(card.dueAt).getTime() <= dueMs;
    const stability = Math.min(1, card.intervalDays / 30);
    return total + (isDue ? stability * 0.5 : 0.55 + stability * 0.45);
  }, 0);

  return Math.round((score / cards.length) * 100);
}

export function dueCards(cards: Flashcard[], now = new Date()): Flashcard[] {
  const threshold = now.getTime();
  return cards.filter((card) => new Date(card.dueAt).getTime() <= threshold);
}
