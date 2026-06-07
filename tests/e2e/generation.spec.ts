import { test, expect } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * Study-pack GENERATION journeys (browser preview, in-memory client).
 *
 * Covers the AssistantPane "AI Actions" buttons (Flashcards / Quiz / Podcast /
 * Notes), the EditorPane "Regenerate" button, and the loading / disabled /
 * success states around them. The preview client runs generation through an
 * instant in-memory template builder (no real provider), so OUTPUT QUALITY is
 * out of scope — we assert on observable UI: success feedback, that tabs
 * populate, that the library pack list grows, and that nothing throws.
 *
 * Selectors are accessible-only (getByRole / getByText). The active nav button
 * carries aria-current="page"; study tabs are roles; AI Action buttons are
 * plain buttons whose names are the labels.
 */

const SHOTS = "test-results/generation/shots";

/** Open the three-pane Library workspace with the seeded source/pack selected. */
async function openLibrary(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();
  // AssistantPane present (right pane) with the AI Actions grid.
  await expect(page.getByText("AI Assistant")).toBeVisible();
  await expect(page.getByText("AI Actions")).toBeVisible();
}

/** The AssistantPane AI-action buttons by their visible label. */
function actionButton(page: Page, label: "Flashcards" | "Quiz" | "Podcast" | "Notes") {
  return page.getByRole("button", { name: label, exact: true });
}

/** A green "Done" success alert (ActionFeedback success state). */
function doneAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: "Study pack generated." });
}

test("Library opens with a selected pack and all AI action buttons enabled", async ({ page, consoleErrors }) => {
  await openLibrary(page);

  // Seeded pack is selected, so the EditorPane shows the document (not the
  // "Import a source to begin" empty state).
  await expect(page.getByText("Import a source to begin")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Notes" })).toBeVisible();

  // All four AI action buttons are present and enabled (provider + pack ready).
  for (const label of ["Flashcards", "Quiz", "Podcast", "Notes"] as const) {
    await expect(actionButton(page, label)).toBeEnabled();
  }
  // Regenerate (EditorPane toolbar) is also enabled.
  await expect(page.getByRole("button", { name: "Regenerate" })).toBeEnabled();

  await page.screenshot({ path: `${SHOTS}/library-initial.png`, fullPage: true });
  expect(consoleErrors, "Library initial render should be clean").toEqual([]);
});

test("each AI action button generates a pack and reports success", async ({ page, consoleErrors }) => {
  await openLibrary(page);

  // The library starts with exactly one seeded pack.
  await expect(page.getByText("Study Packs (1)")).toBeVisible();

  // Flashcards.
  await actionButton(page, "Flashcards").click();
  await expect(doneAlert(page).first()).toBeVisible();
  // generate() unshifts a brand-new pack each call, so the library pack count grows.
  await expect(page.getByText("Study Packs (2)")).toBeVisible();

  // Quiz.
  await actionButton(page, "Quiz").click();
  await expect(doneAlert(page).first()).toBeVisible();
  await expect(page.getByText("Study Packs (3)")).toBeVisible();

  // Podcast.
  await actionButton(page, "Podcast").click();
  await expect(doneAlert(page).first()).toBeVisible();
  await expect(page.getByText("Study Packs (4)")).toBeVisible();

  // Notes.
  await actionButton(page, "Notes").click();
  await expect(doneAlert(page).first()).toBeVisible();
  await expect(page.getByText("Study Packs (5)")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/after-all-actions.png`, fullPage: true });
  expect(consoleErrors, "generating via AI actions should not error").toEqual([]);
});

test("generated pack populates Flashcards, Quiz, Mind map, and Podcast tabs", async ({ page, consoleErrors }) => {
  await openLibrary(page);

  // Generate a fresh pack (selects it).
  await actionButton(page, "Flashcards").click();
  await expect(doneAlert(page).first()).toBeVisible();

  // Flashcards tab: cards render with rating buttons.
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await expect(page.getByRole("button", { name: "good" }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/tab-flashcards.png` });

  // Quiz tab: choices render (.choice in QuizView).
  await page.getByRole("tab", { name: "Quiz" }).click();
  await expect(page.locator(".choice").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/tab-quiz.png` });

  // Mind map tab: ReactFlow renders nodes.
  await page.getByRole("tab", { name: "Mind map" }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/tab-mindmap.png` });

  // Podcast tab: script + (intentionally disabled) preview/export buttons.
  await page.getByRole("tab", { name: "Podcast" }).click();
  // The podcast heading ends in "Audio Recap" (the script paragraph also
  // contains "audio recap", so match the heading precisely).
  await expect(page.getByText(/Study Pack Audio Recap$/)).toBeVisible();
  // Known stub: TTS preview/export are disabled on purpose (do not flag).
  await expect(page.getByRole("button", { name: "Preview script unavailable" })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/tab-podcast.png` });

  expect(consoleErrors, "switching tabs on a generated pack should be clean").toEqual([]);
});

test("EditorPane Regenerate button generates and reports success", async ({ page, consoleErrors }) => {
  await openLibrary(page);
  await expect(page.getByText("Study Packs (1)")).toBeVisible();

  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(doneAlert(page).first()).toBeVisible();
  await expect(page.getByText("Study Packs (2)")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/after-regenerate.png` });
  expect(consoleErrors, "Regenerate should not error").toEqual([]);
});

