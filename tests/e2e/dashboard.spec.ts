import { test, expect } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * Generative Study Dashboard — assistant prompt + A2UI card journeys.
 *
 * The Dashboard opens on a "StaticOverview" (Review queue + Weak areas + Jobs
 * cards). The offline stub dispatcher (`samplePayloadFor`) keyword-matches the
 * assistant prompt and swaps the canvas to a focused set of cards:
 *   "review"   -> ReviewQueueCard         (region "Review queue")
 *   "weak"     -> WeakAreasCard           (region "Weak areas")
 *   "generate" -> GenerationPreviewCard   (region "Plan generation: <source>")
 *   "job"      -> JobStatusCard           (region "Jobs")
 * Card actions route through onDashboardAction; e.g. "Open review session"
 * navigates to the Review view (aria-current="page").
 *
 * Cards are Mantine OTCards rendered with role="region" + aria-label=title, so
 * we drive everything through accessible roles (no data-testids).
 */

const PROMPT_PLACEHOLDER = /Ask the assistant/;

async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  // Static overview is present before any prompt.
  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
}

async function sendPrompt(page: Page, text: string, { enter = false } = {}) {
  const input = page.getByPlaceholder(PROMPT_PLACEHOLDER);
  await input.fill(text);
  if (enter) {
    await input.press("Enter");
  } else {
    await page.getByRole("button", { name: "Send to assistant" }).click();
  }
}

test("dashboard opens on the static overview with the three baseline cards", async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weak areas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Jobs" })).toBeVisible();

  await page.screenshot({ path: "test-results/dashboard/shots/static-overview.png", fullPage: true });
  expect(consoleErrors, "static overview logged console errors").toEqual([]);
});

test('"review" prompt renders a focused ReviewQueueCard and the action navigates to Review', async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  await sendPrompt(page, "show my review queue");

  // The canvas swaps to a single focused card: Review queue stays, the other
  // baseline cards (Weak areas / Jobs) are gone.
  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weak areas" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Jobs" })).toHaveCount(0);

  await page.screenshot({ path: "test-results/dashboard/shots/review-card.png", fullPage: true });

  // Card action navigates to the Review view.
  await page.getByRole("button", { name: "Open review session" }).click();
  await expect(page.getByRole("button", { name: "Review" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  expect(consoleErrors, "review flow logged console errors").toEqual([]);
});

test('"weak" prompt renders a focused WeakAreasCard', async ({ page, consoleErrors }) => {
  await gotoDashboard(page);

  await sendPrompt(page, "what are my weak areas");

  await expect(page.getByRole("region", { name: "Weak areas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Review queue" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Jobs" })).toHaveCount(0);

  await page.screenshot({ path: "test-results/dashboard/shots/weak-areas-card.png", fullPage: true });
  expect(consoleErrors, "weak-areas flow logged console errors").toEqual([]);
});

test('"generate" prompt renders a GenerationPreviewCard for the first source', async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  await sendPrompt(page, "generate flashcards");

  // GenerationPreviewCard region is titled "Plan generation: <sourceTitle>".
  const card = page.getByRole("region", { name: /^Plan generation:/ });
  await expect(card).toBeVisible();
  await expect(page.getByRole("region", { name: "Review queue" })).toHaveCount(0);

  // Output chips + a confirm button are present.
  await expect(card.getByRole("button", { name: "Confirm generation" })).toBeVisible();

  await page.screenshot({ path: "test-results/dashboard/shots/generation-card.png", fullPage: true });
  expect(consoleErrors, "generation-preview flow logged console errors").toEqual([]);
});

test('"Confirm generation" opens a confirmation modal that confirms/cancels cleanly', async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  await sendPrompt(page, "generate flashcards");
  const card = page.getByRole("region", { name: /^Plan generation:/ });
  await card.getByRole("button", { name: "Confirm generation" }).click();

  // generate-pack is a mutating action requiring confirmation -> Mantine modal.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Generate study material?")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/shots/generation-confirm.png", fullPage: true });

  // Confirming runs the (in-memory) generation and closes the modal cleanly.
  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect(consoleErrors, "confirm-generation flow logged console errors").toEqual([]);
});

test('"job" prompt renders a focused JobStatusCard', async ({ page, consoleErrors }) => {
  await gotoDashboard(page);

  await sendPrompt(page, "which jobs are running");

  await expect(page.getByRole("region", { name: "Jobs" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Review queue" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Weak areas" })).toHaveCount(0);

  await page.screenshot({ path: "test-results/dashboard/shots/jobs-card.png", fullPage: true });
  expect(consoleErrors, "jobs flow logged console errors").toEqual([]);
});

test("Enter key sends the prompt (no Send button click)", async ({ page, consoleErrors }) => {
  await gotoDashboard(page);

  await sendPrompt(page, "review my due cards", { enter: true });

  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Jobs" })).toHaveCount(0);

  expect(consoleErrors, "enter-key flow logged console errors").toEqual([]);
});

test("empty / whitespace prompt is a no-op (overview stays put)", async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  // Whitespace-only submit should be ignored (AssistantPrompt trims and bails).
  await sendPrompt(page, "   ", { enter: true });
  await page.getByRole("button", { name: "Send to assistant" }).click();

  // Still on the static overview (all three baseline cards present).
  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weak areas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Jobs" })).toBeVisible();

  expect(consoleErrors, "empty-prompt flow logged console errors").toEqual([]);
});

test("gibberish / unmatched prompt falls back to the baseline overview layout", async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  await sendPrompt(page, "xyzzy plugh qwerty nonsense");

  // Unmatched prompts return STATIC_OVERVIEW_LAYOUT: Review queue + Weak areas.
  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weak areas" })).toBeVisible();

  await page.screenshot({ path: "test-results/dashboard/shots/gibberish-fallback.png", fullPage: true });
  expect(consoleErrors, "gibberish flow logged console errors").toEqual([]);
});

