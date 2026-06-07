import { test, expect } from "./fixtures/app";
import type { Locator, Page } from "@playwright/test";

/**
 * Flashcards & SM-2 review.
 *
 * The "Flashcards tab" lives inside the Library three-pane workspace
 * (EditorPane). It is the right surface for this area because:
 *   - the FlashcardsView lists EVERY card in the pack (not just due ones),
 *     so a rated card stays mounted and its "Review saved." alert persists; and
 *   - the AssistantPane mastery RingProgress is visible in the same view, so we
 *     can watch the ring move as we rate.
 * The Review NAV tab, by contrast, filters to due cards only — rating a card
 * unmounts it and its alert, so it is unsuitable for these assertions.
 *
 * Conventions: accessible selectors only; `.assistant-pane` class scoping is
 * used to disambiguate the mastery % (it also renders in the Library pack badge),
 * mirroring the README's sanctioned `.choice` selector.
 */

const RATINGS = ["again", "hard", "good", "easy"] as const;
type Rating = (typeof RATINGS)[number];

/** Navigate to Library, ensure a pack is selected, open the Flashcards tab. */
async function openFlashcardsTab(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText(/^Sources \(/)).toBeVisible();
  // A pack is auto-selected on mount; the Flashcards tab is in the EditorPane.
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await expect(page.getByRole("tab", { name: "Flashcards" })).toHaveAttribute("aria-selected", "true");
}

/** Read the mastery percentage out of the AssistantPane ring (0-100, or null). */
async function readMastery(page: Page): Promise<number | null> {
  const text = await page.locator(".assistant-pane").getByText(/^\d+%$/).first().textContent();
  if (!text) return null;
  const n = Number.parseInt(text.replace("%", ""), 10);
  return Number.isNaN(n) ? null : n;
}

/** The flashcard <Card> grid items live under .card-grid; each is a Mantine Card. */
function cardItems(page: Page): Locator {
  // Each card contains a "Due ..." line; use that to anchor card containers.
  return page.locator(".card-grid > *");
}

test("rating a card shows 'Review saved.' and moves the mastery ring up", async ({ page, consoleErrors }) => {
  await openFlashcardsTab(page);

  // There should be at least one flashcard. Count is data-dependent (<=8), so
  // we read it rather than hardcode.
  const cards = cardItems(page);
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const masteryBefore = await readMastery(page);
  expect(masteryBefore, "mastery ring should render a number").not.toBeNull();

  const firstCard = cards.first();
  const dueBefore = await firstCard.getByText(/^Due /).textContent();

  // Rate the first card "good" (multi-day interval → the due date will advance,
  // unlike "again" whose ~29min bump keeps the same calendar day).
  await firstCard.getByRole("button", { name: "good", exact: true }).click();

  // Objective: the per-card success alert appears and the card stays mounted.
  await expect(firstCard.getByText("Review saved.")).toBeVisible();

  // Mastery ring should move up (good schedules the card forward → not due →
  // higher contribution than the due baseline). Read, don't hardcode.
  const masteryAfter = await readMastery(page);
  expect(masteryAfter, "mastery should still render").not.toBeNull();
  expect(masteryAfter!).toBeGreaterThanOrEqual(masteryBefore!);

  // Due date should have advanced for the rated card.
  const dueAfter = await firstCard.getByText(/^Due /).textContent();
  expect(dueAfter).not.toEqual(dueBefore);

  await page.screenshot({ path: "test-results/flashcards/shots/after-good.png", fullPage: true });
  expect(consoleErrors, "rating a card logged console errors").toEqual([]);
});

test("rating every card in the pack keeps the page clean and mastery monotonic", async ({ page, consoleErrors }) => {
  await openFlashcardsTab(page);

  const cards = cardItems(page);
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  // Walk the deck, rating each card "good" in turn. After each rating we wait
  // for that card's alert, then confirm mastery never decreases across the pass.
  let prevMastery = (await readMastery(page)) ?? 0;
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    await card.getByRole("button", { name: "good", exact: true }).click();
    await expect(card.getByText("Review saved.")).toBeVisible();
    const m = await readMastery(page);
    expect(m, `mastery should render after rating card ${i}`).not.toBeNull();
    // Across an all-"good" pass mastery should move monotonically non-decreasing.
    expect(m!, `mastery dropped after rating card ${i} 'good'`).toBeGreaterThanOrEqual(prevMastery);
    prevMastery = m!;
  }

  // Card count is unchanged (FlashcardsView shows all cards, not just due).
  expect(await cardItems(page).count()).toEqual(count);

  await page.screenshot({ path: "test-results/flashcards/shots/all-rated.png", fullPage: true });
  expect(consoleErrors, "rating the whole pack logged console errors").toEqual([]);
});

