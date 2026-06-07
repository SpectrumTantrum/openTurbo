import { test, expect } from "./fixtures/app";
import type { Locator, Page } from "@playwright/test";

/**
 * Review session journeys (browser preview / in-memory client).
 *
 * The seed library ships one study pack ("Cellular Biology Fundamentals") whose
 * flashcards are all created `dueAt = now`, so on a fresh load every card in the
 * pack is due. The Review view renders one Card per due flashcard, each showing
 * the pack title (Badge), a due date, the front (question), the back, the source
 * title, and four rating buttons (again / hard / good / easy). When nothing is
 * due the view shows the "Nothing due right now" empty state.
 *
 * We weight assertions toward objective signals: console errors, the due-count
 * shrinking as we rate, and the empty state appearing once the queue drains.
 */

/** The sidebar Review nav button; its accessible name includes the count badge. */
function reviewNav(page: Page): Locator {
  return page.getByRole("button", { name: "Review" });
}

/** Cards rendered inside the Review workspace grid. */
function reviewCards(page: Page): Locator {
  return page.locator(".card-grid > .mantine-Card-root");
}

/** Open the Review view and wait for it to settle. */
async function openReview(page: Page) {
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(reviewNav(page)).toHaveAttribute("aria-current", "page");
  // The workspace title is plain Text (not a heading role). Wait on the unique
  // Review subtitle copy as the settle signal.
  await expect(page.getByText(/due cards across your study packs\.|Nothing due right now/)).toBeVisible();
}

/**
 * Parse the trailing integer in the Review nav button's accessible name, which
 * is the due-count badge. Returns 0 when no badge is rendered (badge is hidden
 * when the count is 0/falsy).
 */
async function reviewBadgeCount(page: Page): Promise<number> {
  const name = (await reviewNav(page).textContent())?.trim() ?? "";
  const match = name.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

test("Review grid lists every due card with its details and rating controls", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  const cards = reviewCards(page);
  const count = await cards.count();
  // The seed pack ships several cards, all due on first load.
  expect(count).toBeGreaterThan(0);

  // Subtitle and badge should agree with the rendered grid up front.
  await expect(page.getByText(`${count} due cards across your study packs.`)).toBeVisible();
  expect(await reviewBadgeCount(page)).toBe(count);

  // First card carries all the documented fields.
  const first = cards.first();
  // Pack title badge.
  await expect(first.getByText("Cellular Biology Fundamentals Study Pack")).toBeVisible();
  // Front (question) text.
  await expect(first.getByText(/What should you remember about/)).toBeVisible();
  // Source line.
  await expect(first.getByText(/^Source: /)).toBeVisible();
  // Four rating buttons.
  for (const rating of ["again", "hard", "good", "easy"]) {
    await expect(first.getByRole("button", { name: rating, exact: true })).toBeVisible();
  }

  await page.screenshot({ path: "test-results/review/shots/grid.png", fullPage: true });
  expect(consoleErrors, "Review grid logged console errors").toEqual([]);
});

test("rating a card with 'good' removes it from the queue and decrements the badge", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  const cards = reviewCards(page);
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);
  const badgeBefore = await reviewBadgeCount(page);
  expect(badgeBefore).toBe(before);

  // Rate the first card "good": scheduleReview pushes it >= 1 day out, so it
  // should leave the due queue.
  await cards.first().getByRole("button", { name: "good", exact: true }).click();

  // Grid shrinks by exactly one.
  await expect(cards).toHaveCount(before - 1);
  // Subtitle stays in sync.
  await expect(page.getByText(`${before - 1} due cards across your study packs.`)).toBeVisible();
  // Badge decrements to match the grid (objective: count consistency).
  await expect
    .poll(async () => reviewBadgeCount(page), { message: "Review badge did not match grid after rating" })
    .toBe(before - 1);

  await page.screenshot({ path: "test-results/review/shots/after-good.png", fullPage: true });
  expect(consoleErrors, "rating a card logged console errors").toEqual([]);
});

test("rating a card with 'again' still removes it from the queue and keeps counts in sync", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  const cards = reviewCards(page);
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);
  expect(await reviewBadgeCount(page)).toBe(before);

  // "again" reschedules the card only ~29 minutes out (nextInterval = 0.02 days),
  // the closest any rating comes to leaving the card due. It must still leave the
  // current queue (clockNow is at/just-before mount) — i.e. the click is not a no-op.
  await cards.first().getByRole("button", { name: "again", exact: true }).click();

  await expect(cards).toHaveCount(before - 1);
  await expect(page.getByText(`${before - 1} due cards across your study packs.`)).toBeVisible();
  await expect
    .poll(async () => reviewBadgeCount(page), { message: "badge did not match grid after 'again'" })
    .toBe(before - 1);

  expect(consoleErrors, "rating 'again' logged console errors").toEqual([]);
});

test("draining the queue surfaces the 'Nothing due right now' empty state", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  const cards = reviewCards(page);
  let remaining = await cards.count();
  expect(remaining).toBeGreaterThan(0);

  // Rate the first card "good" repeatedly until the queue is empty. Each rating
  // schedules the card at least a day out, so the grid should monotonically
  // shrink to zero. Guard with a generous iteration cap.
  let guard = 0;
  while (remaining > 0 && guard < 50) {
    await cards.first().getByRole("button", { name: "good", exact: true }).click();
    await expect(cards).toHaveCount(remaining - 1);
    remaining -= 1;
    guard += 1;
  }

  expect(remaining).toBe(0);

  // Empty state copy.
  await expect(page.getByText("Nothing due right now")).toBeVisible();
  await expect(page.getByText("New cards will appear here when their due date arrives.")).toBeVisible();
  // Subtitle reflects zero.
  await expect(page.getByText("0 due cards across your study packs.")).toBeVisible();
  // Badge is hidden once nothing is due.
  expect(await reviewBadgeCount(page)).toBe(0);

  await page.screenshot({ path: "test-results/review/shots/empty.png", fullPage: true });
  expect(consoleErrors, "draining the queue logged console errors").toEqual([]);
});

test("rapid double-click on a single card's rating button removes only that card", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  const cards = reviewCards(page);
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);

  // Resolve the FIRST card's "good" button to a single physical element so both
  // clicks target the same node (re-entrancy probe for one card, not a moving
  // first()). handleReview guards re-entry via the per-card loading flag, so a
  // genuine double-fire on the same card should still remove exactly one card.
  const goodHandle = await cards.first().getByRole("button", { name: "good", exact: true }).elementHandle();
  expect(goodHandle).not.toBeNull();
  await goodHandle!.click();
  // Second click on the now-detached/removed element: should be a harmless no-op
  // (the card left the grid), never a second decrement or a throw.
  await goodHandle!.click({ force: true, timeout: 1500 }).catch(() => {
    /* element detached after its card was removed — expected */
  });

  // Exactly one card removed.
  await expect(cards).toHaveCount(before - 1);

  expect(consoleErrors, "rapid double-click logged console errors").toEqual([]);
});

test("Review view stays intact across small and large viewports", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await openReview(page);

  await page.setViewportSize({ width: 900, height: 700 });
  await expect(reviewCards(page).first()).toBeVisible();
  await page.screenshot({ path: "test-results/review/shots/viewport-900.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(reviewCards(page).first()).toBeVisible();
  await page.screenshot({ path: "test-results/review/shots/viewport-1440.png", fullPage: true });

  expect(consoleErrors, "resizing Review logged console errors").toEqual([]);
});