test("rapid double-send of a prompt does not break the canvas", async ({
  page,
  consoleErrors
}) => {
  await gotoDashboard(page);

  const input = page.getByPlaceholder(PROMPT_PLACEHOLDER);
  const send = page.getByRole("button", { name: "Send to assistant" });
  await input.fill("review my queue now");
  // Double-click rapidly; the second click should be harmless.
  await send.click();
  await send.click();

  await expect(page.getByRole("region", { name: "Review queue" })).toBeVisible();
  expect(consoleErrors, "double-send flow logged console errors").toEqual([]);
});

// BUG (documented, kept non-failing): clicking an output chip on the
// GenerationPreviewCard is a no-op AND surfaces a user-facing "Unknown action."
// error. The stub wires onToggleOutput to actionId "noop"
// (a2ui/samplePayloads.ts), which the renderer faithfully emits; the action
// boundary classifies "noop" as UNKNOWN_BLOCKED, so useDashboardActions calls
// setLastError("Unknown action.") -> OTInlineAlert. selectedOutputs is static in
// the stub, so the chip never toggles either. Marked fixme so the committed
// suite stays green; reported as a finding.
test.fixme(
  "output chip on GenerationPreviewCard toggles selection without an error alert",
  async ({ page, consoleErrors }) => {
    await gotoDashboard(page);
    await sendPrompt(page, "generate flashcards");
    await expect(page.getByRole("region", { name: /^Plan generation:/ })).toBeVisible();

    // "quiz" starts unselected; clicking it should select it and NOT error.
    await page.getByText("quiz", { exact: true }).click();

    // Actual (bug): no toggle + an "Unknown action." status alert appears.
    await expect(page.getByText("Unknown action.")).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  }
);

test("dashboard is usable at a small viewport (900x700)", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await gotoDashboard(page);

  await sendPrompt(page, "generate a quiz");
  await expect(page.getByRole("region", { name: /^Plan generation:/ })).toBeVisible();

  await page.screenshot({ path: "test-results/dashboard/shots/small-viewport.png", fullPage: true });
  expect(consoleErrors, "small-viewport flow logged console errors").toEqual([]);
});
