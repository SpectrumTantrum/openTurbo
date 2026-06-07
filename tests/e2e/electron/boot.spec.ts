import { realpathSync } from "node:fs";
import { test, expect, inMain } from "../fixtures/electron";

/**
 * Proof-of-harness for the Electron surface: the built app launches, the window
 * renders the dashboard, and the main process is reachable (real userData path,
 * derived from the isolated --user-data-dir we passed).
 */
test("electron window boots and renders the dashboard", async ({ page }) => {
  await expect(page).toHaveTitle(/OpenTurbo/);
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Review queue")).toBeVisible();
});

test("main process reports an isolated userData path", async ({ electronApp, userDataDir }) => {
  const userData = await inMain(electronApp, ({ app }) => app.getPath("userData"));
  // Compare via realpath: macOS tmpdir() (/var/folders/...) symlinks to
  // /private/var/folders/..., which Electron canonicalizes.
  expect(realpathSync(userData)).toBe(realpathSync(userDataDir));
});
