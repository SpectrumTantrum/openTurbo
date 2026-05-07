import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { default: App } = await import("../src/renderer/App.js");

test.afterEach(() => cleanup());

test("dashboard end-to-end: ask -> render approved cards -> open workspace -> confirm generation", { timeout: 30_000 }, async () => {
  render(<App />);
  await screen.findByText("OpenTurbo");

  // Default view is the dashboard.
  assert.equal(screen.getByRole("button", { name: "Dashboard" }).getAttribute("aria-current"), "page");
  assert.ok(screen.getByText("Review queue"));

  // Ask the assistant for a generation plan.
  fireEvent.change(screen.getByPlaceholderText(/ask the assistant/i), { target: { value: "prepare a quiz from these sources" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));

  // Approved component renders (GenerationPreviewCard).
  assert.ok(await screen.findByText(/plan generation/i));

  // Confirm the generation; modal must appear because generate-pack requires confirmation.
  fireEvent.click(screen.getByRole("button", { name: "Confirm generation" }));
  assert.ok(await screen.findByText("Generate study material?"));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  // After confirmation, refresh runs; the app should still be functional. Switch to Library and confirm it loads.
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  await screen.findByText(/^sources \(/i);

  // Regression: unknown component never crashed the app — title is still present.
  assert.ok(screen.getByText("OpenTurbo"));
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
