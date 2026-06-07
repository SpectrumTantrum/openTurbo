import { test, expect } from "./fixtures/app";
import type { Locator, Page } from "@playwright/test";

/**
 * Area: Spaces, favorites & library filters (browser surface).
 *
 * Covers the journeys that connect the Spaces view to the Library three-pane
 * workspace:
 *   - Spaces cards + "Open in Library" focuses a space and switches to Library
 *   - the LibraryPane space dropdown switches the focused space
 *   - the Favorites star toggle + Favorites filter
 *   - live library search, the empty "no match" state, and filter switching
 *
 * The browser preview seeds exactly one space ("My Study Library") holding one
 * source ("Cellular Biology Fundamentals") and one study pack
 * ("Cellular Biology Fundamentals Study Pack"). Assertions are written against
 * that seed; selectors are accessible-only (getByRole / getByText / getByLabel /
 * getByPlaceholder). The active nav button carries aria-current="page".
 */

const SOURCE_TITLE = "Cellular Biology Fundamentals";
const PACK_TITLE = "Cellular Biology Fundamentals Study Pack";
const SPACE_NAME = "My Study Library";
const NO_SOURCES = "No sources match the current library controls.";
const NO_PACKS = "No study packs match the current library controls.";

const SHOTS = "test-results/spaces/shots";

/** The Library pane lives in a <section class="library-pane">. Scope here so the
 *  ambiguous "All"/"Sources" labels don't collide with text elsewhere. */
function libraryPane(page: Page): Locator {
  return page.locator("section.library-pane");
}

/** The Mantine SegmentedControl renders clickable <label> text; click the label. */
async function setFilter(page: Page, name: "All" | "Sources" | "Packs" | "Favorites") {
  await libraryPane(page).locator(".library-filter").getByText(name, { exact: true }).click();
}

/** The space NativeSelect is the only enabled <select> inside the Library pane. */
function spaceSelect(page: Page): Locator {
  return libraryPane(page).getByRole("combobox");
}

async function gotoLibrary(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();
}