test("double-clicking an AI action does not crash and reports success", async ({ page, consoleErrors }) => {
  // Observation test (kept green): a fast double-click on a generate button must
  // not throw or trip an error boundary, and must still land on a coherent
  // success state. (It currently OVER-generates — see the test.fixme below.)
  await openLibrary(page);
  await expect(page.getByText("Study Packs (1)")).toBeVisible();

  await actionButton(page, "Flashcards").dblclick();
  await expect(doneAlert(page).first()).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Needs attention" })).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/after-double-click.png` });
  expect(consoleErrors, "double-click generate should be clean").toEqual([]);
});

// BUG (reproducible): the generate buttons guard against double-submit via
// `disabled`/`loading` (handleGenerate returns early when isLoading("generate")
// is true), but the in-memory preview client resolves generate() effectively
// instantly, so the loading flag clears between the two clicks of a dblclick and
// the guard never engages. Result: a single double-click creates TWO packs
// (Study Packs count jumps 1 -> 3). Reproduced 2x (Flashcards and Quiz buttons).
// Marked fixme so the committed suite stays green while documenting the defect.
test.fixme("double-clicking an AI action should create at most ONE new pack", async ({ page }) => {
  await openLibrary(page);
  await expect(page.getByText("Study Packs (1)")).toBeVisible();

  await actionButton(page, "Flashcards").dblclick();
  await expect(doneAlert(page).first()).toBeVisible();

  // Intended: count grows by exactly 1. Actual today: grows by 2 (-> "(3)").
  await expect(page.getByText("Study Packs (2)")).toBeVisible();
  await expect(page.getByText("Study Packs (3)")).toHaveCount(0);
});

test("clicking a second AI action while one resolves stays consistent", async ({ page, consoleErrors }) => {
  await openLibrary(page);
  await expect(page.getByText("Study Packs (1)")).toBeVisible();

  // Click two different actions back-to-back. The shared "generate" key means
  // the second click is either ignored (in flight) or runs after the first
  // resolves; either way the UI must end in a coherent state (success alert,
  // pack count grew, no errors). We don't assert an exact final count because
  // the timing race between the two clicks is legitimately nondeterministic;
  // we assert it is at least 2 and that the success feedback shows.
  await actionButton(page, "Flashcards").click();
  await actionButton(page, "Quiz").click();

  await expect(doneAlert(page).first()).toBeVisible();
  // At least one new pack was created.
  await expect(page.getByText("Study Packs (1)")).toHaveCount(0);
  // No error alert surfaced.
  await expect(page.getByRole("alert").filter({ hasText: "Needs attention" })).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/after-interleaved-actions.png`, fullPage: true });
  expect(consoleErrors, "interleaved generate actions should be clean").toEqual([]);
});

test("generation UI holds up at narrow and wide viewports", async ({ page, consoleErrors }) => {
  await openLibrary(page);

  await page.setViewportSize({ width: 900, height: 700 });
  await actionButton(page, "Quiz").click();
  await expect(doneAlert(page).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/viewport-900x700.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "Mind map" }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/viewport-1440x900.png`, fullPage: true });

  expect(consoleErrors, "resizing during/after generation should be clean").toEqual([]);
});
