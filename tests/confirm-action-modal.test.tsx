import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { ConfirmActionModal } = await import("../src/renderer/a2ui/ConfirmActionModal.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("ConfirmActionModal shows title, message, and fires onConfirm", () => {
  let confirmed = false;
  let cancelled = false;
  render(wrap(<ConfirmActionModal
    opened
    title="Generate study material?"
    message="Generate flashcards, quiz."
    confirmLabel="Generate"
    onConfirm={() => { confirmed = true; }}
    onCancel={() => { cancelled = true; }}
  />));
  assert.ok(screen.getByText("Generate study material?"));
  assert.ok(screen.getByText("Generate flashcards, quiz."));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  assert.equal(confirmed, true);
  assert.equal(cancelled, false);
});

test("ConfirmActionModal cancel button fires onCancel", () => {
  let confirmed = false;
  let cancelled = false;
  render(wrap(<ConfirmActionModal
    opened
    title="X"
    message="Y"
    confirmLabel="Go"
    onConfirm={() => { confirmed = true; }}
    onCancel={() => { cancelled = true; }}
  />));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(cancelled, true);
  assert.equal(confirmed, false);
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
