import { test, expect } from "./fixtures/app";

/**
 * Mind map (ReactFlow) journeys.
 *
 * The Mind map lives inside the Library three-pane workspace: open Library,
 * select the seeded study pack, switch to the "Mind map" study tab, and the
 * ReactFlow canvas renders a tree (root + section nodes + keyword leaves).
 *
 * This rendering is invisible to jsdom, so the value here is the screenshots +
 * objective console-error signal.
 */

const SHOTS = "test-results/mindmap/shots";

/** Open Library, select the seeded pack, and switch to the Mind map tab. */
async function openMindMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Sources (1)")).toBeVisible();

  // Select the seeded study pack so the study editor (with tabs) is shown.
  await page.getByRole("button", { name: /Study Pack/ }).first().click();

  // Switch to the Mind map tab.
  const mindMapTab = page.getByRole("tab", { name: "Mind map" });
  await expect(mindMapTab).toBeVisible();
  await mindMapTab.click();
}

test("mind map tab renders a ReactFlow tree with controls", async ({ page, consoleErrors }) => {
  await openMindMap(page);

  // ReactFlow renderer mounted: the pane and at least the root node exist.
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();

  const nodes = page.locator(".react-flow__node");
  await expect(nodes.first()).toBeVisible();
  const nodeCount = await nodes.count();
  expect(nodeCount).toBeGreaterThan(1); // root + children, not a blank canvas

  // Edges connect the tree.
  const edges = page.locator(".react-flow__edge");
  expect(await edges.count()).toBeGreaterThan(0);

  // ReactFlow controls (zoom in / out / fit view) are present.
  await expect(page.locator(".react-flow__controls")).toBeVisible();

  // Root label is the source title, rendered inside a ReactFlow node.
  await expect(nodes.filter({ hasText: "Cellular Biology Fundamentals" }).first()).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/mindmap-default.png`, fullPage: false });
  // Tight crop of just the ReactFlow canvas for visual inspection.
  await page.locator(".mindmap").screenshot({ path: `${SHOTS}/mindmap-canvas.png` });

  expect(consoleErrors, "mind map logged unexpected console errors").toEqual([]);
});

test("mind map zoom and fit-view controls work", async ({ page, consoleErrors }) => {
  await openMindMap(page);

  const viewport = page.locator(".react-flow__viewport");
  await expect(viewport).toBeVisible();
  const before = await viewport.getAttribute("style");

  await page.getByRole("button", { name: "zoom in" }).click();
  await page.getByRole("button", { name: "zoom in" }).click();
  const afterZoom = await viewport.getAttribute("style");
  expect(afterZoom).not.toEqual(before); // transform/scale changed

  await page.getByRole("button", { name: "fit view" }).click();
  await page.screenshot({ path: `${SHOTS}/mindmap-fitview.png` });

  expect(consoleErrors).toEqual([]);
});

test("mind map at small viewport stays rendered", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openMindMap(page);

  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".react-flow__controls")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/mindmap-900x700.png` });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "fit view" }).click();
  await page.screenshot({ path: `${SHOTS}/mindmap-1440x900.png` });

  expect(consoleErrors).toEqual([]);
});

test("rapid tab switching to/from mind map does not break", async ({ page, consoleErrors }) => {
  await openMindMap(page);

  for (let i = 0; i < 4; i++) {
    await page.getByRole("tab", { name: "Notes" }).click();
    await page.getByRole("tab", { name: "Mind map" }).click();
  }
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/mindmap-after-tabswitch.png` });

  expect(consoleErrors).toEqual([]);
});

/**
 * BUG (documented, kept failing-as-fixme so the suite stays green):
 * `mindMapToFlow` in App.tsx lays out leaf nodes by branch-local index, so leaf
 * nodes from different section branches land on IDENTICAL (x, y) coordinates and
 * stack exactly on top of one another. Of the 9 keyword leaves only ~5 distinct
 * positions are visible; the rest are fully hidden. Verified at 1280x720 AND
 * 1440x900 (viewport-independent): 5 pairs of nodes overlap ~100% (142x39 px).
 * See test-results/mindmap/shots/mindmap-canvas.png.
 *
 * Expectation: a mind map should not render nodes stacked directly on top of
 * each other — every node should be independently visible.
 */
test.fixme("mind map leaf nodes do not overlap each other", async ({ page }) => {
  await openMindMap(page);
  await page.waitForTimeout(400);

  const nodes = page.locator(".react-flow__node");
  const n = await nodes.count();
  const boxes: ({ x: number; y: number; width: number; height: number } | null)[] = [];
  for (let i = 0; i < n; i++) boxes.push(await nodes.nth(i).boundingBox());

  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (!a || !b) continue;
      const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      if (ox > 2 && oy > 2) overlaps++;
    }
  }
  expect(overlaps, "mind map nodes overlap each other").toBe(0);
});

/**
 * BUG (documented as fixme): the `.mindmap` container declares height:520px
 * but its parent `.document-scroll` only allots ~305px at the default 1280x720
 * viewport, so ReactFlow's fitView spreads nodes over a 520px canvas while only
 * the top ~305px is visible. The distinct teal ROOT node ("Cellular Biology
 * Fundamentals") renders below the visible scroll area, overlapping / hidden
 * behind the editor footer (.editor-status). See mindmap-default.png — the root
 * node is off-screen even though it is the most important node.
 *
 * Expectation: after fitView, the root node should be visible within the
 * scrollable mind-map viewport, not clipped behind the footer.
 */
test.fixme("mind map root node is visible after fitView (not clipped by footer)", async ({ page }) => {
  await openMindMap(page);
  await page.waitForTimeout(400);

  const scroll = await page.locator(".document-scroll").boundingBox();
  const root = await page
    .locator(".react-flow__node")
    .filter({ hasText: "Cellular Biology Fundamentals" })
    .first()
    .boundingBox();
  expect(root && scroll).toBeTruthy();
  if (root && scroll) {
    expect(root.y + root.height, "root node clipped below visible scroll area").toBeLessThanOrEqual(scroll.y + scroll.height + 1);
  }
});
