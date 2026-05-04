import type { SyncStatus } from "../shared/types.js";

export interface SyncEnvelope {
  id: string;
  workspaceId: string;
  deviceId: string;
  ciphertext: string;
  updatedAt: string;
}

export class OptionalSyncClient {
  constructor(
    private serverUrl: string,
    private deviceId: string
  ) {}

  status(): SyncStatus {
    return {
      enabled: this.serverUrl.trim().length > 0,
      serverUrl: this.serverUrl,
      deviceId: this.deviceId,
      state: this.serverUrl ? "offline" : "offline",
      message: this.serverUrl ? "Sync server configured. Manual sync is available." : "Local-only mode."
    };
  }

  async register(name = "OpenTurbo Desktop"): Promise<{ deviceId: string; token: string }> {
    const response = await fetch(`${this.serverUrl.replace(/\/$/, "")}/devices/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: this.deviceId, name })
    });
    if (!response.ok) {
      throw new Error(`Sync registration failed with ${response.status}.`);
    }
    return (await response.json()) as { deviceId: string; token: string };
  }

  async push(workspaceId: string, envelope: string): Promise<{ accepted: boolean; cursor: number }> {
    const response = await fetch(`${this.serverUrl.replace(/\/$/, "")}/sync/push`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": this.deviceId },
      body: JSON.stringify({ workspaceId, envelope })
    });
    if (!response.ok) {
      throw new Error(`Sync push failed with ${response.status}.`);
    }
    return (await response.json()) as { accepted: boolean; cursor: number };
  }

  async pull(workspaceId: string, cursor = 0): Promise<{ cursor: number; envelopes: SyncEnvelope[] }> {
    const url = new URL(`${this.serverUrl.replace(/\/$/, "")}/sync/pull`);
    url.searchParams.set("workspaceId", workspaceId);
    url.searchParams.set("cursor", String(cursor));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sync pull failed with ${response.status}.`);
    }
    return (await response.json()) as { cursor: number; envelopes: SyncEnvelope[] };
  }
}
