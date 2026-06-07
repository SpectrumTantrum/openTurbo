import { test, expect } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * Source import journeys (browser preview).
 *
 * Drives the "Import source" modal opened from the Library workspace:
 *   - the "Import and generate" primary button enable/disable gating
 *   - a full import → source appears → study pack is generated, auto-selected,
 *     and its tabs (Notes / Flashcards / Quiz / Mind map / Podcast) populate
 *   - edge cases: whitespace-only text, ~5000-char body, emoji/special chars,
 *     closing mid-entry then reopening, and importing twice
 *
 * Selectors are accessible-only (getByRole / getByLabel / getByPlaceholder /
 * getByText). The active nav button carries aria-current="page".
 */

/** Navigate to Library and confirm the three-pane workspace is up. */
async function gotoLibrary(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/^Sources \(\d+\)$/)).toBeVisible();
}

/** Open the Import modal and return its dialog locator. */
async function openImport(page: Page) {
  await page.getByRole("button", { name: "Import source" }).click();
  const dialog = page.getByRole("dialog", { name: "Import source" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * A source ROW button. Each title appears on up to four controls (source row,
 * pack row, plus their favorite ActionIcons), so we disambiguate the source row
 * by its accessible name suffix ("... TEXT · N KB").
 */
function sourceRow(page: Page, title: string) {
  return page.getByRole("button", { name: new RegExp(`${title}.*TEXT`) });
}

test("Import and generate button gates on the source text field", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);
  const dialog = await openImport(page);
  const submit = dialog.getByRole("button", { name: "Import and generate" });

  // On open, the Title field is pre-populated ("Lecture notes") but the source
  // text is empty, so the primary action is disabled.
  await expect(dialog.getByLabel("Title")).not.toHaveValue("");
  await expect(dialog.getByLabel("Paste source text")).toHaveValue("");
  await expect(submit).toBeDisabled();

  // Filling the source text enables it.
  await dialog.getByLabel("Paste source text").fill("Mitochondria are the powerhouse of the cell.");
  await expect(submit).toBeEnabled();

  // Clearing the text again disables it.
  await dialog.getByLabel("Paste source text").fill("");
  await expect(submit).toBeDisabled();

  expect(consoleErrors, "import modal gating logged console errors").toEqual([]);
});

test("importing a source generates an auto-selected study pack with populated tabs", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);

  // Baseline source count from the Sources section label.
  const sourcesLabel = page.getByText(/^Sources \(\d+\)$/);
  const before = Number((await sourcesLabel.textContent())!.match(/\((\d+)\)/)![1]);

  const dialog = await openImport(page);
  const title = `Cell Biology ${Date.now()}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog
    .getByLabel("Paste source text")
    .fill(
      "Photosynthesis converts light energy into chemical energy. The light reactions occur in the thylakoid membrane, while the Calvin cycle fixes carbon in the stroma."
    );
  await dialog.getByRole("button", { name: "Import and generate" }).click();

  // Modal closes once import + generation complete.
  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden({ timeout: 15_000 });

  // The new source appears in the Sources list and the count incremented.
  await expect(sourceRow(page, title)).toBeVisible();
  await expect(page.getByText(`Sources (${before + 1})`)).toBeVisible();

  // A study pack auto-selected → its detail tabs are rendered and populated.
  const tabNames = ["Notes", "Flashcards", "Quiz", "Mind map", "Podcast"];
  for (const name of tabNames) {
    await expect(page.getByRole("tab", { name }).first()).toBeVisible();
  }

  // Notes tab (the default selected tab) renders section headings, not an empty pane.
  await page.getByRole("tab", { name: "Notes" }).first().click();
  await expect(page.locator(".notes-view h2").first()).toBeVisible();
  await page.screenshot({ path: "test-results/import/shots/after-import-notes.png", fullPage: true });

  // Flashcards tab populates with cards (each has the SM-2 rating buttons).
  await page.getByRole("tab", { name: "Flashcards" }).first().click();
  await expect(page.locator(".card-grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "good" }).first()).toBeVisible();

  // Quiz tab populates with choices.
  await page.getByRole("tab", { name: "Quiz" }).first().click();
  await expect(page.locator(".choice").first()).toBeVisible();
  await page.screenshot({ path: "test-results/import/shots/after-import-quiz.png", fullPage: true });

  // Mind map tab renders the ReactFlow canvas (visual-breakage check).
  await page.getByRole("tab", { name: "Mind map" }).first().click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.screenshot({ path: "test-results/import/shots/after-import-mindmap.png", fullPage: true });

  expect(consoleErrors, "full import journey logged console errors").toEqual([]);
});

test("whitespace-only source text keeps the action disabled", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);
  const dialog = await openImport(page);
  const submit = dialog.getByRole("button", { name: "Import and generate" });

  await dialog.getByLabel("Paste source text").fill("       \n\t   \n   ");
  // trim() of whitespace is empty, so the button must remain disabled.
  await expect(submit).toBeDisabled();

  expect(consoleErrors, "whitespace-only entry logged console errors").toEqual([]);
});

test("a ~5000-char body imports without error", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);
  const dialog = await openImport(page);

  const big = "Spaced repetition strengthens long-term retention. ".repeat(100); // ~5000 chars
  expect(big.length).toBeGreaterThan(4500);

  const title = `Large import ${Date.now()}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Paste source text").fill(big);
  await dialog.getByRole("button", { name: "Import and generate" }).click();

  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden({ timeout: 20_000 });
  await expect(sourceRow(page, title)).toBeVisible();

  expect(consoleErrors, "large import logged console errors").toEqual([]);
});

