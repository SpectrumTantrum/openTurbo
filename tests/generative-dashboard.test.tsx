import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { GenerativeStudyDashboard } = await import("../src/renderer/dashboard/GenerativeStudyDashboard.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const baseHints = {
  dueCount: 3,
  weakAreas: ["Mitosis"],
  jobs: [],
  firstSourceTitle: "Cellular Biology"
};

test.afterEach(() => cleanup());

test("dashboard renders static overview when no prompt has been submitted", () => {
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={() => undefined}
    agentAvailable={false}
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Weak areas"));
});

test("submitting a prompt swaps in a relevant sample payload via the stub agent", async () => {
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={() => undefined}
    agentAvailable
  />));
  fireEvent.change(screen.getByPlaceholderText(/ask the assistant/i), { target: { value: "Show weak topics" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  // The stub dispatcher is async; wait for the dashboard to update.
  assert.ok(await screen.findByText("Mitosis"));
});

test("dashboard forwards action events from rendered cards to onAction", () => {
  let received = "";
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={(id: string) => { received = id; }}
    agentAvailable
  />));
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(received, "open-review");
});

test("clicking Open review session from the dashboard navigates to the focused workspace", async () => {
  const { default: App } = await import("../src/renderer/App.js");
  render(<App />);
  await screen.findByText("OpenTurbo");
  // Default view is Dashboard, which renders StaticOverview with a Review queue card.
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  // After click, nav switches to Review.
  assert.equal(screen.getByRole("button", { name: "Review" }).getAttribute("aria-current"), "page");
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
