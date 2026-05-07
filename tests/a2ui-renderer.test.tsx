import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { A2UIRender } = await import("../src/renderer/a2ui/A2UIRender.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const handlers = {
  onAction: () => undefined
};

test.afterEach(() => cleanup());

test("A2UIRender renders a known component when payload is valid", () => {
  render(wrap(<A2UIRender payload={{
    component: "ReviewQueueCard",
    props: { dueCount: 4, preview: [{ cardId: "c1", front: "Mitosis" }] },
    actions: { onOpenReview: { actionId: "open-review" } }
  }} handlers={handlers} dev />));
  assert.ok(screen.getByText("Mitosis"));
  assert.ok(screen.getByRole("button", { name: "Open review session" }));
});

test("A2UIRender renders SafeErrorCard for unknown component (regression)", () => {
  render(wrap(<A2UIRender payload={{ component: "FakeCard", props: {}, actions: {} }} handlers={handlers} dev />));
  assert.ok(screen.getByText(/unsupported component/i));
});

test("A2UIRender renders SafeErrorCard for invalid props (regression)", () => {
  render(wrap(<A2UIRender payload={{
    component: "ReviewQueueCard",
    props: { dueCount: "five" } as unknown as Record<string, unknown>,
    actions: {}
  }} handlers={handlers} dev />));
  assert.ok(screen.getByText(/couldn.t render/i));
});

test("A2UIRender wires action handlers; clicking emits actionId via handlers.onAction", async () => {
  let received = "";
  render(wrap(<A2UIRender
    payload={{
      component: "ReviewQueueCard",
      props: { dueCount: 1, preview: [] },
      actions: { onOpenReview: { actionId: "open-review-now" } }
    }}
    handlers={{ onAction: (id) => { received = id; } }}
    dev
  />));
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(received, "open-review-now");
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
