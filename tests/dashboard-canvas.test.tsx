import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { AssistantPrompt } = await import("../src/renderer/dashboard/AssistantPrompt.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("AssistantPrompt submits the trimmed prompt and clears the input", () => {
  let submitted = "";
  render(wrap(<AssistantPrompt
    placeholder="Ask anything"
    onSubmit={(value: string) => { submitted = value; }}
    disabled={false}
  />));
  fireEvent.change(screen.getByPlaceholderText("Ask anything"), { target: { value: "  build my plan  " } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  assert.equal(submitted, "build my plan");
  assert.equal((screen.getByPlaceholderText("Ask anything") as HTMLInputElement).value, "");
});

test("AssistantPrompt ignores empty submissions", () => {
  let calls = 0;
  render(wrap(<AssistantPrompt placeholder="Ask anything" onSubmit={() => { calls += 1; }} disabled={false} />));
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  assert.equal(calls, 0);
});

test("AssistantPrompt is disabled while a request is in flight", () => {
  render(wrap(<AssistantPrompt placeholder="Ask" onSubmit={() => undefined} disabled />));
  const input = screen.getByPlaceholderText("Ask") as HTMLInputElement;
  assert.equal(input.disabled, true);
});

const { DashboardCanvas } = await import("../src/renderer/dashboard/DashboardCanvas.js");

test("DashboardCanvas renders each payload in order", () => {
  render(wrap(<DashboardCanvas
    payloads={[
      { component: "ReviewQueueCard", props: { dueCount: 1, preview: [] }, actions: {} },
      { component: "JobStatusCard", props: { jobs: [] }, actions: {} }
    ]}
    onAction={() => undefined}
    dev
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Jobs"));
});

test("DashboardCanvas isolates errors so one bad payload does not blow up the rest", () => {
  render(wrap(<DashboardCanvas
    payloads={[
      { component: "BogusCard", props: {}, actions: {} },
      { component: "ReviewQueueCard", props: { dueCount: 0, preview: [] }, actions: {} }
    ]}
    onAction={() => undefined}
    dev
  />));
  assert.ok(screen.getByText(/unsupported component/i));
  assert.ok(screen.getByText("Review queue"));
});

test("DashboardCanvas renders empty-state hint when payloads is empty", () => {
  render(wrap(<DashboardCanvas payloads={[]} onAction={() => undefined} dev />));
  assert.ok(screen.getByText(/ask the assistant to assemble/i));
});

const { StaticOverview } = await import("../src/renderer/dashboard/StaticOverview.js");

test("StaticOverview renders calm activity overview without prompting agent", () => {
  render(wrap(<StaticOverview
    snapshotHints={{
      dueCount: 4,
      weakAreas: ["Membrane transport"],
      jobs: [],
      firstSourceTitle: "Cellular Biology"
    }}
    onAction={() => undefined}
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Weak areas"));
  assert.ok(screen.getByText("Membrane transport"));
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
