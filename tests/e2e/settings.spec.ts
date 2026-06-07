import { test, expect } from "./fixtures/app";

/**
 * Settings & providers journeys.
 *
 * The Settings drawer is opened from the icon-only sidebar "Settings" nav button
 * (which both selects the Settings nav and opens the right-side Mantine Drawer,
 * role=dialog name "Settings"). It shows:
 *   - a "Privacy mode" switch
 *   - editable "Sync server URL"
 *   - read-only "Local database" + "File storage" paths
 *   - one card per AI provider with an enabled/disabled Badge and a "Test" button
 *   - a "Save settings" button
 *
 * In browser preview the in-memory client backs settings + provider tests:
 *   - the mock provider ("Mock Local Generator") test returns ok → green "ok"
 *     badge + "Provider test passed." success alert
 *   - non-mock providers return ok:false in preview → red "issue" badge
 *
 * Bug-hunting is weighted toward objective signals: console.error / pageerror
 * (consoleErrors fixture) and visual breakage seen in screenshots.
 */

async function openSettings(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Settings" }).click();
  const drawer = page.getByRole("dialog", { name: "Settings" });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("Settings drawer opens with provider rows, badges, and path fields", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);

  // Core controls present.
  await expect(drawer.getByLabel("Privacy mode")).toBeVisible();
  await expect(drawer.getByLabel("Sync server URL")).toBeVisible();

  // Read-only path fields are shown and populated (browser preview placeholders).
  const dbPath = drawer.getByLabel("Local database");
  const filePath = drawer.getByLabel("File storage");
  await expect(dbPath).toBeVisible();
  await expect(filePath).toBeVisible();
  await expect(dbPath).toHaveValue(/.+/);
  await expect(filePath).toHaveValue(/.+/);
  // Both are read-only inputs.
  await expect(dbPath).toHaveAttribute("readonly", "");
  await expect(filePath).toHaveAttribute("readonly", "");

  // Provider rows: the default mock provider is enabled; OpenAI is disabled.
  await expect(drawer.getByText("Mock Local Generator")).toBeVisible();
  await expect(drawer.getByText("OpenAI", { exact: true })).toBeVisible();

  // At least one "enabled" and one "disabled" badge are rendered.
  await expect(drawer.getByText("enabled", { exact: true }).first()).toBeVisible();
  await expect(drawer.getByText("disabled", { exact: true }).first()).toBeVisible();

  // Every provider row has a Test button.
  const testButtons = drawer.getByRole("button", { name: "Test" });
  expect(await testButtons.count()).toBeGreaterThanOrEqual(5);

  await page.screenshot({ path: "test-results/settings/shots/drawer-open.png", fullPage: true });

  expect(consoleErrors, "Settings drawer logged console errors").toEqual([]);
});

test("mock provider Test passes; a non-mock provider reports an issue", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);

  // The mock provider card → Test → green "ok" badge + success message.
  const mockCard = drawer.locator(".mantine-Card-root", { hasText: "Mock Local Generator" });
  await mockCard.getByRole("button", { name: "Test" }).click();
  await expect(drawer.getByText("Provider test passed.")).toBeVisible();
  await expect(mockCard.getByText("ok", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/settings/shots/mock-test-passed.png", fullPage: true });

  // A non-mock provider (Ollama) → in preview it reports an issue (red badge).
  const ollamaCard = drawer.locator(".mantine-Card-root", { hasText: "Ollama" });
  await ollamaCard.getByRole("button", { name: "Test" }).click();
  await expect(ollamaCard.getByText("issue", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/settings/shots/ollama-test-issue.png", fullPage: true });

  // Testing a provider must not throw uncaught errors.
  expect(consoleErrors, "provider Test logged console errors").toEqual([]);
});

test("testing multiple providers keeps independent per-row results", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);

  const mockCard = drawer.locator(".mantine-Card-root", { hasText: "Mock Local Generator" });
  const lmStudioCard = drawer.locator(".mantine-Card-root", { hasText: "LM Studio" });

  await mockCard.getByRole("button", { name: "Test" }).click();
  await expect(mockCard.getByText("ok", { exact: true })).toBeVisible();

  await lmStudioCard.getByRole("button", { name: "Test" }).click();
  await expect(lmStudioCard.getByText("issue", { exact: true })).toBeVisible();

  // Earlier mock result is still present and unchanged.
  await expect(mockCard.getByText("ok", { exact: true })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("toggle Privacy mode, edit Sync server URL, and Save settings", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);

  const privacy = drawer.getByLabel("Privacy mode");
  const initiallyChecked = await privacy.isChecked();

  // Toggle privacy mode.
  await privacy.click();
  await expect(privacy).toBeChecked({ checked: !initiallyChecked });

  // Edit sync server URL.
  const syncUrl = drawer.getByLabel("Sync server URL");
  await syncUrl.fill("http://localhost:9999");
  await expect(syncUrl).toHaveValue("http://localhost:9999");

  // Save: success alert appears and the drawer closes.
  await drawer.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();

  expect(consoleErrors, "saving settings logged console errors").toEqual([]);
});

test("saved Sync URL and Privacy mode persist after reopening within the session", async ({ page, consoleErrors }) => {
  let drawer = await openSettings(page);

  const privacy = drawer.getByLabel("Privacy mode");
  const before = await privacy.isChecked();
  await privacy.click();
  const expectedPrivacy = !before;

  const syncUrl = drawer.getByLabel("Sync server URL");
  await syncUrl.fill("http://persist.example:8787");

  await drawer.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();

  // Reopen and confirm the saved values are reflected.
  await page.getByRole("button", { name: "Settings" }).click();
  drawer = page.getByRole("dialog", { name: "Settings" });
  await expect(drawer).toBeVisible();

  await expect(drawer.getByLabel("Sync server URL")).toHaveValue("http://persist.example:8787");
  await expect(drawer.getByLabel("Privacy mode")).toBeChecked({ checked: expectedPrivacy });

  await page.screenshot({ path: "test-results/settings/shots/reopened-persisted.png", fullPage: true });

  expect(consoleErrors).toEqual([]);
});

test("close via Close settings button, then reopen", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);

  await drawer.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();

  // Reopen works after an explicit close.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("rapid double-click on Test does not produce console errors", async ({ page, consoleErrors }) => {
  const drawer = await openSettings(page);
  const mockCard = drawer.locator(".mantine-Card-root", { hasText: "Mock Local Generator" });
  const testBtn = mockCard.getByRole("button", { name: "Test" });

  await testBtn.click();
  await testBtn.click({ force: true }).catch(() => {});

  await expect(drawer.getByText("Provider test passed.")).toBeVisible();
  expect(consoleErrors, "rapid Test clicks logged console errors").toEqual([]);
});

test("narrow viewport: drawer content stays usable", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const drawer = await openSettings(page);

  await expect(drawer.getByLabel("Privacy mode")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Save settings" })).toBeVisible();
  // The xl drawer (~780px) fits within a 900px viewport once the slide-in
  // transition settles; the rightmost Test button stays on-screen.
  await expect(drawer.getByRole("button", { name: "Test" }).first()).toBeInViewport();
  await page.screenshot({ path: "test-results/settings/shots/narrow-900x700.png", fullPage: true });

  expect(consoleErrors).toEqual([]);
});
