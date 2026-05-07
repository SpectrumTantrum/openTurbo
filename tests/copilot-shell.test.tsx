import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { CopilotShell } = await import("../src/renderer/copilot/CopilotShell.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("CopilotShell renders children when no runtimeUrl is provided (graceful no-op)", () => {
  render(wrap(<CopilotShell><span data-testid="child">x</span></CopilotShell>));
  assert.ok(screen.getByTestId("child"));
});

// Note: in the Node test runner, the dynamic SDK import always fails (CSS
// side-effect import is incompatible with Node). This test only verifies that
// children survive that failure unwrapped. The browser path that actually
// wraps children in CopilotKitProvider is exercised in production but not
// from this suite.
test("CopilotShell renders children when runtimeUrl is provided", () => {
  render(wrap(<CopilotShell runtimeUrl="/api/copilotkit"><span data-testid="child">y</span></CopilotShell>));
  assert.ok(screen.getByTestId("child"));
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