test("emoji and special characters in title and body import cleanly", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);
  const dialog = await openImport(page);

  // "QuantumEMOJI<unique>" is a regex-safe marker; the rest exercises emoji,
  // angle brackets, ampersand entities and quotes for escaping/injection safety.
  const marker = `QuantumEMOJI${Date.now()}`;
  const title = `${marker} 🚀 <b>&amp;</b> "physics"`;
  await dialog.getByLabel("Title").fill(title);
  await dialog
    .getByLabel("Paste source text")
    .fill('Heisenberg said: "Δx·Δp ≥ ℏ/2" — uncertainty 😅 & entanglement <tags> are 100% wild.');
  await dialog.getByRole("button", { name: "Import and generate" }).click();

  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden({ timeout: 15_000 });
  // The emoji/special-char title renders verbatim (no HTML injection / escaping breakage).
  await expect(sourceRow(page, marker)).toBeVisible();

  await page.screenshot({ path: "test-results/import/shots/after-emoji-import.png", fullPage: true });

  expect(consoleErrors, "emoji/special-char import logged console errors").toEqual([]);
});

test("closing the modal mid-entry then reopening preserves the draft (no crash)", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);
  let dialog = await openImport(page);

  const draft = "Half-typed notes for the close/reopen check.";
  await dialog.getByLabel("Paste source text").fill(draft);
  await dialog.getByLabel("Title").fill("Throwaway draft");

  // Close via the dedicated close button.
  await dialog.getByRole("button", { name: "Close import source" }).click();
  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden();

  // Reopen cleanly. NOTE: the modal keeps component-level state, so the draft
  // text persists by design (draft preservation, not a reset-on-close field).
  dialog = await openImport(page);
  await expect(dialog.getByLabel("Paste source text")).toHaveValue(draft);
  await expect(dialog.getByLabel("Title")).toHaveValue("Throwaway draft");

  // Close again so this regression test leaves no modal open.
  await dialog.getByRole("button", { name: "Close import source" }).click();
  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden();

  expect(consoleErrors, "close/reopen logged console errors").toEqual([]);
});

test("importing twice in a row produces two distinct sources", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);

  const sourcesLabel = page.getByText(/^Sources \(\d+\)$/);
  const before = Number((await sourcesLabel.textContent())!.match(/\((\d+)\)/)![1]);

  for (let i = 1; i <= 2; i++) {
    const dialog = await openImport(page);
    const title = `RepeatImport${i}n${Date.now()}`;
    // handleImport clears the body but NOT the title, so re-fill the title each time.
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Paste source text").fill(`Body number ${i} for the repeat-import check.`);
    await dialog.getByRole("button", { name: "Import and generate" }).click();
    await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden({ timeout: 15_000 });
    await expect(sourceRow(page, title)).toBeVisible();
  }

  await expect(page.getByText(`Sources (${before + 2})`)).toBeVisible();

  expect(consoleErrors, "double import logged console errors").toEqual([]);
});

test("rapidly double-clicking Import and generate imports exactly one source", async ({ page, consoleErrors }) => {
  await gotoLibrary(page);

  const sourcesLabel = page.getByText(/^Sources \(\d+\)$/);
  const before = Number((await sourcesLabel.textContent())!.match(/\((\d+)\)/)![1]);

  const dialog = await openImport(page);
  const title = `RapidClick${Date.now()}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Paste source text").fill("Rapid double-click should not import twice.");

  const submit = dialog.getByRole("button", { name: "Import and generate" });
  // Fire two clicks back-to-back; the handler/loading state should coalesce them.
  await submit.click();
  await submit.click({ force: true }).catch(() => {});

  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden({ timeout: 15_000 });
  // Exactly one new source — not two duplicates from the double click.
  await expect(sourceRow(page, title)).toHaveCount(1);
  await expect(page.getByText(`Sources (${before + 1})`)).toBeVisible();

  expect(consoleErrors, "rapid double-click logged console errors").toEqual([]);
});

test("import modal renders cleanly at a small (900x700) viewport", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await gotoLibrary(page);
  const dialog = await openImport(page);

  // Core controls remain reachable and the primary action is present.
  await expect(dialog.getByLabel("Title")).toBeVisible();
  await expect(dialog.getByLabel("Paste source text")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Import and generate" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close import source" })).toBeVisible();

  await page.screenshot({ path: "test-results/import/shots/modal-900x700.png" });

  await dialog.getByRole("button", { name: "Close import source" }).click();
  await expect(page.getByRole("dialog", { name: "Import source" })).toBeHidden();

  expect(consoleErrors, "small-viewport modal logged console errors").toEqual([]);
});
