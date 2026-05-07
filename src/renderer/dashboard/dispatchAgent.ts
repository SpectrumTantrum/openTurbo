import { samplePayloadFor, type DashboardLayout } from "../a2ui/samplePayloads.js";
import type { StaticOverviewSnapshotHints } from "./StaticOverview.js";

export interface AgentDispatcher {
  dispatch: (prompt: string) => Promise<DashboardLayout>;
}

export function createStubDispatcher(snapshotHints: StaticOverviewSnapshotHints): AgentDispatcher {
  return {
    async dispatch(prompt) {
      return samplePayloadFor(prompt, snapshotHints);
    }
  };
}
