import test from "node:test";
import assert from "node:assert/strict";
import { createProvider, defaultProviders } from "../src/main/providers.js";

test("defaultProviders includes local and BYOK providers", () => {
  const providers = defaultProviders();
  assert.ok(providers.some((provider) => provider.kind === "ollama"));
  assert.ok(providers.some((provider) => provider.kind === "openai"));
  assert.ok(providers.some((provider) => provider.kind === "openrouter"));
});

test("mock provider supports all capability methods", async () => {
  const provider = createProvider(defaultProviders()[0]);
  const health = await provider.health();
  const chat = await provider.chat({ messages: [{ role: "user", content: "Explain mitosis" }] });
  const embeddings = await provider.embeddings(["cell"]);
  const transcript = await provider.transcription("lecture.mp3");
  const audio = await provider.tts("hello");

  assert.equal(health.ok, true);
  assert.match(chat, /mitosis/i);
  assert.equal(embeddings.length, 1);
  assert.match(transcript, /lecture.mp3/);
  assert.ok(audio.length > 0);
});
