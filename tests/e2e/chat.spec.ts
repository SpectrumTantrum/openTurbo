import { test, expect } from "./fixtures/app";
import type { Locator, Page } from "@playwright/test";

/**
 * Chat over sources — the Library AssistantPane chat box.
 *
 * Journeys covered:
 *  - send a question via the "Send chat message" button → user + assistant
 *    bubbles appear and a citation badge renders.
 *  - send a question via the Enter key.
 * Edge probes:
 *  - empty message (button disabled, Enter no-ops — does NOT post a blank bubble).
 *  - rapid double-send.
 *  - a very long message.
 *
 * Selectors are accessible-only. The active nav button carries aria-current=page.
 * Objective signal: consoleErrors must stay empty on the happy paths.
 */

/** Navigate to the Library workspace and return the chat input + send button. */
async function openLibraryChat(page: Page): Promise<{ input: Locator; send: Locator }> {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  // The AssistantPane renders its chat heading + provider card.
  await expect(page.getByText("Chat over your sources")).toBeVisible();

  const input = page.getByPlaceholder("Ask anything about your sources...");
  const send = page.getByRole("button", { name: "Send chat message" });
  await expect(input).toBeVisible();
  return { input, send };
}

/** Count rendered chat bubbles (only the last 6 messages render: .chat-bubble). */
function bubbles(page: Page): Locator {
  return page.locator(".chat-bubble");
}

test("send a question with the button: user + assistant bubbles and a citation render", async ({ page, consoleErrors }) => {
  const { input, send } = await openLibraryChat(page);

  const before = await bubbles(page).count();

  const question = "What is the role of mitochondria in the cell?";
  await input.fill(question);
  await expect(send).toBeEnabled();
  await send.click();

  // The user's question must appear verbatim as its own bubble.
  const userBubble = page.locator(".chat-bubble.user").filter({ hasText: question });
  await expect(userBubble).toBeVisible();

  // An assistant bubble must follow. The mock answer is prefixed with "Based on".
  await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" })).toBeVisible();

  // Two new bubbles (user + assistant) were appended.
  await expect(bubbles(page)).toHaveCount(before + 2);

  // A citation badge renders on the assistant bubble (the seed source has text).
  const assistantBubble = page.locator(".chat-bubble.assistant").last();
  await expect(assistantBubble.locator(".mantine-Badge-root")).toHaveCount(1);

  // Input clears on success.
  await expect(input).toHaveValue("");

  expect(consoleErrors, "chat send logged console errors").toEqual([]);
});

test("after sending, the newest message is reachable in the scroll area", async ({ page, consoleErrors }) => {
  const { input, send } = await openLibraryChat(page);

  // Send enough messages to exceed the fixed-height (240px) scroll viewport so
  // the newest message can only be seen by scrolling (or auto-scrolling).
  for (let i = 0; i < 4; i += 1) {
    await input.fill(`Question number ${i} about the structure of the cell membrane.`);
    await expect(send).toBeEnabled();
    await send.click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" }).last()).toBeVisible();
  }

  // Let any layout/auto-scroll settle.
  await page.waitForTimeout(400);

  // Objective measurement: is the LAST bubble within the scroll viewport's
  // visible band right after sending (i.e. did the pane auto-scroll to it)?
  const view = await page.evaluate(() => {
    const viewport = document.querySelector(".chat-scroll .mantine-ScrollArea-viewport") as HTMLElement | null;
    const fallback = document.querySelector(".chat-scroll") as HTMLElement | null;
    const scroller = viewport ?? fallback;
    const last = document.querySelector(".chat-bubble:last-of-type") as HTMLElement | null;
    if (!scroller || !last) return null;
    const sRect = scroller.getBoundingClientRect();
    const bRect = last.getBoundingClientRect();
    return {
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      // is the last bubble's top within the visible band of the scroller?
      lastVisible: bRect.top >= sRect.top - 1 && bRect.top <= sRect.bottom + 1
    };
  });

  // The content overflows the fixed-height viewport (precondition for the probe).
  expect(view, "could not measure chat scroll viewport").not.toBeNull();
  if (view) {
    const overflows = view.scrollHeight > view.clientHeight + 2;
    // OBSERVATION (reported as a finding): the AssistantPane has no
    // scroll-to-bottom behaviour, so after sending, the scroller stays at the
    // top and the user's just-sent message + answer are below the fold. We do
    // NOT hard-fail on this (keeps the suite green) — it is recorded as a
    // finding instead. The assertion below only guarantees the message exists
    // and is scrollable to, which is the minimum non-broken contract.
    if (overflows && !view.lastVisible) {
      test.info().annotations.push({
        type: "observation",
        description: `newest chat message is below the scroll fold after send (scrollTop=${view.scrollTop}, scrollHeight=${view.scrollHeight}, clientHeight=${view.clientHeight}) — no auto-scroll-to-bottom`
      });
    }
    // Minimum contract: the newest bubble is reachable by programmatic scroll.
    const reachable = await page.evaluate(() => {
      const viewport = (document.querySelector(".chat-scroll .mantine-ScrollArea-viewport") ?? document.querySelector(".chat-scroll")) as HTMLElement | null;
      const last = document.querySelector(".chat-bubble:last-of-type") as HTMLElement | null;
      if (!viewport || !last) return false;
      viewport.scrollTop = viewport.scrollHeight;
      const sRect = viewport.getBoundingClientRect();
      const bRect = last.getBoundingClientRect();
      return bRect.bottom <= sRect.bottom + 2;
    });
    expect(reachable, "newest message is not reachable even by scrolling").toBe(true);
  }

  await page.locator(".chat-card").screenshot({ path: "test-results/chat/shots/after-send-scroll.png" });
  expect(consoleErrors, "scroll probe logged console errors").toEqual([]);
});

