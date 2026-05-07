import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { useA2UIRuntime } = await import("../src/renderer/copilot/useA2UIRuntime.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("when no transport is provided, hook reports agentAvailable=false and sendPrompt is a noop", async () => {
  function Harness() {
    const runtime = useA2UIRuntime({ onAction: () => undefined, transport: undefined });
    return (
      <div>
        <span data-testid="available">{String(runtime.agentAvailable)}</span>
        <button onClick={() => void runtime.sendPrompt("hi")}>send</button>
      </div>
    );
  }
  render(wrap(<Harness />));
  assert.equal(screen.getByTestId("available").textContent, "false");
});

test("invalid agent payloads are filtered out before exposure", async () => {
  const fakeTransport = {
    subscribe(cb: (payload: { component: string; props: Record<string, unknown>; actions?: Record<string, { actionId: string }> }) => void) {
      cb({ component: "BogusCard", props: {}, actions: {} });
      cb({ component: "ReviewQueueCard", props: { dueCount: 2, preview: [] }, actions: {} });
      return () => undefined;
    },
    async send() { return; }
  };

  function Harness() {
    const runtime = useA2UIRuntime({ onAction: () => undefined, transport: fakeTransport });
    return <pre data-testid="payloads">{runtime.payloads.map((p) => p.component).join(",")}</pre>;
  }
  render(wrap(<Harness />));
  assert.equal(screen.getByTestId("payloads").textContent, "ReviewQueueCard");
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
