import { test, expect, type Page } from "./fixtures/app";

/**
 * Quiz tab journeys (browser preview, in-memory client).
 *
 * The seeded "Cellular Biology Fundamentals" study pack ships 5 quiz items.
 * Every seeded question has answerIndex 0, so the FIRST choice is always the
 * correct one (see src/shared/generation.ts). We exploit that to assert
 * correct/incorrect highlighting deterministically.
 *
 * Selectors are accessible-only. Quiz choices render as plain `.choice`
 * buttons carrying aria-pressed; the selected one also gets the `selected`
 * class, the correct one `correct`, and a wrong selection `incorrect`.
 *
 * NOTE: there are two "Quiz" controls in the workspace — the study TAB and an
 * "AI Actions" sidebar button. Always reach the tab via getByRole("tab").
 */

// Open Library and switch to the Quiz tab. Returns once choices are visible.
async function openQuiz(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();

  // The seeded source is auto-selected; click the Quiz study tab.
  await page.getByRole("tab", { name: "Quiz" }).click();

  // Quiz summary card is the anchor for this view.
  await expect(page.locator(".quiz-summary")).toBeVisible();
  await expect(page.locator(".choice").first()).toBeVisible();
}

// The summary line lives in the .quiz-summary card as "X of N answered · Y correct".
function summary(page: Page) {
  return page.locator(".quiz-summary");
}

test("quiz opens with a clean unanswered state", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  // 5 seeded questions, each with 4 choices → 20 choice buttons.
  await expect(summary(page)).toContainText("0 of 5 answered · 0 correct");

  const choices = page.locator(".choice");
  await expect(choices).toHaveCount(20);

  // Nothing answered → no choice is pressed, no highlighting classes.
  await expect(page.locator(".choice[aria-pressed='true']")).toHaveCount(0);
  await expect(page.locator(".choice.correct")).toHaveCount(0);
  await expect(page.locator(".choice.incorrect")).toHaveCount(0);

  // Reset is disabled before any answer.
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();

  expect(consoleErrors, "quiz view logged console errors").toEqual([]);
});

test("answering the correct choice updates summary, highlights, and reveals explanation", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  // Scope to the first question card (the card directly after the summary card).
  const firstQuestionChoices = page.locator(".choice");
  const correctChoice = firstQuestionChoices.nth(0); // answerIndex 0 → first choice

  await correctChoice.click();

  // aria-pressed flips on the selected choice.
  await expect(correctChoice).toHaveAttribute("aria-pressed", "true");
  // Correct selection picks up both .selected and .correct.
  await expect(correctChoice).toHaveClass(/selected/);
  await expect(correctChoice).toHaveClass(/\bcorrect\b/);
  await expect(correctChoice).not.toHaveClass(/incorrect/);

  // Summary reflects 1 answered, 1 correct.
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");

  // A "Correct" badge appears for that question.
  await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();

  // The explanation text is revealed after answering.
  await expect(page.getByText(/The correct answer is supported by/).first()).toBeVisible();

  // Reset becomes enabled once something is answered.
  await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();

  expect(consoleErrors).toEqual([]);
});

test("answering a wrong choice marks it incorrect and still reveals the correct one", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  // Within the first question (choices 0..3), pick choice index 1 (a distractor).
  const choices = page.locator(".choice");
  const wrongChoice = choices.nth(1);
  const correctChoice = choices.nth(0);

  await wrongChoice.click();

  // Selected wrong choice: pressed + selected + incorrect, not correct.
  await expect(wrongChoice).toHaveAttribute("aria-pressed", "true");
  await expect(wrongChoice).toHaveClass(/selected/);
  await expect(wrongChoice).toHaveClass(/incorrect/);
  await expect(wrongChoice).not.toHaveClass(/\bcorrect\b/);

  // The actual correct choice (index 0) is still highlighted as correct,
  // and is NOT pressed/selected.
  await expect(correctChoice).toHaveClass(/\bcorrect\b/);
  await expect(correctChoice).toHaveAttribute("aria-pressed", "false");

  // Summary: 1 answered, 0 correct.
  await expect(summary(page)).toContainText("1 of 5 answered · 0 correct");

  // "Review" badge for a wrong answer (scope to the quiz document pane — the
  // sidebar nav also has an sr-only "Review" label).
  await expect(page.locator(".document-scroll").getByText("Review", { exact: true })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("changing an answer within the same question moves the selection", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  const choices = page.locator(".choice");
  const correctChoice = choices.nth(0);
  const wrongChoice = choices.nth(2);

  // First answer wrong.
  await wrongChoice.click();
  await expect(summary(page)).toContainText("1 of 5 answered · 0 correct");
  await expect(wrongChoice).toHaveAttribute("aria-pressed", "true");

  // Change to the correct choice.
  await correctChoice.click();
  await expect(correctChoice).toHaveAttribute("aria-pressed", "true");
  // The previously selected wrong choice is no longer pressed/selected.
  await expect(wrongChoice).toHaveAttribute("aria-pressed", "false");
  await expect(wrongChoice).not.toHaveClass(/selected/);
  await expect(wrongChoice).not.toHaveClass(/incorrect/);

  // Still only 1 answered for this question, now counted correct.
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");

  expect(consoleErrors).toEqual([]);
});

test("clicking the same choice twice keeps it answered (no toggle-off)", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  const correctChoice = page.locator(".choice").nth(0);

  await correctChoice.click();
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");

  // Second click on the same choice — selection (and the count) should persist.
  await correctChoice.click();
  await expect(correctChoice).toHaveAttribute("aria-pressed", "true");
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");

  expect(consoleErrors).toEqual([]);
});

