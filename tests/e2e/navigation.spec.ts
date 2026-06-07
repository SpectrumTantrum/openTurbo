import { test, expect } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * App shell & navigation regression suite.
 *
 * Drives the 7-button icon-only sidebar (Dashboard, Library, Spaces, Review,
 * Analytics, Sync, Settings). The active nav button carries
 * `aria-current="page"`. Each view has a hallmark heading we assert on.
 *
 * Bug-hunting weight is on objective signals: console.error / pageerror
 * (the `consoleErrors` auto fixture) and cross-path badge consistency, rather
 * than hardcoded magic numbers (which just re-cover the unit tests).
 */

const NAV_LABELS = ["Dashboard", "Library", "Spaces", "Review", "Analytics", "Sync", "Settings"] as const;
type NavLabel = (typeof NAV_LABELS)[number];

function nav(page: Page, label: NavLabel) {
  return page.getByRole("button", { name: label, exact: true });
}

async function gotoApp(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/OpenTurbo/);
  // Wait for the snapshot to load (the loading shim shows "Loading OpenTurbo...").
  await expect(nav(page, "Dashboard")).toHaveAttribute("aria-current", "page");
}

test.describe("App shell & navigation", () => {
  test("every nav button renders its hallmark view and marks itself current", async ({ page, consoleErrors }) => {
    await gotoApp(page);

    // Dashboard (default) — generative study dashboard.
    await expect(page.getByText("Review queue")).toBeVisible();

    // Library — three-pane workspace.
    await nav(page, "Library").click();
    await expect(nav(page, "Library")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(page.getByText("AI Assistant")).toBeVisible();

    // Spaces — workspace picker.
    await nav(page, "Spaces").click();
    await expect(nav(page, "Spaces")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Choose a workspace to focus the Library list.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open in Library" })).toBeVisible();

    // Review — due-card queue.
    await nav(page, "Review").click();
    await expect(nav(page, "Review")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/due cards across your study packs/)).toBeVisible();

    // Analytics — workload + mastery chart.
    await nav(page, "Analytics").click();
    await expect(nav(page, "Analytics")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Study workload, momentum, mastery, and weak areas.")).toBeVisible();
    await expect(page.getByText("Mastery by topic")).toBeVisible();

    // Sync — pure-nav state (no sync server configured) → "Local-only".
    await nav(page, "Sync").click();
    await expect(nav(page, "Sync")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Local-only", { exact: true })).toBeVisible();

    // Settings — clicking it also opens the Settings drawer (by design).
    await nav(page, "Settings").click();
    await expect(nav(page, "Settings")).toHaveAttribute("aria-current", "page");
    const settingsDrawer = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDrawer).toBeVisible();
    // Close the drawer to reveal the underlying Settings overview.
    await settingsDrawer.getByRole("button", { name: "Close settings" }).click();
    await expect(settingsDrawer).toBeHidden();
    await expect(page.getByText("Provider, privacy, storage, and sync overview.")).toBeVisible();

    // Objective signal: clean console across the full nav journey.
    expect(consoleErrors, "nav journey logged console errors").toEqual([]);
  });

  test("count badges are consistent with the underlying data", async ({ page, consoleErrors }) => {
    await gotoApp(page);

    // Review badge === subtitle count === number of rendered due-card items.
    // Three independent code paths (buildNavMetrics, collectDueCards, render)
    // resolving to the same truth — a real regression asset, no magic number.
    const reviewBadge = nav(page, "Review").getByText(/^\d+$/);
    const reviewBadgeText = (await reviewBadge.textContent())?.trim() ?? "";
    const reviewBadgeCount = Number(reviewBadgeText);
    expect(reviewBadgeCount).toBeGreaterThan(0);

    await nav(page, "Review").click();
    const subtitle = await page.getByText(/due cards across your study packs/).textContent();
    const subtitleCount = Number(subtitle?.match(/(\d+)\s+due cards/)?.[1] ?? "NaN");
    expect(subtitleCount, "Review subtitle count").toBe(reviewBadgeCount);

    // Count rendered due-card "front" buttons by counting the per-card rating
    // groups (each due card renders an "again" rating button).
    const renderedDueCards = await page.getByRole("button", { name: "again" }).count();
    expect(renderedDueCards, "rendered due cards vs badge").toBe(reviewBadgeCount);

    // Analytics nav badge is ABSENT in seed data (all cards lapses:0 → weakAreas []).
    // Assert no numeric badge on the nav button, and the in-view count reads 0.
    await expect(nav(page, "Analytics").getByText(/^\d+$/), "Analytics nav badge should be absent for zero weak areas").toHaveCount(0);
    await nav(page, "Analytics").click();
    await expect(page.getByText("No weak areas detected yet.")).toBeVisible();

    // Settings nav badge (ready providers) === "N providers ready" in the overview.
    const settingsBadgeText = (await nav(page, "Settings").getByText(/^\d+$/).textContent())?.trim() ?? "";
    const settingsBadgeCount = Number(settingsBadgeText);
    expect(settingsBadgeCount).toBeGreaterThan(0);
    await nav(page, "Settings").click();
    const drawer = page.getByRole("dialog", { name: "Settings" });
    await drawer.getByRole("button", { name: "Close settings" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByText(`${settingsBadgeCount} providers ready`)).toBeVisible();

    // Library badge === sources + packs. Library three-pane shows "Sources (N)".
    const libraryBadgeText = (await nav(page, "Library").getByText(/^\d+$/).textContent())?.trim() ?? "";
    expect(Number(libraryBadgeText)).toBeGreaterThan(0);

    expect(consoleErrors, "badge-consistency journey logged console errors").toEqual([]);
  });

  test("rapid switching between all 7 nav items stays clean", async ({ page, consoleErrors }) => {
    await gotoApp(page);

    // Two fast passes through all 7 nav buttons. Clicking Settings opens a
    // drawer whose overlay would block the next nav click, so we dismiss it
    // with Escape immediately after to keep the storm flowing through all 7.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const label of NAV_LABELS) {
        await nav(page, label).click();
        if (label === "Settings") {
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
        }
      }
    }

    // After the storm the app must still be interactive: go to Dashboard.
    await nav(page, "Dashboard").click();
    await expect(nav(page, "Dashboard")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Review queue")).toBeVisible();

    expect(consoleErrors, "rapid nav switching logged console errors").toEqual([]);
  });

  test("Settings drawer overlay blocks nav clicks; Escape dismisses and nav resumes", async ({ page, consoleErrors }) => {
    await gotoApp(page);

    // Open the Settings drawer (the Settings nav button opens it).
    await nav(page, "Settings").click();
    const drawer = page.getByRole("dialog", { name: "Settings" });
    await expect(drawer).toBeVisible();

    // Observation: the Mantine drawer overlay sits over the sidebar, so a nav
    // click while it is open is intercepted by the overlay — it neither
    // navigates nor closes the drawer. This is expected modal behavior, not a
    // dead-end. We verify the drawer is still up and Library did NOT activate.
    await nav(page, "Library").click({ timeout: 2000 }).catch(() => {
      /* expected: overlay intercepts the click */
    });
    await expect(drawer, "drawer stays open under its overlay").toBeVisible();
    await expect(nav(page, "Library"), "Library should not have activated through the overlay").not.toHaveAttribute(
      "aria-current",
      "page"
    );

    // Escape dismisses the drawer and the app stays interactive.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await nav(page, "Library").click();
    await expect(nav(page, "Library")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Sources (1)")).toBeVisible();

    expect(consoleErrors, "nav-while-drawer-open logged console errors").toEqual([]);
  });

  test("Import modal overlay blocks nav clicks; Escape dismisses and nav resumes", async ({ page, consoleErrors }) => {
    await gotoApp(page);
    await nav(page, "Library").click();
    await expect(page.getByText("Sources (1)")).toBeVisible();

    // Open the Import modal.
    await page.getByRole("button", { name: "Import source" }).click();
    const importDialog = page.getByRole("dialog", { name: "Import source" });
    await expect(importDialog).toBeVisible();

    // Same expected modal behavior: nav click is intercepted by the overlay.
    await nav(page, "Analytics").click({ timeout: 2000 }).catch(() => {
      /* expected: overlay intercepts the click */
    });
    await expect(importDialog, "import modal stays open under its overlay").toBeVisible();

    // Escape dismisses, then navigation works normally.
    await page.keyboard.press("Escape");
    await expect(importDialog).toBeHidden();
    await nav(page, "Analytics").click();
    await expect(nav(page, "Analytics")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Mastery by topic")).toBeVisible();

    expect(consoleErrors, "nav-while-import-modal logged console errors").toEqual([]);
  });

  test("sidebar (always-expanded) holds up across viewports and keeps accessible names", async ({ page, consoleErrors }) => {
    // NOTE: despite the "icon-only" descriptor in older docs/comments, the
    // current .sidebar CSS has NO breakpoint that collapses it to icons — it is
    // always expanded with full text labels at every width (see App.css). This
    // probe therefore verifies the expanded sidebar survives small viewports
    // without overlap/clipping and that every nav button keeps its accessible
    // name (aria-label) so it stays clickable.
    await page.setViewportSize({ width: 900, height: 700 });
    await gotoApp(page);

    for (const label of NAV_LABELS) {
      await expect(nav(page, label), `nav button "${label}" missing at 900x700`).toBeVisible();
    }
    await nav(page, "Analytics").click();
    await expect(page.getByText("Mastery by topic")).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/sidebar-900x700.png", fullPage: false });

    // Back up to a wide viewport.
    await page.setViewportSize({ width: 1440, height: 900 });
    await nav(page, "Dashboard").click();
    await expect(page.getByText("Review queue")).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/dashboard-1440x900.png", fullPage: false });

    expect(consoleErrors, "responsive sidebar logged console errors").toEqual([]);
  });

  test("captures screenshots of each view for visual inspection", async ({ page }) => {
    await gotoApp(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.screenshot({ path: "test-results/navigation/shots/view-dashboard.png" });

    await nav(page, "Library").click();
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/view-library.png" });

    await nav(page, "Spaces").click();
    await expect(page.getByRole("button", { name: "Open in Library" })).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/view-spaces.png" });

    await nav(page, "Review").click();
    await expect(page.getByText(/due cards across your study packs/)).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/view-review.png" });

    await nav(page, "Analytics").click();
    await expect(page.getByText("Mastery by topic")).toBeVisible();
    // Give Recharts a tick to render the SVG bars.
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/view-analytics.png" });

    await nav(page, "Sync").click();
    await expect(page.getByText("Local-only", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/navigation/shots/view-sync.png" });

    await nav(page, "Settings").click();
    const drawer = page.getByRole("dialog", { name: "Settings" });
    await expect(drawer).toBeVisible();
    // Wait out the Mantine slide-in transition so the shot isn't pre-paint.
    await expect(drawer.getByRole("button", { name: "Close settings" })).toBeVisible();
    await page.waitForTimeout(450);
    await page.screenshot({ path: "test-results/navigation/shots/view-settings-drawer.png" });
    await drawer.getByRole("button", { name: "Close settings" }).click();
    await expect(drawer).toBeHidden();
    await page.screenshot({ path: "test-results/navigation/shots/view-settings-overview.png" });
  });
});
