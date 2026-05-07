import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { OTCard, OTSectionHeader, OTEmptyState } = await import("../src/renderer/components/ot/index.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("OTCard renders title, optional aside, and children", () => {
  render(wrap(
    <OTCard title="Plan" aside={<span data-testid="aside">3 items</span>}>
      <p>body</p>
    </OTCard>
  ));
  assert.ok(screen.getByText("Plan"));
  assert.ok(screen.getByTestId("aside"));
  assert.ok(screen.getByText("body"));
});

test("OTCard exposes role region with accessible name when title is given", () => {
  render(wrap(<OTCard title="Plan">x</OTCard>));
  const region = screen.getByRole("region", { name: "Plan" });
  assert.ok(region);
});

test("OTSectionHeader renders title, eyebrow, and trailing slot", () => {
  render(wrap(
    <OTSectionHeader eyebrow="Today" title="Review queue" trailing={<span data-testid="trailing">12</span>} />
  ));
  assert.equal(screen.getByText("Today").tagName.toLowerCase(), "small");
  assert.ok(screen.getByRole("heading", { name: "Review queue" }));
  assert.ok(screen.getByTestId("trailing"));
});

test("OTEmptyState renders icon, headline as heading, body, and primary action", async () => {
  let clicked = 0;
  const { fireEvent } = await import("@testing-library/react");
  render(wrap(
    <OTEmptyState
      icon={<span data-testid="icon">x</span>}
      headline="Nothing yet"
      body="Import a source to begin."
      action={{ label: "Import", onClick: () => { clicked += 1; } }}
    />
  ));
  assert.ok(screen.getByTestId("icon"));
  assert.ok(screen.getByRole("heading", { name: "Nothing yet" }));
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  assert.equal(clicked, 1);
});

test("OTCard renders aside without a title without rendering a spacer span", () => {
  render(wrap(<OTCard aside={<span data-testid="aside-only">3 items</span>}>body</OTCard>));
  assert.ok(screen.getByTestId("aside-only"));
  // No spurious empty span should appear before the aside.
  const card = screen.getByTestId("aside-only").closest("[class*='Card']") ?? document.body;
  assert.equal(card.querySelectorAll("span:empty").length, 0, "no empty span should be rendered as a spacer");
});

const { OTMetric, OTProgressBar, OTStatusBadge } = await import("../src/renderer/components/ot/index.js");

test("OTMetric renders label, value, optional delta with semantic color", () => {
  render(wrap(<OTMetric label="Cards due" value={12} delta={{ direction: "up", text: "+3 since yesterday" }} />));
  assert.ok(screen.getByText("Cards due"));
  assert.ok(screen.getByText("12"));
  const delta = screen.getByText("+3 since yesterday");
  assert.equal(delta.getAttribute("data-direction"), "up");
});

test("OTProgressBar uses 0..100 scale and exposes accessible value", () => {
  render(wrap(<OTProgressBar label="Mastery" value={42} />));
  const bar = screen.getByRole("progressbar", { name: "Mastery" });
  assert.equal(bar.getAttribute("aria-valuenow"), "42");
  assert.equal(bar.getAttribute("aria-valuemin"), "0");
  assert.equal(bar.getAttribute("aria-valuemax"), "100");
});

test("OTStatusBadge maps status to color and label", () => {
  const { rerender } = render(wrap(<OTStatusBadge status="ok" label="Healthy" />));
  assert.ok(screen.getByText("Healthy"));
  rerender(wrap(<OTStatusBadge status="error" label="Down" />));
  assert.ok(screen.getByText("Down"));
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