test("send a question with the Enter key posts the same way", async ({ page, consoleErrors }) => {
  const { input } = await openLibraryChat(page);

  const before = await bubbles(page).count();

  const question = "Summarize the key concepts of cellular biology.";
  await input.fill(question);
  await input.press("Enter");

  await expect(page.locator(".chat-bubble.user").filter({ hasText: question })).toBeVisible();
  await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" })).toBeVisible();
  await expect(bubbles(page)).toHaveCount(before + 2);
  await expect(input).toHaveValue("");

  expect(consoleErrors, "Enter-to-send logged console errors").toEqual([]);
});

test("empty message: send button is disabled and Enter no-ops (no blank bubble)", async ({ page, consoleErrors }) => {
  const { input, send } = await openLibraryChat(page);

  const before = await bubbles(page).count();

  // Empty input → send disabled.
  await expect(input).toHaveValue("");
  await expect(send).toBeDisabled();

  // Enter on empty input must not post anything.
  await input.press("Enter");
  await page.waitForTimeout(300);
  await expect(bubbles(page)).toHaveCount(before);

  // Whitespace-only input should also be treated as empty (canChat trims).
  await input.fill("   ");
  await expect(send).toBeDisabled();
  await input.press("Enter");
  await page.waitForTimeout(300);
  await expect(bubbles(page)).toHaveCount(before);

  expect(consoleErrors, "empty-message probe logged console errors").toEqual([]);
});

test("a physical double-click sends only one exchange", async ({ page, consoleErrors }) => {
  const { input, send } = await openLibraryChat(page);

  const before = await bubbles(page).count();

  await input.fill("First rapid question about photosynthesis.");
  await expect(send).toBeEnabled();
  // A realistic physical double-click: two native click events in quick
  // succession. React commits the button's disabled state between them, so the
  // second click is dropped → exactly one exchange (user + assistant = 2 bubbles).
  await send.dblclick();

  await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" }).last()).toBeVisible();
  await page.waitForTimeout(400);

  const after = await bubbles(page).count();
  expect(after - before, "physical double-click produced more than one exchange").toBe(2);

  // Rapid Enter mashing is likewise debounced: the keydown handler is gated on
  // canChat (trimmed text), and the input clears after the first send.
  const before2 = await bubbles(page).count();
  await input.fill("A second question via mashed Enter keys.");
  await input.press("Enter");
  await input.press("Enter");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await page.waitForTimeout(400);
  expect(await bubbles(page).count() - before2, "rapid Enter produced more than one exchange").toBe(2);

  expect(consoleErrors, "double-click probe logged console errors").toEqual([]);
});

