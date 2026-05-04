import type { ProviderConfig, ProviderKind } from "../shared/types.js";

export interface ProviderHealth {
  kind: ProviderKind;
  label: string;
  ok: boolean;
  message: string;
  models: string[];
}

export interface ChatRequest {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}

export interface StructuredJsonRequest<T> extends ChatRequest {
  schemaName: string;
  fallback: T;
}

export interface AiProvider {
  config: ProviderConfig;
  health(): Promise<ProviderHealth>;
  chat(request: ChatRequest): Promise<string>;
  structuredJson<T>(request: StructuredJsonRequest<T>): Promise<T>;
  embeddings(input: string[]): Promise<number[][]>;
  transcription(filePath: string): Promise<string>;
  tts(text: string): Promise<Uint8Array>;
}

export function defaultProviders(): ProviderConfig[] {
  return [
    {
      id: "mock-local",
      kind: "mock",
      label: "Mock Local Generator",
      enabled: true,
      isDefault: true,
      chatModel: "offline-template"
    },
    {
      id: "ollama",
      kind: "ollama",
      label: "Ollama",
      baseUrl: "http://127.0.0.1:11434",
      enabled: true,
      isDefault: false,
      chatModel: "llama3.1",
      embeddingModel: "nomic-embed-text"
    },
    {
      id: "lmstudio",
      kind: "lmstudio",
      label: "LM Studio",
      baseUrl: "http://127.0.0.1:1234/v1",
      enabled: true,
      isDefault: false,
      chatModel: "local-model"
    },
    {
      id: "openai-compatible",
      kind: "openai-compatible",
      label: "OpenAI-compatible endpoint",
      baseUrl: "http://127.0.0.1:8000/v1",
      enabled: false,
      isDefault: false,
      chatModel: "model"
    },
    {
      id: "openai",
      kind: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      enabled: false,
      isDefault: false,
      chatModel: "gpt-4.1-mini",
      embeddingModel: "text-embedding-3-small",
      transcriptionModel: "whisper-1",
      ttsModel: "gpt-4o-mini-tts"
    },
    {
      id: "anthropic",
      kind: "anthropic",
      label: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      enabled: false,
      isDefault: false,
      chatModel: "claude-3-5-haiku-latest"
    },
    {
      id: "gemini",
      kind: "gemini",
      label: "Gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      enabled: false,
      isDefault: false,
      chatModel: "gemini-1.5-flash"
    },
    {
      id: "groq",
      kind: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      enabled: false,
      isDefault: false,
      chatModel: "llama-3.1-8b-instant"
    },
    {
      id: "openrouter",
      kind: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      enabled: false,
      isDefault: false,
      chatModel: "openai/gpt-4o-mini"
    }
  ];
}

export function createProvider(config: ProviderConfig): AiProvider {
  if (config.kind === "mock") {
    return new MockProvider(config);
  }

  if (config.kind === "ollama") {
    return new OllamaProvider(config);
  }

  return new OpenAiCompatibleProvider(config);
}

export async function detectLocalRuntimes(configs: ProviderConfig[]): Promise<ProviderHealth[]> {
  const runtimeConfigs = configs.filter((config) => ["mock", "ollama", "lmstudio", "openai-compatible"].includes(config.kind));
  return Promise.all(runtimeConfigs.map((config) => createProvider(config).health()));
}

class MockProvider implements AiProvider {
  constructor(public config: ProviderConfig) {}

  async health(): Promise<ProviderHealth> {
    return {
      kind: this.config.kind,
      label: this.config.label,
      ok: true,
      message: "Offline template generator is ready.",
      models: ["offline-template"]
    };
  }

  async chat(request: ChatRequest): Promise<string> {
    const latest = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "your study material";
    return `OpenTurbo local draft: ${latest.slice(0, 240)}`;
  }

  async structuredJson<T>(request: StructuredJsonRequest<T>): Promise<T> {
    return request.fallback;
  }

  async embeddings(input: string[]): Promise<number[][]> {
    return input.map((text) => Array.from({ length: 16 }, (_, index) => ((text.charCodeAt(index % Math.max(text.length, 1)) || 1) % 97) / 97));
  }

  async transcription(filePath: string): Promise<string> {
    return `Transcription placeholder for ${filePath}. Configure Whisper, Ollama-compatible audio, or another provider to generate real transcripts.`;
  }

  async tts(text: string): Promise<Uint8Array> {
    return new TextEncoder().encode(text);
  }
}

class OllamaProvider extends MockProvider {
  async health(): Promise<ProviderHealth> {
    const baseUrl = this.config.baseUrl ?? "http://127.0.0.1:11434";
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1200) });
      if (!response.ok) {
        return { kind: this.config.kind, label: this.config.label, ok: false, message: `Ollama returned ${response.status}.`, models: [] };
      }
      const body = (await response.json()) as { models?: Array<{ name: string }> };
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: true,
        message: "Ollama is reachable.",
        models: body.models?.map((model) => model.name) ?? []
      };
    } catch (error) {
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: false,
        message: error instanceof Error ? error.message : "Ollama is not reachable.",
        models: []
      };
    }
  }
}

class OpenAiCompatibleProvider extends MockProvider {
  async health(): Promise<ProviderHealth> {
    if (!this.config.enabled) {
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: false,
        message: "Provider is configured but disabled.",
        models: []
      };
    }

    if (!this.config.baseUrl) {
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: false,
        message: "Add a base URL before using this provider.",
        models: []
      };
    }

    try {
      const headers = this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : undefined;
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, { headers, signal: AbortSignal.timeout(1500) });
      if (!response.ok) {
        return { kind: this.config.kind, label: this.config.label, ok: false, message: `Provider returned ${response.status}.`, models: [] };
      }
      const body = (await response.json()) as { data?: Array<{ id: string }> };
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: true,
        message: "Provider is reachable.",
        models: body.data?.map((model) => model.id) ?? []
      };
    } catch (error) {
      return {
        kind: this.config.kind,
        label: this.config.label,
        ok: false,
        message: error instanceof Error ? error.message : "Provider is not reachable.",
        models: []
      };
    }
  }
}
