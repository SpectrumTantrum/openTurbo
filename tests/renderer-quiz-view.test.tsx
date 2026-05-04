import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { MantineProvider } from "@mantine/core";
import type { StudyPack } from "../src/shared/types.js";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { userEvent } = await import("@testing-library/user-event");
const { QuizView } = await import("../src/renderer/QuizView.js");

test.afterEach(() => {
  cleanup();
});

test("QuizView lets users answer, see feedback, update progress, and reset", async () => {
  const user = userEvent.setup();

  render(
    <MantineProvider>
      <QuizView pack={samplePack()} />
    </MantineProvider>
  );

  const reset = screen.getByRole("button", { name: "Reset" });
  assert.equal(reset.hasAttribute("disabled"), true);
  assert.equal(screen.getByText("0 of 2 answered · 0 correct").textContent, "0 of 2 answered · 0 correct");
  assert.equal(screen.queryByText("Respiration breaks down glucose to release energy."), null);

  await user.click(screen.getByRole("button", { name: "Respiration" }));
  assert.equal(screen.getByText("1 of 2 answered · 1 correct").textContent, "1 of 2 answered · 1 correct");
  assert.equal(screen.getByText("Correct").textContent, "Correct");
  assert.equal(screen.getByText("Respiration breaks down glucose to release energy.").textContent, "Respiration breaks down glucose to release energy.");
  assert.equal(screen.getByRole("button", { name: /Respiration/ }).getAttribute("aria-pressed"), "true");

  await user.click(screen.getByRole("button", { name: "Photosynthesis" }));
  assert.equal(screen.getByText("1 of 2 answered · 0 correct").textContent, "1 of 2 answered · 0 correct");
  assert.equal(screen.getByText("Review").textContent, "Review");

  await user.click(reset);
  assert.equal(screen.getByText("0 of 2 answered · 0 correct").textContent, "0 of 2 answered · 0 correct");
  assert.equal(screen.queryByText("Respiration breaks down glucose to release energy."), null);
});

function setupDom(): void {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1/" });

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Element: { configurable: true, value: dom.window.Element },
    Node: { configurable: true, value: dom.window.Node },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
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

function samplePack(): StudyPack {
  return {
    id: "pack-quiz",
    sourceId: "source-1",
    title: "Cell biology",
    summary: "Respiration and cells",
    sections: [],
    flashcards: [],
    quiz: [
      {
        id: "quiz-1",
        prompt: "Which process releases energy from glucose?",
        choices: ["Photosynthesis", "Respiration", "Osmosis"],
        answerIndex: 1,
        explanation: "Respiration breaks down glucose to release energy.",
        citations: []
      },
      {
        id: "quiz-2",
        prompt: "Which organelle controls the cell?",
        choices: ["Nucleus", "Mitochondria", "Ribosome"],
        answerIndex: 0,
        explanation: "The nucleus contains genetic instructions.",
        citations: []
      }
    ],
    mindMap: { id: "root", label: "Root", children: [] },
    podcastScript: "",
    mastery: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  };
}