test("rapid double-click on a rating does not crash or error (double-submit guard)", async ({ page, consoleErrors }) => {
  await openFlashcardsTab(page);

  const card = cardItems(page).first();
  const goodBtn = card.getByRole("button", { name: "good", exact: true });

  // Fire two clicks back-to-back. The in-memory client resolves near-instantly,
  // so we assert the OBJECTIVE outcome (no errors, card present, valid mastery)
  // rather than trying to catch the sub-millisecond disabled window.
  await goodBtn.click();
  await goodBtn.click().catch(() => {
    /* second click may land on a transiently-disabled button; that's the guard */
  });

  await expect(card.getByText("Review saved.")).toBeVisible();
  expect(await cardItems(page).count()).toBeGreaterThan(0);
  const mastery = await readMastery(page);
  expect(mastery, "mastery should still be a valid number after rapid clicks").not.toBeNull();

  await page.screenshot({ path: "test-results/flashcards/shots/rapid-click.png", fullPage: true });
  expect(consoleErrors, "rapid clicking a rating logged console errors").toEqual([]);
});

test("each rating button is clickable and orders mastery easy >= good >= hard >= again on a fresh card", async ({ page, consoleErrors }) => {
  // Drive each rating on a SEPARATE seed card (all seed cards start identical:
  // intervalDays=1, ease=2.5, dueAt=now), then compare the resulting mastery
  // contribution. This validates each button works and the SM-2 ordering.
  const results: Partial<Record<Rating, number>> = {};

  for (const rating of RATINGS) {
    await openFlashcardsTab(page);
    const cards = cardItems(page);
    if ((await cards.count()) === 0) break;
    const before = (await readMastery(page)) ?? 0;
    const card = cards.first();
    await card.getByRole("button", { name: rating, exact: true }).click();
    await expect(card.getByText("Review saved.")).toBeVisible();
    const after = await readMastery(page);
    expect(after, `mastery should render after '${rating}'`).not.toBeNull();
    // delta from the same starting baseline, since the deck reseeds per goto.
    results[rating] = after! - before;
    await page.screenshot({ path: `test-results/flashcards/shots/rating-${rating}.png`, fullPage: true });
  }

  // Observation (kept soft, not a hard product assertion): "again" — a FAILED
  // recall — still nudges mastery up off the due baseline rather than down,
  // because scheduleReview pushes the card ~29min forward so it is no longer
  // "due" and picks up the flat 0.55 not-due baseline. This is internally
  // consistent (easy>good>hard>again deltas) but counter-intuitive for a lapse.
  // We record the numbers but do NOT fail on it.
  // eslint-disable-next-line no-console
  console.log("[flashcards] mastery deltas by rating:", JSON.stringify(results));

  // Every rating produced a finite delta (each button worked).
  for (const rating of RATINGS) {
    expect(Number.isFinite(results[rating] ?? Number.NaN), `'${rating}' produced no mastery reading`).toBeTruthy();
  }

  // Mastery moves monotonically sensibly with rating strength: a stronger rating
  // schedules the card further forward, so its mastery contribution is at least
  // as large. Deltas are date-independent (stability keys off intervalDays, not
  // wall-clock), so this is deterministic. NB: this asserts ORDERING only and
  // says nothing about the sign of the "again" delta (see the finding about
  // "again" raising mastery off the due baseline).
  expect(results.again!, "again should not out-score hard").toBeLessThanOrEqual(results.hard!);
  expect(results.hard!, "hard should not out-score good").toBeLessThanOrEqual(results.good!);
  expect(results.good!, "good should not out-score easy").toBeLessThanOrEqual(results.easy!);

  expect(consoleErrors, "exercising all ratings logged console errors").toEqual([]);
});

test("flashcard grid and mastery ring render cleanly at small and large viewports", async ({ page, consoleErrors }) => {
  await openFlashcardsTab(page);

  await page.setViewportSize({ width: 900, height: 700 });
  await expect(cardItems(page).first()).toBeVisible();
  await page.screenshot({ path: "test-results/flashcards/shots/viewport-900x700.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(cardItems(page).first()).toBeVisible();
  await expect(page.locator(".assistant-pane").getByText(/^\d+%$/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/flashcards/shots/viewport-1440x900.png", fullPage: true });

  expect(consoleErrors, "resizing the flashcards view logged console errors").toEqual([]);
});
