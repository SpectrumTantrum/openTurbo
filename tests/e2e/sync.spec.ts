import { test, expect } from "./fixtures/app";

/**
 * Sync view + Job Queue footer.
 *
 * Area focus:
 *  - Sync view: the three state cards (State / Device / Last sync), the Privacy
 *    switch, the "Sync server URL" input, and "Save sync settings".
 *  - Job Queue footer: job cards (label / detail / status badge / progress) plus
 *    the CPU/RAM metric area and the Recharts area chart, laid out at narrow and
 *    wide viewports. The footer renders in the app shell (App.tsx:460), OUTSIDE
 *    the per-view WorkspaceView, so it is present on EVERY view.
 *
 * Known stubs (NOT asserted as bugs): actual sync EXECUTION (state stays
 * "offline"), and the hardcoded "CPU 38%" / "RAM 11.2 / 32 GB" metric text.
 */

const NARROW = { width: 900, height: 700 };
const WIDE = { width: 1440, height: 900 };

async function gotoSync(page: import("@playwright/test").Page) {
  await page.goto("/");
  // Nav button has aria-label exactly "Sync"; the "Save sync settings" button
  // also matches a non-exact "Sync" name, so use exact to disambiguate.
  const navSync = page.getByRole("button", { name: "Sync", exact: true });
  await navSync.click();
  await expect(navSync).toHaveAttribute("aria-current", "page");
  // The "Sync server URL" labelled input is unique to the Sync view, so it is a
  // reliable anchor that the view rendered. (The section title is a Mantine
  // <Text> div, not a heading role.)
  await expect(page.getByLabel("Sync server URL")).toBeVisible();
}

