import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type OpenTurboClient } from "../src/renderer/data/client.js";
import type { ProviderHealth } from "../src/main/providers.js";

test("createClient forwards the electron testProvider API when available", async () => {
  let forwardedProviderId = "";
  const electronClient = stubClient({
    async testProvider(providerId: string): Promise<ProviderHealth> {
      forwardedProviderId = providerId;
      return {
        kind: "mock",
        label: providerId,
        ok: true,
        message: "Provider test passed.",
        models: ["offline-template"]
      };
    }
  });

  withWindow({ openTurbo: electronClient });

  const client = createClient();
  const result = await client.testProvider("mock-local");

  assert.equal(forwardedProviderId, "mock-local");
  assert.deepEqual(result, {
    kind: "mock",
    label: "mock-local",
    ok: true,
    message: "Provider test passed.",
    models: ["offline-template"]
  });
});

test("electron testProvider missing-provider rejection returns a failed health result", async () => {
  const electronClient = stubClient({
    async testProvider(): Promise<ProviderHealth> {
      throw new Error("Provider missing-provider was not found.");
    }
  });

  withWindow({ openTurbo: electronClient });

  const result = await createClient().testProvider("missing-provider");

  assert.deepEqual(result, {
    kind: "mock",
    label: "missing-provider",
    ok: false,
    message: "Provider missing-provider was not found.",
    models: []
  });
});

test("electron testProvider integration failures reject", async () => {
  const electronClient = stubClient({
    async testProvider(): Promise<ProviderHealth> {
      throw new Error("No handler registered for openturbo:providers:test");
    }
  });

  withWindow({ openTurbo: electronClient });

  await assert.rejects(
    () => createClient().testProvider("mock-local"),
    /No handler registered for openturbo:providers:test/
  );
});

test("browser preview providerHealth returns deterministic local results without window", async () => {
  clearWindow();

  const client = createClient();
  const first = await client.providerHealth();
  const second = await client.providerHealth();

  assert.deepEqual(second, first);
  assert.deepEqual(first, [
    {
      kind: "mock",
      label: "Mock Local Generator",
      ok: true,
      message: "Offline template generator is ready.",
      models: ["offline-template"]
    },
    {
      kind: "ollama",
      label: "Ollama",
      ok: false,
      message: "Provider checks are simulated in browser preview.",
      models: ["llama3.1"]
    },
    {
      kind: "lmstudio",
      label: "LM Studio",
      ok: false,
      message: "Provider checks are simulated in browser preview.",
      models: ["local-model"]
    },
    {
      kind: "openai-compatible",
      label: "OpenAI-compatible endpoint",
      ok: false,
      message: "Provider is disabled in browser preview.",
      models: ["model"]
    }
  ]);
});

test("browser preview testProvider returns deterministic results for known and missing providers", async () => {
  clearWindow();

  const client = createClient();
  const known = await client.testProvider("mock-local");
  const missing = await client.testProvider("missing-provider");

  assert.deepEqual(known, {
    kind: "mock",
    label: "Mock Local Generator",
    ok: true,
    message: "Offline template generator is ready.",
    models: ["offline-template"]
  });
  assert.deepEqual(missing, {
    kind: "mock",
    label: "missing-provider",
    ok: false,
    message: "Provider missing-provider was not found in browser preview.",
    models: []
  });
});

function stubClient(patch: Partial<OpenTurboClient>): OpenTurboClient {
  return {
    async snapshot() {
      throw new Error("Not implemented.");
    },
    async updateSettings() {
      throw new Error("Not implemented.");
    },
    async importText() {
      throw new Error("Not implemented.");
    },
    async generate() {
      throw new Error("Not implemented.");
    },
    async chat() {
      throw new Error("Not implemented.");
    },
    async review() {
      throw new Error("Not implemented.");
    },
    async exportPack() {
      throw new Error("Not implemented.");
    },
    async providerHealth() {
      return [];
    },
    async testProvider() {
      throw new Error("Not implemented.");
    },
    ...patch
  };
}

function withWindow(value: unknown): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value
  });
}

function clearWindow(): void {
  Reflect.deleteProperty(globalThis, "window");
}
