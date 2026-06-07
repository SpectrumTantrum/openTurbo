import { test, expect } from "./fixtures/app";

/**
 * Podcast script tab.
 *
 * Journey: Dashboard -> Library (auto-selects the seeded "Cellular Biology
 * Fundamentals" source/pack) -> Podcast tab. The tab renders a static recap:
 * a header, the script text, a hardcoded progress bar (~38%), and two
 * intentionally-disabled stub buttons (TTS preview/export).
 *
 * Bug-hunting is weighted toward objective signals: no console.error /
 * pageerror across the journey, the script text actually renders, and the
 * layout is screenshotted at two viewports for manual visual inspection.
 *
 * Known stubs (NOT bugs): the audio Preview/Export buttons are disabled on
 * purpose, and the progress bar value is hardcoded.
 */

// Reach the Podcast tab from a fresh load. Library auto-selects source[0]/pack[0].
async function openPodcast(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();
  await page.getByRole("tab", { name: "Podcast" }).click();
}

test("podcast tab renders header, script, and stub controls", async ({ page, consoleErrors }) => {
  await openPodcast(page);

  // Header + subtitle. The header is `${pack.title} Audio Recap` and pack.title
  // is `${source.title} Study Pack`, so it reads ".. Study Pack Audio Recap".
  // Assert on the stable "Audio Recap" suffix rather than the exact string.
  await expect(page.getByText(/Audio Recap$/)).toBeVisible();
  await expect(
    page.getByText("Podcast script is ready for local or BYOK TTS generation.")
  ).toBeVisible();

  // Script body actually renders (stable prefix; the middle interpolates
  // source keywords and is not assertable verbatim).
  await expect(
    page.getByText(/^Welcome to your OpenTurbo audio recap for Cellular Biology Fundamentals/)
  ).toBeVisible();

  // Both TTS controls are intentionally-disabled stubs.
  const preview = page.getByRole("button", { name: "Preview script unavailable" });
  const exportBtn = page.getByRole("button", { name: "Export audio unavailable" });
  await expect(preview).toBeVisible();
  await expect(preview).toBeDisabled();
  await expect(exportBtn).toBeVisible();
  await expect(exportBtn).toBeDisabled();

  // Objective signal: no unexpected console errors across the journey.
  expect(consoleErrors, "podcast tab logged unexpected console errors").toEqual([]);
});

test("podcast progress bar is present (hardcoded value, known stub)", async ({ page }) => {
  await openPodcast(page);

  // Mantine renders the value-bearing section as role="progressbar". The value
  // is hardcoded to 38% by design — we only assert it exists and exposes a
  // value, not that the value is meaningful.
  const progressbar = page.locator(".podcast-view [role='progressbar']");
  await expect(progressbar).toBeVisible();
  await expect(progressbar).toHaveAttribute("aria-valuenow", "38");
});

test("podcast layout is stable across viewports (screenshots)", async ({ page, consoleErrors }) => {
  // Wide desktop.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPodcast(page);
  const podcastView = page.locator(".podcast-view");
  await expect(podcastView).toBeVisible();
  await podcastView.screenshot({ path: "test-results/podcast/shots/podcast-1440x900.png" });

  // Narrow window — .podcast-view is a max-width:760px grid; check the long
  // header/script and the stub buttons + progress bar don't break.
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(podcastView).toBeVisible();
  await podcastView.screenshot({ path: "test-results/podcast/shots/podcast-900x700.png" });

  // The view overflows the editor pane's ScrollArea at this short viewport
  // (footer/Job-Queue dock sit below it). Confirm the bottom-most control is
  // genuinely reachable via scroll, not clipped/dead — toBeVisible() alone does
  // NOT prove this (Playwright counts scrolled-out elements as visible).
  const preview = page.getByRole("button", { name: "Preview script unavailable" });
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toBeInViewport();

  // Full-page shot at the narrow size for surrounding-chrome inspection.
  await page.screenshot({ path: "test-results/podcast/shots/podcast-page-900x700.png", fullPage: true });

  expect(consoleErrors, "podcast layout logged unexpected console errors").toEqual([]);
});

test("rapid tab switching into/out of Podcast stays clean", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();

  // Hammer the tab strip; ensure Podcast keeps rendering its script and nothing
  // throws (no dangling promises / error-boundary trips on fast re-renders).
  for (let i = 0; i < 4; i++) {
    await page.getByRole("tab", { name: "Notes" }).click();
    await page.getByRole("tab", { name: "Podcast" }).click();
  }
  await expect(
    page.getByText(/^Welcome to your OpenTurbo audio recap for Cellular Biology Fundamentals/)
  ).toBeVisible();

  expect(consoleErrors, "rapid podcast tab switching logged console errors").toEqual([]);
});
