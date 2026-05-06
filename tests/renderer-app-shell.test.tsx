import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen, within } = await import("@testing-library/react");
const { default: App } = await import("../src/renderer/App.js");

test.afterEach(() => {
  cleanup();
});

test("App shell exposes responsive navigation labels and primary controls update visible state", { timeout: 20_000 }, async () => {
  render(<App />);
  await screen.findByText("OpenTurbo");

  const navLabels = ["Library", "Spaces", "Review", "Analytics", "Sync", "Settings"];
  const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-item"));
  assert.deepEqual(
    navButtons.map((button) => button.getAttribute("aria-label")),
    navLabels
  );

  fireEvent.click(screen.getByRole("button", { name: "Spaces" }));
  assert.ok(screen.getByText("Choose a workspace to focus the Library list."));
  fireEvent.click(screen.getByRole("button", { name: "Open in Library" }));
  assert.ok(await screen.findByText("Sources (1)"));

  fireEvent.click(screen.getByRole("button", { name: "Import source" }));
  const importDialog = await screen.findByRole("dialog", { name: "Import source" });
  assert.ok(within(importDialog).getByRole("button", { name: "Import and generate" }).hasAttribute("disabled"));
  fireEvent.change(within(importDialog).getByLabelText("Title"), { target: { value: "Photosynthesis lab" } });
  fireEvent.change(within(importDialog).getByLabelText("Paste source text"), {
    target: { value: "Photosynthesis converts light, carbon dioxide, and water into glucose and oxygen in chloroplasts." }
  });
  assert.equal(within(importDialog).getByRole("button", { name: "Import and generate" }).hasAttribute("disabled"), false);
  fireEvent.click(within(importDialog).getByRole("button", { name: "Close import source" }));

  fireEvent.click(screen.getByRole("button", { name: "Favorite Cellular Biology Fundamentals" }));
  fireEvent.click(screen.getByRole("radio", { name: "Favorites" }));
  assert.ok(screen.getAllByText("Cellular Biology Fundamentals").length > 0);
  fireEvent.change(screen.getByPlaceholderText("Search library..."), { target: { value: "not present" } });
  assert.ok(screen.getByText("No sources match the current library controls."));
  fireEvent.change(screen.getByPlaceholderText("Search library..."), { target: { value: "" } });
  fireEvent.click(screen.getByRole("radio", { name: "All" }));

  fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
  assert.ok(await screen.findByText("Exported markdown."));
  fireEvent.click(screen.getByRole("button", { name: "Anki" }));
  assert.ok(await screen.findByText("Exported anki-csv."));

  fireEvent.click(screen.getByRole("tab", { name: "Flashcards" }));
  const goodButtons = screen.getAllByRole("button", { name: "good" });
  fireEvent.click(goodButtons[0]);
  assert.ok(await screen.findByText("Review saved."));

  fireEvent.click(screen.getByRole("tab", { name: "Quiz" }));
  const firstChoice = document.querySelector<HTMLButtonElement>(".choice");
  assert.ok(firstChoice);
  fireEvent.click(firstChoice);
  assert.ok(screen.getByRole("button", { name: "Reset" }).hasAttribute("disabled") === false);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  assert.ok(screen.getByText("0 of 5 answered · 0 correct"));

  fireEvent.change(screen.getByPlaceholderText("Ask anything about your sources..."), { target: { value: "What is photosynthesis?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send chat message" }));
  assert.ok(await screen.findByText("What is photosynthesis?"));

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const settingsDrawer = await screen.findByRole("dialog", { name: "Settings" });
  assert.ok(within(settingsDrawer).getByRole("button", { name: "Close settings" }));
  fireEvent.click(within(settingsDrawer).getAllByRole("button", { name: "Test" })[0]);
  assert.ok((await screen.findAllByText("Provider test passed.")).length > 0);
  fireEvent.change(within(settingsDrawer).getByLabelText("Sync server URL"), { target: { value: "http://localhost:8787" } });
  fireEvent.click(within(settingsDrawer).getByRole("button", { name: "Save settings" }));

  fireEvent.click(screen.getByRole("button", { name: "Sync" }));
  assert.ok(await screen.findByText("Sync enabled"));
});

function setupDom(): void {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1/" });
  const requestAnimationFrameShim = (callback: FrameRequestCallback) => dom.window.setTimeout(() => callback(Date.now()), 0);
  const cancelAnimationFrameShim = (handle: number) => dom.window.clearTimeout(handle);

  dom.window.requestAnimationFrame = requestAnimationFrameShim;
  dom.window.cancelAnimationFrame = cancelAnimationFrameShim;

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Element: { configurable: true, value: dom.window.Element },
    Node: { configurable: true, value: dom.window.Node },
    SVGElement: { configurable: true, value: dom.window.SVGElement },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: { configurable: true, value: requestAnimationFrameShim },
    cancelAnimationFrame: { configurable: true, value: cancelAnimationFrameShim },
    matchMedia: {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })
    },
    ResizeObserver: {
      configurable: true,
      value: class ResizeObserver {
        observe(): void {
          return undefined;
        }
        unobserve(): void {
          return undefined;
        }
        disconnect(): void {
          return undefined;
        }
      }
    }
  });
}
