import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { StudyPlanCard, ReviewQueueCard } = await import("../src/renderer/components/study/index.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("StudyPlanCard renders ordered steps and fires onStartStep", () => {
  const started: string[] = [];
  render(wrap(
    <StudyPlanCard
      title="Today's review plan"
      steps={[
        { id: "s1", label: "Review 12 due cards", durationLabel: "20 min" },
        { id: "s2", label: "Drill weak areas", durationLabel: "15 min" }
      ]}
      onStartStep={(id) => started.push(id)}
    />
  ));
  assert.ok(screen.getByText("Today's review plan"));
  assert.ok(screen.getByText("Review 12 due cards"));
  fireEvent.click(screen.getByRole("button", { name: "Start: Review 12 due cards" }));
  assert.deepEqual(started, ["s1"]);
});

test("ReviewQueueCard renders due count, lists upcoming cards, fires onOpenReview", () => {
  let opened = 0;
  render(wrap(
    <ReviewQueueCard
      dueCount={5}
      preview={[
        { cardId: "c1", front: "Define mitosis" },
        { cardId: "c2", front: "Phases of cell cycle" }
      ]}
      onOpenReview={() => { opened += 1; }}
    />
  ));
  assert.ok(screen.getByText("5"));
  assert.ok(screen.getByText("Define mitosis"));
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(opened, 1);
});

const { WeakAreasCard, PackProgressCard } = await import("../src/renderer/components/study/index.js");

test("WeakAreasCard renders ranked items and fires onFocusArea", () => {
  let focused: string | null = null;
  render(wrap(
    <WeakAreasCard
      areas={[
        { id: "a1", label: "Membrane transport", score: 0.32 },
        { id: "a2", label: "Cell cycle", score: 0.55 }
      ]}
      onFocusArea={(id) => { focused = id; }}
    />
  ));
  assert.ok(screen.getByText("Membrane transport"));
  fireEvent.click(screen.getByRole("button", { name: "Focus on Membrane transport" }));
  assert.equal(focused, "a1");
});

test("WeakAreasCard renders empty state when areas is empty", () => {
  render(wrap(<WeakAreasCard areas={[]} onFocusArea={() => undefined} />));
  assert.ok(screen.getByText(/no weak areas/i));
});

test("PackProgressCard shows mastery and counts, fires onOpenPack", () => {
  let opened = 0;
  render(wrap(
    <PackProgressCard
      packId="pack_1"
      title="Cellular Biology Study Pack"
      mastery={68}
      cardsTotal={24}
      cardsDue={6}
      onOpenPack={() => { opened += 1; }}
    />
  ));
  assert.ok(screen.getByText("Cellular Biology Study Pack"));
  assert.ok(screen.getByText("68"));
  fireEvent.click(screen.getByRole("button", { name: "Open pack: Cellular Biology Study Pack" }));
  assert.equal(opened, 1);
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
