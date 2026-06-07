import { test, expect } from "./fixtures/app";

/**
 * Proof-of-harness journey: opens on the Dashboard, navigates to the Library
 * three-pane workspace, and opens the Import modal. If this is green, the
 * browser-preview harness (server reuse, selectors, console collector) works.
 */
test("dashboard renders and the Library import modal opens", async ({ page, consoleErrors }) => {
  await page.goto("/");

  // App opens on the Generative Study Dashboard. (The sidebar is icon-only —
  // "OpenTurbo" lives in the document title, not as visible text.)
  await expect(page).toHaveTitle(/OpenTurbo/);
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Review queue")).toBeVisible();

  // Navigate to the Library three-pane workspace.
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();
  await expect(page.getByText("AI Assistant")).toBeVisible();

  // Import modal opens; the primary button is disabled until title + text are filled.
  await page.getByRole("button", { name: "Import source" }).click();
  const dialog = page.getByRole("dialog", { name: "Import source" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Import and generate" })).toBeDisabled();

  // Objective signal: no unexpected console errors over the whole journey.
  expect(consoleErrors, "page logged unexpected console errors").toEqual([]);
});
