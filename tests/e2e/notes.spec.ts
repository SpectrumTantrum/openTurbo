import { test, expect } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * Notes view (Library workspace → "Notes" study tab).
 *
 * Drives the real Notes tab inside the Library three-pane workspace. The seed
 * source ("Cellular Biology Fundamentals") has a generated study pack, and the
 * workspace opens on the Notes tab by default. The view renders three sections
 * (Core Summary / Key Concepts / Study Plan), each with an <h2> heading, body
 * paragraphs, and a red citation Badge, plus a footer with a live word count and
 * an "Auto-saved locally" message.
 *
 * Objective signals first: no console.error / pageerror over each journey
 * (React duplicate-key warnings, error-boundary trips, and uncaught exceptions
 * all surface here), plus screenshots Read for visual breakage (overlap/clipping
 * at desktop and small viewports).
 *
 * Known stub (NOT a bug): the formatting toolbar (Heading/Body select, B, I,
 * Code) is intentionally disabled. We assert it's disabled rather than file it.
 */

const SECTION_HEADINGS = ["1. Core Summary", "2. Key Concepts", "3. Study Plan"] as const;

async function openNotes(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  // The Library workspace selects the seed source + pack; the study editor opens
  // on the Notes tab by default. (There are TWO controls named "Notes": the study
  // tab and an "AI Actions" sidebar button — always scope to role="tab" here.)
  await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "1. Core Summary" })).toBeVisible();
}

test("Notes tab renders three sections with headings, bodies, and citation badges", async ({ page, consoleErrors }) => {
  await openNotes(page);

  // Each section heading is an <h2> whose visible text includes its 1-based index.
  for (const heading of SECTION_HEADINGS) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // Bodies: at least one paragraph of real prose under the summary. The Core
  // Summary body is the source's first sentences joined into one paragraph.
  await expect(page.getByText(/Cellular biology is the study of cells/)).toBeVisible();
  // Key Concepts renders one "- <Term>: important term from the source." line per
  // keyword; assert at least one rendered.
  await expect(page.getByText(/important term from the source\./).first()).toBeVisible();
  // Study Plan is a 4-step numbered list.
  await expect(page.getByText("1. Read the summary.")).toBeVisible();
  await expect(page.getByText("4. Ask the assistant to explain weak areas.")).toBeVisible();

  // Citation badges: each seed section carries exactly one red citation badge
  // labelled "<Source title>, excerpt N". All three excerpts should be present.
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByText(`Cellular Biology Fundamentals, excerpt ${i}`)).toBeVisible();
  }

  await page.screenshot({ path: "test-results/notes/shots/notes-1440.png", fullPage: true });

  expect(consoleErrors, "Notes view logged console errors").toEqual([]);
});

test("Footer shows a positive word count and the auto-save messages", async ({ page, consoleErrors }) => {
  await openNotes(page);

  // Footer lives in <footer class="editor-status">; assert against its text so we
  // don't depend on a brittle exact count (it is deterministic but seed-coupled).
  const footer = page.locator("footer.editor-status");
  await expect(footer).toBeVisible();

  const footerText = (await footer.innerText()).trim();
  expect(footerText, "footer missing a numeric word count").toMatch(/Words:\s*\d+/);

  const wordMatch = footerText.match(/Words:\s*(\d+)/);
  const wordCount = wordMatch ? Number(wordMatch[1]) : 0;
  expect(wordCount, "word count should be > 0 for a populated pack").toBeGreaterThan(0);

  await expect(footer.getByText("Auto-saved locally")).toBeVisible();
  await expect(footer.getByText("All changes saved")).toBeVisible();

  expect(consoleErrors, "footer journey logged console errors").toEqual([]);
});

test("Formatting toolbar is present but disabled (known stub)", async ({ page, consoleErrors }) => {
  await openNotes(page);

  // The toolbar controls are intentionally disabled (formatting not saved yet).
  // We don't file this; we just lock in the disabled state so a regression that
  // accidentally enables a no-op control would be noticed.
  await expect(page.getByRole("button", { name: "B", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "I", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Code", exact: true })).toBeDisabled();

  // The Regenerate button (in the same toolbar) IS enabled with the mock provider.
  await expect(page.getByRole("button", { name: "Regenerate" })).toBeEnabled();

  expect(consoleErrors, "toolbar journey logged console errors").toEqual([]);
});

test("Regenerate re-renders the Notes sections without errors", async ({ page, consoleErrors }) => {
  await openNotes(page);

  await expect(page.getByRole("heading", { name: "1. Core Summary" })).toBeVisible();

  // Regenerate re-runs generation (MockProvider) and rebuilds the study pack, so
  // NotesView re-renders with a fresh set of sections. Output *quality* is out of
  // scope; we care that it re-renders cleanly (no error-boundary / duplicate keys).
  await page.getByRole("button", { name: "Regenerate" }).click();

  // After regeneration the three sections must still render.
  for (const heading of SECTION_HEADINGS) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 10000 });
  }
  // Footer word count is still present and positive.
  await expect(page.locator("footer.editor-status")).toContainText(/Words:\s*\d+/);

  expect(consoleErrors, "regenerate logged console errors").toEqual([]);
});

test("Rapid double-click on Regenerate does not error", async ({ page, consoleErrors }) => {
  await openNotes(page);

  const regenerate = page.getByRole("button", { name: "Regenerate" });
  // Fire two clicks back-to-back. The button disables itself while generating, so
  // the second click should be a safe no-op — assert no errors / no broken state.
  await regenerate.click();
  await regenerate.click({ trial: false }).catch(() => {
    /* button may already be disabled mid-generation; that's expected */
  });

  await expect(page.getByRole("heading", { name: "1. Core Summary" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");

  expect(consoleErrors, "rapid regenerate logged console errors").toEqual([]);
});

test("Long content scrolls within the document area at a small viewport", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openNotes(page);

  // The Notes sections live inside a Mantine ScrollArea (".document-scroll").
  // At 900x700 the three sections + the verbose Key Concepts list should overflow
  // the viewport and the scroll viewport should be scrollable.
  const scrollViewport = page.locator(".document-scroll .mantine-ScrollArea-viewport");
  await expect(scrollViewport.first()).toBeVisible();

  const metrics = await scrollViewport.first().evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight
  }));
  expect(
    metrics.scrollHeight,
    "document scroll area has no overflow to scroll at 900x700"
  ).toBeGreaterThan(metrics.clientHeight);

  // Scroll to the bottom and verify the last section's heading becomes visible.
  await scrollViewport.first().evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByRole("heading", { name: "3. Study Plan" })).toBeVisible();

  await page.screenshot({ path: "test-results/notes/shots/notes-900.png", fullPage: true });

  expect(consoleErrors, "small-viewport scroll logged console errors").toEqual([]);
});

test("Notes view is visually intact at desktop width", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNotes(page);

  await expect(page.getByRole("heading", { name: "1. Core Summary" })).toBeVisible();
  // Capture a viewport screenshot for human/agent eyeball review of overlap/clip.
  await page.screenshot({ path: "test-results/notes/shots/notes-desktop-viewport.png" });

  expect(consoleErrors, "desktop-width journey logged console errors").toEqual([]);
});
