import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface OpenTurboPaths {
  root: string;
  databasePath: string;
  storagePath: string;
  exportPath: string;
  audioPath: string;
}

export function createOpenTurboPaths(appDataPath: string): OpenTurboPaths {
  const root = join(appDataPath, "OpenTurbo.local");
  const storagePath = join(root, "files");
  const exportPath = join(root, "exports");
  const audioPath = join(root, "audio");

  for (const path of [root, storagePath, exportPath, audioPath]) {
    mkdirSync(path, { recursive: true });
  }

  return {
    root,
    databasePath: join(root, "openturbo.sqlite"),
    storagePath,
    exportPath,
    audioPath
  };
}
