import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { useDashboardActions } = await import("../src/renderer/dashboard/useDashboardActions.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const fakeClient = {
  generate: async () => ({
    id: "pack_new", sourceId: "src_1", title: "New", summary: "",
    sections: [], flashcards: [], quiz: [],
    mindMap: { id: "r", label: "r", children: [] },
    podcastScript: "", mastery: 0, createdAt: "", updatedAt: ""
  }),
  exportPack: async () => "preview://pack.json",
  updateSettings: async (patch: { syncServerUrl?: string }) => ({
    syncServerUrl: patch.syncServerUrl ?? "", privacyMode: true,
    dataPath: "", fileStoragePath: "", outputLanguage: "English", providers: []
  }),
  // unused stubs to satisfy OpenTurboClient shape
  snapshot: async () => { throw new Error("not used"); },
  importText: async () => { throw new Error("not used"); },
  chat: async () => { throw new Error("not used"); },
  review: async () => { throw new Error("not used"); },
  providerHealth: async () => { return []; },
  testProvider: async () => { return { kind: "mock" as const, label: "x", ok: true, message: "", models: [] }; }
};

test.afterEach(() => cleanup());

test("mutating action shows confirmation modal; confirm calls the client; cancel does not", async () => {
  let didGenerate = false;
  const client = {
    ...fakeClient,
    async generate(input: { sourceId: string; outputs: string[] }) {
      didGenerate = true;
      return await fakeClient.generate();
    }
  };

  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: true,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("generate-pack", ["notes"])}>fire</button>
      </>
    );
  }

  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.ok(await screen.findByText("Generate study material?"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(didGenerate, false);

  fireEvent.click(screen.getByText("fire"));
  await screen.findByText("Generate study material?");
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(didGenerate, true);
});

test("blocked action emits an inline alert and never calls the client", () => {
  let didCall = false;
  const client = {
    ...fakeClient,
    async generate() { didCall = true; return await fakeClient.generate(); }
  };
  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: true,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("delete-source", "src_1")}>fire</button>
        {actions.lastError && <p data-testid="err">{actions.lastError}</p>}
      </>
    );
  }
  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.match(screen.getByTestId("err").textContent ?? "", /not exposed|blocked/i);
  assert.equal(didCall, false);
});

test("dispatch refuses mutating action when provider is not ready", async () => {
  let didCall = false;
  const client = { ...fakeClient, async generate() { didCall = true; return await fakeClient.generate(); } };
  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: false,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("generate-pack", ["notes"])}>fire</button>
        {actions.lastError && <p data-testid="err">{actions.lastError}</p>}
      </>
    );
  }
  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.match(screen.getByTestId("err").textContent ?? "", /provider/i);
  assert.equal(didCall, false);
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
