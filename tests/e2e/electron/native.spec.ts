import {
  test as rawTest,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, inMain } from "../fixtures/electron";

/**
 * Native (Electron-only) behaviours that do NOT exist in the browser preview:
 *  (a) export-to-disk  — exporters write real files under <userData>/OpenTurbo.local/exports
 *  (b) persistence     — an imported source survives an app restart (real SQLite-on-disk store)
 *  (c) provider health — the mock/local provider "Test" button returns a real, ok health result
 *
 * Run:
 *   npx playwright test --project=electron --workers=1 --reporter=list \
 *     --output=test-results/electron tests/e2e/electron/native.spec.ts
 */

const SHOTS = "test-results/electron/shots";

/** Drive the Import modal: open it, fill title + text, submit, wait for completion. */
async function importAndGenerate(page: Page, title: string, text: string): Promise<void> {
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Import source" })).toBeVisible();
  await page.getByRole("button", { name: "Import source" }).click();

  const dialog = page.getByRole("dialog", { name: "Import source" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Paste source text").fill(text);

  const submit = dialog.getByRole("button", { name: "Import and generate" });
  await expect(submit).toBeEnabled();
  await submit.click();

  // Import + generate both succeed -> the modal auto-closes (handleImport).
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

test("(a) export-to-disk: Markdown + Anki write real, non-empty files", async ({
  page,
  electronApp,
  consoleErrors,
}) => {
  const unique = `Export Probe ${Date.now()}`;
  await importAndGenerate(
    page,
    unique,
    "Mitochondria are the powerhouse of the cell. Photosynthesis converts light into chemical energy. The Krebs cycle produces ATP.",
  );

  // After import+generate, the EditorPane shows the selected source with export buttons.
  const editorExportArea = page.getByRole("button", { name: "Markdown" });
  await expect(editorExportArea).toBeVisible();

  // NOTE: the inMain callback runs in the Electron MAIN process, which has no
  // access to Node imports from THIS file's scope (e.g. `join`). Fetch the raw
  // userData path from main, then join in test (Node) scope.
  const userData = await inMain(electronApp, ({ app }) => app.getPath("userData"));
  const exportDir = join(userData, "OpenTurbo.local", "exports");

  // Click Markdown -> wait for the success feedback, then assert a .md file landed.
  await page.getByRole("button", { name: "Markdown" }).click();
  await expect(page.getByText("Exported markdown.")).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: `${SHOTS}/after-markdown-export.png` });

  // Adversarial probe: rapid double-click the Markdown export. The button has an
  // isLoading guard (disabled while exporting) and the exporter writes to a
  // deterministic per-pack path (overwrite, not append), so this should NOT
  // crash, error, or multiply files. Soft observation — kept non-fatal.
  const mdButton = page.getByRole("button", { name: "Markdown" });
  await mdButton.click();
  await mdButton.click({ force: true }).catch(() => {
    /* second click may be intercepted by the disabled/loading state — expected */
  });
  await expect(page.getByText("Exported markdown.")).toBeVisible({ timeout: 15_000 });
  const mdAfterDouble = readdirSync(exportDir).filter((f) => f.endsWith(".md"));
  // Deterministic filename means a single .md file regardless of click count.
  expect(mdAfterDouble.length, "double-click should not multiply markdown files").toBe(1);

  // Click Anki -> wait for its success feedback, then assert a -anki.csv file landed.
  await page.getByRole("button", { name: "Anki" }).click();
  await expect(page.getByText("Exported anki-csv.")).toBeVisible({ timeout: 15_000 });

  // The exporter derives the file name from the pack title (slugified). We do not
  // assume the exact slug; instead we assert that real, non-empty files exist.
  expect(existsSync(exportDir), `export dir should exist: ${exportDir}`).toBe(true);
  const files = readdirSync(exportDir);

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const ankiFiles = files.filter((f) => f.endsWith("-anki.csv"));

  expect(mdFiles.length, `expected a .md export in ${exportDir}, saw: ${files.join(", ")}`).toBeGreaterThan(0);
  expect(ankiFiles.length, `expected a -anki.csv export in ${exportDir}, saw: ${files.join(", ")}`).toBeGreaterThan(0);

  // Files are non-empty and contain the expected shape.
  const mdPath = join(exportDir, mdFiles[0]);
  const ankiPath = join(exportDir, ankiFiles[0]);
  expect(statSync(mdPath).size, "markdown export is empty").toBeGreaterThan(0);
  expect(statSync(ankiPath).size, "anki export is empty").toBeGreaterThan(0);

  const mdBody = readFileSync(mdPath, "utf8");
  const ankiBody = readFileSync(ankiPath, "utf8");
  expect(mdBody.startsWith("# "), "markdown export should start with an H1 title").toBe(true);
  expect(ankiBody.split("\n")[0]).toBe("Front,Back");

  expect(consoleErrors, "export journey logged console errors").toEqual([]);
});

test("(c) provider health: the mock/local provider Test button returns a real ok result", async ({
  page,
  electronApp,
  consoleErrors,
}) => {
  // Clicking the "Settings" nav both selects the Settings view AND opens the
  // Settings drawer (Sidebar onClick -> setActive + onSettings). The drawer
  // overlays the page, so drive the provider test through the drawer dialog —
  // it shares the same IPC-backed test handler and result state.
  await page.getByRole("button", { name: "Settings" }).click();
  const drawer = page.getByRole("dialog", { name: "Settings" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("AI providers")).toBeVisible();

  // Scope to the Mock Local Generator card so we click the right "Test" button.
  // (Use .filter({ hasText }) rather than { has: relativeLocator } — the latter
  // re-roots the inner locator and matches zero cards.)
  await expect(drawer.getByText("Mock Local Generator", { exact: true })).toBeVisible();
  const card = drawer.locator(".mantine-Card-root").filter({ hasText: "Mock Local Generator" }).first();
  await card.getByRole("button", { name: "Test" }).click();

  // A real health result renders inside the same card: an "ok" badge + the
  // MockProvider message. This is end-to-end through the real IPC channel.
  await expect(card.getByText("ok", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Offline template generator is ready.")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/provider-test-result.png` });

  // Adversarial probe: shrink the real BrowserWindow to ~900x700 with the
  // xl right-drawer open and confirm the provider "Test" control is not clipped
  // off-screen (the button sits near the right edge even at 1440 width). We
  // re-open the drawer at the small size and re-click Test. Soft: a non-fatal
  // observation that the narrow layout stays operable.
  await inMain(electronApp, ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setBounds({ x: 0, y: 0, width: 900, height: 700 });
  });
  // Toggle the drawer closed/open to force a re-layout at the small width.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(drawer).toBeVisible();
  const smallCard = drawer.locator(".mantine-Card-root").filter({ hasText: "Mock Local Generator" }).first();
  const smallTest = smallCard.getByRole("button", { name: "Test" });
  await expect(smallTest).toBeVisible();
  // If the control were clipped off-screen, this click would hang/fail.
  await smallTest.click({ timeout: 8_000 });
  await expect(smallCard.getByText("ok", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/provider-test-result-900x700.png` });

  expect(consoleErrors, "provider test journey logged console errors").toEqual([]);
});

/**
 * (b) PERSISTENCE-ACROSS-RESTART.
 *
 * This case manages its OWN fixed temp dir and launches `_electron` directly,
 * twice, with the SAME --user-data-dir. It must NOT use the auto-fresh
 * userDataDir/electronApp fixtures (which would wipe state between launches).
 *
 * It uses the RAW @playwright/test runner (rawTest), not the electron fixture
 * `test`: the fixture's `consoleErrors` is an auto fixture that depends on
 * `page → electronApp → userDataDir`, so the fixture `test` would launch a
 * THIRD (idle) Electron app + temp dir for this case even though the body never
 * touches them — wasteful and a flakiness vector. rawTest avoids that entirely.
 */
rawTest("(b) persistence-across-restart: an imported source survives a restart", async () => {
  const fixedDir = mkdtempSync(join(tmpdir(), "ot-persist-"));
  const uniqueTitle = `Persistent Source ${Date.now()}`;
  const launchArgs = [".", `--user-data-dir=${fixedDir}`];

  let app: ElectronApplication | undefined;
  try {
    // ---- First launch: import a uniquely-titled source. ----
    app = await electron.launch({ args: launchArgs });
    let window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await expect(window).toHaveTitle(/OpenTurbo/);

    await importAndGenerate(
      window,
      uniqueTitle,
      "A unique persistence probe. Cellular respiration. Newtonian mechanics. Supply and demand.",
    );

    // The imported source is now visible in the Library list.
    await expect(window.getByText(uniqueTitle).first()).toBeVisible({ timeout: 15_000 });
    await window.screenshot({ path: `${SHOTS}/persist-before-restart.png` });

    await app.close();
    app = undefined;

    // ---- Second launch: SAME user-data-dir -> the source should still be there. ----
    app = await electron.launch({ args: launchArgs });
    window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await expect(window).toHaveTitle(/OpenTurbo/);

    await window.getByRole("button", { name: "Library" }).click();
    await expect(window.getByText(uniqueTitle).first()).toBeVisible({ timeout: 15_000 });
    await window.screenshot({ path: `${SHOTS}/persist-after-restart.png` });
  } finally {
    if (app) await app.close();
    try {
      rmSync(fixedDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});