test.describe("Spaces, favorites & library filters", () => {
  test("Spaces view renders cards and 'Open in Library' focuses the space", async ({ page, consoleErrors }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Spaces" }).click();

    // Spaces nav is now active and the heading + seed space card render.
    await expect(page.getByRole("button", { name: "Spaces" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Choose a workspace to focus the Library list.")).toBeVisible();
    const card = page.locator(".card-grid").getByText(SPACE_NAME, { exact: true });
    await expect(card).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/spaces-view.png` });

    // "Open in Library" jumps to the Library view, focused on this space.
    await page.getByRole("button", { name: "Open in Library" }).click();
    await expect(page.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Sources (1)")).toBeVisible();

    // The Library space dropdown now reflects the focused space (not "All spaces").
    await expect(spaceSelect(page)).toHaveValue(/.+/);
    await expect(spaceSelect(page).locator("option:checked")).toHaveText(SPACE_NAME);
    // The focused space's source is listed.
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/open-in-library-focused.png` });

    expect(consoleErrors, "Spaces -> Open in Library logged console errors").toEqual([]);
  });

  test("'Show all in Library' clears the focused space", async ({ page, consoleErrors }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Spaces" }).click();

    // Focus the space first.
    await page.getByRole("button", { name: "Open in Library" }).click();
    await expect(spaceSelect(page).locator("option:checked")).toHaveText(SPACE_NAME);

    // Back to Spaces, then "Show all in Library" should reset to "All spaces".
    await page.getByRole("button", { name: "Spaces" }).click();
    await page.getByRole("button", { name: "Show all in Library" }).click();
    await expect(page.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
    await expect(spaceSelect(page).locator("option:checked")).toHaveText("All spaces");
    await expect(page.getByText("Sources (1)")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Library space dropdown switches between All spaces and the seed space", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Defaults to "All spaces"; the single seed source is visible.
    await expect(spaceSelect(page).locator("option:checked")).toHaveText("All spaces");
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();

    // Switch to the named space: still shows its source (the source belongs to it).
    await spaceSelect(page).selectOption({ label: SPACE_NAME });
    await expect(spaceSelect(page).locator("option:checked")).toHaveText(SPACE_NAME);
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();

    // Switch back to "All spaces".
    await spaceSelect(page).selectOption({ label: "All spaces" });
    await expect(spaceSelect(page).locator("option:checked")).toHaveText("All spaces");
    await expect(page.getByText("Sources (1)")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Favorite a source, then the Favorites filter shows only favorites", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Before favoriting, the Favorites filter shows the empty states.
    await setFilter(page, "Favorites");
    await expect(page.getByText("Sources (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_SOURCES)).toBeVisible();
    await expect(libraryPane(page).getByText(NO_PACKS)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/favorites-empty.png` });

    // Back to All; favorite the source via its star (aria-label toggles).
    await setFilter(page, "All");
    const favSource = page.getByRole("button", { name: `Favorite ${SOURCE_TITLE}`, exact: true });
    await favSource.click();
    await expect(
      page.getByRole("button", { name: `Remove ${SOURCE_TITLE} from favorites`, exact: true })
    ).toBeVisible();

    // Favorites filter now shows the favorited source but no (un-favorited) packs.
    await setFilter(page, "Favorites");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();
    await expect(page.getByText("Study Packs (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_PACKS)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/favorites-source.png` });

    expect(consoleErrors).toEqual([]);
  });

  test("Favorite a pack, then the Favorites filter shows only the pack", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Favorite the study pack via its star (separate favoriteIds entry from the source).
    const favPack = page.getByRole("button", { name: `Favorite ${PACK_TITLE}`, exact: true });
    await favPack.click();
    await expect(
      page.getByRole("button", { name: `Remove ${PACK_TITLE} from favorites`, exact: true })
    ).toBeVisible();

    // Favorites filter: the pack shows, but the (un-favorited) source does not.
    await setFilter(page, "Favorites");
    await expect(page.getByText("Study Packs (1)")).toBeVisible();
    await expect(libraryPane(page).getByText(PACK_TITLE, { exact: true })).toBeVisible();
    await expect(page.getByText("Sources (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_SOURCES)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/favorites-pack.png` });

    // Un-favorite from within the Favorites view empties it again.
    await page.getByRole("button", { name: `Remove ${PACK_TITLE} from favorites`, exact: true }).click();
    await expect(page.getByText("Study Packs (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_PACKS)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Un-favorite removes the source from the Favorites filter", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Favorite, confirm in Favorites, then un-favorite from within the filter.
    await page.getByRole("button", { name: `Favorite ${SOURCE_TITLE}`, exact: true }).click();
    await setFilter(page, "Favorites");
    await expect(page.getByText("Sources (1)")).toBeVisible();

    await page.getByRole("button", { name: `Remove ${SOURCE_TITLE} from favorites`, exact: true }).click();
    // Now the Favorites view is empty again.
    await expect(page.getByText("Sources (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_SOURCES)).toBeVisible();

    // And the source reappears under All.
    await setFilter(page, "All");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Favorite ${SOURCE_TITLE}`, exact: true })
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Library search filters live and surfaces the no-match empty state", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);
    const search = page.getByPlaceholder("Search library...");

    // A matching query keeps the source + pack (both match "cell"/title text).
    await search.fill("biology");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();

    // A no-match query empties both sections with the documented copy.
    await search.fill("zzzznotathing");
    await expect(page.getByText("Sources (0)")).toBeVisible();
    await expect(page.getByText("Study Packs (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_SOURCES)).toBeVisible();
    await expect(libraryPane(page).getByText(NO_PACKS)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/search-no-match.png` });

    // Clearing the search restores the full library.
    await search.fill("");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(page.getByText("Study Packs (1)")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Filter segmented control switches All / Sources / Packs / Favorites", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Sources: pack list collapses to 0.
    await setFilter(page, "Sources");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(page.getByText("Study Packs (0)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_PACKS)).toBeVisible();

    // Packs: source list collapses to 0.
    await setFilter(page, "Packs");
    await expect(page.getByText("Sources (0)")).toBeVisible();
    await expect(page.getByText("Study Packs (1)")).toBeVisible();
    await expect(libraryPane(page).getByText(NO_SOURCES)).toBeVisible();

    // Back to All: both populated again.
    await setFilter(page, "All");
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(page.getByText("Study Packs (1)")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Rapid filter toggling and repeated favorite toggles stay clean", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    // Hammer the segmented control.
    for (const f of ["Sources", "Packs", "Favorites", "All", "Packs", "All"] as const) {
      await setFilter(page, f);
    }
    await expect(page.getByText("Sources (1)")).toBeVisible();

    // Toggle the source favorite on/off several times; end un-favorited.
    const star = () => page.getByRole("button", { name: new RegExp(`(Favorite|Remove) ${SOURCE_TITLE}`) }).first();
    for (let i = 0; i < 4; i += 1) {
      await star().click();
    }
    await expect(
      page.getByRole("button", { name: `Favorite ${SOURCE_TITLE}`, exact: true })
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("Narrow + wide viewports keep the Library pane usable", async ({ page, consoleErrors }) => {
    await gotoLibrary(page);

    await page.setViewportSize({ width: 900, height: 700 });
    await expect(page.getByPlaceholder("Search library...")).toBeVisible();
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/library-900x700.png` });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByPlaceholder("Search library...")).toBeVisible();
    await expect(libraryPane(page).getByText(SOURCE_TITLE, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/library-1440x900.png` });

    // Spaces view at the narrow width should still show the card grid.
    await page.setViewportSize({ width: 900, height: 700 });
    await page.getByRole("button", { name: "Spaces" }).click();
    await expect(page.locator(".card-grid").getByText(SPACE_NAME, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/spaces-900x700.png` });

    expect(consoleErrors).toEqual([]);
  });
});