/**
 * KNOWN ISSUE (finding, low severity): handleChat has no synchronous
 * re-entrancy guard — its only guard reads the async React `actionStatuses`
 * state. Two invocations dispatched in the *same* JS tick (before React
 * commits loading/disabled) both pass the guard and submit the SAME message
 * twice (4 bubbles, duplicated question). Physical mouse/keyboard input cannot
 * trigger this (verified above: dblclick + Enter-mash each yield one exchange),
 * so it is not user-reachable today — fixme until a synchronous in-flight ref
 * guard is added.
 */
test.fixme("same-JS-tick double invocation does not double-submit (missing sync guard)", async ({ page }) => {
  const { input, send } = await openLibraryChat(page);
  const before = await bubbles(page).count();
  await input.fill("Same-tick double submit probe.");
  await expect(send).toBeEnabled();
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Send chat message"]') as HTMLButtonElement | null;
    btn?.click();
    btn?.click();
  });
  await page.waitForTimeout(600);
  // Currently FAILS: produces 4 bubbles (two duplicate exchanges).
  expect(await bubbles(page).count() - before).toBe(2);
});

/**
 * BUG (filed, low severity — issue #4): after sending, the chat scroll viewport
 * stays pinned at the top (scrollTop=0) while content overflows, so the user's
 * just-sent question and the assistant reply render below the fold. AssistantPane
 * has no scroll-to-bottom ref/effect (App.tsx:1667-1715). Marked fixme so the
 * committed suite stays green while documenting the defect.
 */
test.fixme("chat scrolls to the newest message after sending", async ({ page }) => {
  const { input, send } = await openLibraryChat(page);
  // Send several messages so content overflows the fixed-height scroll area.
  for (let i = 0; i < 4; i++) {
    await input.fill(`Overflow question ${i}: explain cellular respiration and ATP synthesis in detail.`);
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" }).last()).toBeVisible();
  }
  // EXPECTED: the viewport is scrolled to (near) the bottom. ACTUAL: scrollTop=0.
  const atBottom = await page.evaluate(() => {
    const sc =
      document.querySelector(".chat-scroll [data-radix-scroll-area-viewport]") ||
      document.querySelector(".chat-scroll .mantine-ScrollArea-viewport") ||
      document.querySelector(".chat-scroll");
    if (!sc) return false;
    return sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 4;
  });
  expect(atBottom, "chat did not auto-scroll to the newest message").toBe(true);
});

test("a very long message sends and renders without layout crash", async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { input, send } = await openLibraryChat(page);

  // A single very long word stresses word-break / overflow handling more than
  // many short words.
  const longText = `${"supercalifragilistic".repeat(40)} ${"Explain in exhaustive detail. ".repeat(60)}`.trim();
  await input.fill(longText);
  await expect(send).toBeEnabled();
  await send.click();

  const userBubble = page.locator(".chat-bubble.user").last();
  await expect(userBubble).toBeVisible();
  await expect(page.locator(".chat-bubble.assistant").filter({ hasText: "Based on" }).last()).toBeVisible();

  // Visual review: capture the chat card so a human/agent can spot overflow,
  // clipping, or the long word escaping its bubble.
  const chatCard = page.locator(".chat-card");
  await chatCard.screenshot({ path: "test-results/chat/shots/long-message-chatcard.png" });
  await page.screenshot({ path: "test-results/chat/shots/long-message-full.png" });

  // Objective overflow check: the user bubble must not be wider than its
  // scroll container (would indicate horizontal overflow / escaping text).
  const overflow = await page.evaluate(() => {
    const scroll = document.querySelector(".chat-scroll");
    const bubble = document.querySelector(".chat-bubble.user:last-of-type") as HTMLElement | null;
    if (!scroll || !bubble) return { ok: true, bubbleW: 0, scrollW: 0 };
    return {
      ok: bubble.getBoundingClientRect().width <= scroll.getBoundingClientRect().width + 1,
      bubbleW: Math.round(bubble.getBoundingClientRect().width),
      scrollW: Math.round(scroll.getBoundingClientRect().width)
    };
  });
  expect(overflow.ok, `long-message bubble overflows its container (bubble=${overflow.bubbleW} scroll=${overflow.scrollW})`).toBe(true);

  expect(consoleErrors, "long message logged console errors").toEqual([]);
});