test("answering every question fills the summary, then Reset clears everything", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  // Each question has 4 choices; the correct one is the first of each group of 4.
  const choices = page.locator(".choice");
  const total = await choices.count();
  expect(total).toBe(20);

  for (let i = 0; i < total; i += 4) {
    await choices.nth(i).click(); // first choice of each question = correct
  }

  // All 5 answered, all correct.
  await expect(summary(page)).toContainText("5 of 5 answered · 5 correct");

  // Every question shows a "Correct" badge and an explanation.
  await expect(page.getByText("Correct", { exact: true })).toHaveCount(5);

  // The progress bar should reflect 100%.
  await expect(page.getByLabel("Quiz progress")).toHaveAttribute("aria-valuenow", "100");

  // Reset clears the board.
  const reset = page.getByRole("button", { name: "Reset" });
  await expect(reset).toBeEnabled();
  await reset.click();

  await expect(summary(page)).toContainText("0 of 5 answered · 0 correct");
  await expect(page.locator(".choice[aria-pressed='true']")).toHaveCount(0);
  await expect(page.locator(".choice.correct")).toHaveCount(0);
  await expect(page.locator(".choice.incorrect")).toHaveCount(0);
  await expect(reset).toBeDisabled();

  // Explanations are hidden again after reset.
  await expect(page.getByText(/The correct answer is supported by/)).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test("rapid double-clicking different choices does not corrupt the count", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  const choices = page.locator(".choice");

  // Hammer the first question's choices in quick succession.
  await choices.nth(0).click();
  await choices.nth(1).click();
  await choices.nth(2).click();
  await choices.nth(3).click();
  await choices.nth(0).click();

  // Exactly one selection remains for the first question.
  await expect(choices.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(summary(page)).toContainText("1 of 5 answered");

  expect(consoleErrors).toEqual([]);
});

test("quiz renders without breakage at small and large viewports", async ({ page, consoleErrors }) => {
  await openQuiz(page);

  // Answer one to exercise highlighting + explanation rendering across sizes.
  await page.locator(".choice").nth(0).click();

  await page.setViewportSize({ width: 900, height: 700 });
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");
  await page.screenshot({ path: "test-results/quiz/shots/quiz-900x700.png" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");
  // Viewport-only (not fullPage) so the layout is captured at 1:1, not scaled down.
  await page.screenshot({ path: "test-results/quiz/shots/quiz-1440x900.png" });

  expect(consoleErrors).toEqual([]);
});

/**
 * OBSERVED BEHAVIOR (reported as a finding, low confidence on intent):
 * Switching study tabs unmounts QuizView (App.tsx renders it via a bare
 * `{activeTab === "quiz" && <QuizView/>}` conditional, and QuizView holds answers
 * in local useState). Returning to the Quiz tab therefore resets the summary back
 * to "0 of 5 answered · 0 correct" and clears all selections — in-progress quiz
 * answers are silently lost on a quick tab switch.
 *
 * Left as test.fixme so the committed suite stays green and does NOT encode this
 * reset as the expected/intended behavior.
 */
test.fixme("in-progress quiz answers survive a tab switch (Notes and back)", async ({ page }) => {
  await openQuiz(page);

  await page.locator(".choice").nth(0).click();
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");

  await page.getByRole("tab", { name: "Notes" }).click();
  await expect(page.getByRole("heading", { name: /Core Summary/ })).toBeVisible();
  await page.getByRole("tab", { name: "Quiz" }).click();

  // EXPECTED (per this fixme's intent): answer is preserved.
  // ACTUAL: resets to "0 of 5 answered · 0 correct".
  await expect(summary(page)).toContainText("1 of 5 answered · 1 correct");
});
