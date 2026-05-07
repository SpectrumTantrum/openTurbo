import { useEffect, useState } from "react";
import { validatePayload, type A2UIPayload } from "../a2ui/catalog.js";

export interface A2UITransport {
  subscribe: (cb: (payload: A2UIPayload) => void) => () => void;
  send: (prompt: string) => Promise<void>;
}

export interface UseA2UIRuntimeOptions {
  onAction: (actionId: string, args?: unknown) => void;
  transport?: A2UITransport;
}

export interface UseA2UIRuntimeResult {
  payloads: A2UIPayload[];
  agentAvailable: boolean;
  sendPrompt: (text: string) => Promise<void>;
}

export function useA2UIRuntime({ onAction: _onAction, transport }: UseA2UIRuntimeOptions): UseA2UIRuntimeResult {
  const [payloads, setPayloads] = useState<A2UIPayload[]>([]);

  useEffect(() => {
    if (!transport) return;
    const unsubscribe = transport.subscribe((payload) => {
      try {
        validatePayload(payload);
        setPayloads((prev) => [...prev, payload]);
      } catch {
        // Drop invalid payloads silently — for live mode the dashboard prefers
        // hiding garbage to surfacing an error per agent message.
      }
    });
    return unsubscribe;
  }, [transport]);

  async function sendPrompt(text: string) {
    if (!transport) return;
    await transport.send(text);
  }

  return {
    payloads,
    agentAvailable: Boolean(transport),
    sendPrompt
  };
}