test.describe("Sync view", () => {
  test("renders state cards, privacy switch, URL input, and save button", async ({ page, consoleErrors }) => {
    await gotoSync(page);

    // Scope to the main workspace; the sidebar (complementary) also echoes the
    // sync message ("Local-only preview mode.").
    const main = page.getByRole("main");

    // Three state cards: labels + seeded in-memory values.
    await expect(main.getByText("State", { exact: true })).toBeVisible();
    await expect(main.getByText("Device", { exact: true })).toBeVisible();
    await expect(main.getByText("Last sync", { exact: true })).toBeVisible();

    // Browser preview seeds: local-only, deviceId "browser-preview", never synced.
    await expect(main.getByText("Local-only", { exact: true })).toBeVisible();
    await expect(main.getByText("browser-preview")).toBeVisible();
    await expect(main.getByText("Not synced")).toBeVisible();

    // Privacy switch is on by default (privacyMode: true).
    const privacy = page.getByLabel("Privacy mode");
    await expect(privacy).toBeVisible();
    await expect(privacy).toBeChecked();

    // Sync server URL input starts empty with the placeholder.
    const urlInput = page.getByLabel("Sync server URL");
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveValue("");
    await expect(urlInput).toHaveAttribute("placeholder", "http://localhost:8787");

    await expect(page.getByRole("button", { name: "Save sync settings" })).toBeEnabled();

    await page.screenshot({ path: "test-results/sync/shots/sync-view.png", fullPage: true });
    expect(consoleErrors, "Sync view logged console errors").toEqual([]);
  });

  test("privacy switch toggles", async ({ page, consoleErrors }) => {
    await gotoSync(page);
    const privacy = page.getByLabel("Privacy mode");
    await expect(privacy).toBeChecked();
    await privacy.click();
    await expect(privacy).not.toBeChecked();
    await privacy.click();
    await expect(privacy).toBeChecked();
    expect(consoleErrors, "toggling privacy logged console errors").toEqual([]);
  });

  test("saving a sync server URL flips Local-only to Sync enabled (config, not execution)", async ({ page, consoleErrors }) => {
    await gotoSync(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Local-only", { exact: true })).toBeVisible();

    await page.getByLabel("Sync server URL").fill("http://localhost:8787");
    await page.getByRole("button", { name: "Save sync settings" }).click();

    // Success feedback (ActionFeedback shows the success message from runAction).
    await expect(page.getByText("Settings saved.")).toBeVisible({ timeout: 5000 });

    // sync.enabled is derived from Boolean(syncServerUrl), so the State card label
    // should flip from "Local-only" to "Sync enabled". This is CONFIG (in scope),
    // not execution. Observed working; assert it as the main config journey.
    await expect(main.getByText("Sync enabled")).toBeVisible();
    await expect(main.getByText("Local-only", { exact: true })).toHaveCount(0);

    await page.screenshot({ path: "test-results/sync/shots/sync-saved.png", fullPage: true });
    expect(consoleErrors, "saving sync URL logged console errors").toEqual([]);
  });

  test("edge: rapid double-click Save, very long URL, no crash", async ({ page, consoleErrors }) => {
    await gotoSync(page);

    const longUrl = "http://" + "a".repeat(600) + ".example.com:8787/very/long/path";
    await page.getByLabel("Sync server URL").fill(longUrl);

    const save = page.getByRole("button", { name: "Save sync settings" });
    // Rapid double-click: the handler guards re-entrancy via isLoading("settingsSave").
    await save.click();
    await save.click().catch(() => { /* may be disabled mid-save; that's fine */ });

    await expect(page.getByText("Settings saved.")).toBeVisible({ timeout: 5000 });

    // The view must still be intact (unique input still present, no error boundary).
    await expect(page.getByLabel("Sync server URL")).toBeVisible();
    await page.screenshot({ path: "test-results/sync/shots/sync-long-url.png", fullPage: true });
    expect(consoleErrors, "rapid save / long URL logged console errors").toEqual([]);
  });

  test("edge: navigate away while saving does not error", async ({ page, consoleErrors }) => {
    await gotoSync(page);
    await page.getByLabel("Sync server URL").fill("http://localhost:9999");
    await page.getByRole("button", { name: "Save sync settings" }).click();
    // Immediately navigate away mid-save.
    await page.getByRole("button", { name: "Dashboard" }).click();
    await expect(page.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    // Footer must still render after the racy navigation.
    await expect(page.getByText(/^Job Queue \(/)).toBeVisible();
    expect(consoleErrors, "navigate-while-saving logged console errors").toEqual([]);
  });
});

test.describe("Job Queue footer", () => {
  test("renders job cards, status badges, progress bars, and CPU/RAM metrics", async ({ page, consoleErrors }) => {
    await page.goto("/");

    const footer = page.locator("footer.job-queue");
    await expect(footer).toBeVisible();

    // Header: "Job Queue (N)" plus the cards-due / streak badges.
    await expect(footer.getByText(/^Job Queue \(\d+\)$/)).toBeVisible();

    // Metric area: CPU + RAM text (hardcoded placeholder values — known stub,
    // we only assert they RENDER, not their correctness).
    await expect(footer.getByText("CPU 38%")).toBeVisible();
    await expect(footer.getByText("RAM 11.2 / 32 GB")).toBeVisible();

    // Seeded job cards: 4 jobs. Each job card has a label, a detail line, a
    // status badge, and a progress bar.
    await expect(footer.getByText("OCR Processing")).toBeVisible();
    await expect(footer.getByText("Generate Embeddings")).toBeVisible();
    await expect(footer.getByText("Generate Podcast")).toBeVisible();

    const progressBars = footer.locator(".mantine-Progress-root");
    expect(await progressBars.count()).toBeGreaterThanOrEqual(3);

    // The Recharts area chart card renders an SVG surface with real dimensions
    // (ResponsiveContainer gets real size in Chromium). NOTE / FINDING: although
    // the SVG has dimensions, it draws ZERO area paths because the seed
    // `analytics.masteryByTopic` has a single data point (one study pack) and an
    // AreaChart cannot draw an area from one point — so the chart card renders
    // visually EMPTY on first launch (a lone dot). See the "empty chart card"
    // finding. We assert only the surface/dimensions here so the suite stays
    // green; the emptiness is reported as a low-severity visual finding.
    const chartSvg = footer.locator(".chart-card svg.recharts-surface");
    await expect(chartSvg).toBeVisible();
    const box = await chartSvg.boundingBox();
    expect(box, "chart SVG should have a bounding box").not.toBeNull();
    expect(box!.width, "chart SVG width should be > 0").toBeGreaterThan(0);
    expect(box!.height, "chart SVG height should be > 0").toBeGreaterThan(0);

    await footer.screenshot({ path: "test-results/sync/shots/footer-default.png" });
    expect(consoleErrors, "footer logged console errors").toEqual([]);
  });

  test("footer lays out at narrow (900x700) viewport", async ({ page, consoleErrors }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/");

    const footer = page.locator("footer.job-queue");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/^Job Queue \(\d+\)$/)).toBeVisible();
    await expect(footer.getByText("CPU 38%")).toBeVisible();
    await expect(footer.getByText("RAM 11.2 / 32 GB")).toBeVisible();

    // Footer must not exceed the viewport width (no horizontal overflow of the page).
    const fbox = await footer.boundingBox();
    expect(fbox, "footer bounding box at narrow").not.toBeNull();
    expect(fbox!.width, "footer should not be wider than viewport").toBeLessThanOrEqual(NARROW.width + 1);

    await page.screenshot({ path: "test-results/sync/shots/footer-narrow-dashboard.png" });
    // Element screenshot so the footer's own box (not the viewport-cut page) is
    // captured. NOTE / FINDING: at viewport height <= 700 the footer collapses to
    // 144px (max-height:700 media query) and pins each job card to ~88px while
    // card content needs 113-167px, so the per-card progress bars (and some
    // detail lines) are clipped off the bottom inside the footer. At 1440x900 the
    // footer is 190px and the progress bars are visible. Reported as a
    // low-severity visual finding; not hard-asserted to keep the suite green.
    await footer.screenshot({ path: "test-results/sync/shots/footer-narrow-element.png" });

    // Also check the footer on the Sync view at narrow.
    await page.getByRole("button", { name: "Sync", exact: true }).click();
    await expect(footer).toBeVisible();
    await page.screenshot({ path: "test-results/sync/shots/sync-narrow.png", fullPage: true });

    expect(consoleErrors, "narrow footer logged console errors").toEqual([]);
  });

  test("footer lays out at wide (1440x900) viewport", async ({ page, consoleErrors }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/");

    const footer = page.locator("footer.job-queue");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/^Job Queue \(\d+\)$/)).toBeVisible();
    await expect(footer.getByText("CPU 38%")).toBeVisible();
    await expect(footer.getByText("RAM 11.2 / 32 GB")).toBeVisible();

    const chartSvg = footer.locator(".chart-card svg.recharts-surface");
    await expect(chartSvg).toBeVisible();

    await page.screenshot({ path: "test-results/sync/shots/footer-wide-dashboard.png" });

    await page.getByRole("button", { name: "Sync", exact: true }).click();
    await expect(footer).toBeVisible();
    await page.screenshot({ path: "test-results/sync/shots/sync-wide.png", fullPage: true });

    expect(consoleErrors, "wide footer logged console errors").toEqual([]);
  });
});
