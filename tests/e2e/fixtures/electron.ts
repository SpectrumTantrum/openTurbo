import {
  test as base,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Electron E2E fixture for OpenTurbo.
 *
 * Launches the built desktop app (package.json "main" → dist/src/main/main.js)
 * with an isolated `--user-data-dir` per test, so the real SQLite database,
 * exports, and file storage land in a throwaway temp dir and never collide
 * with another test or the developer's real app data
 * (main.ts derives all paths from app.getPath("userData")).
 *
 * Requires a fresh `npm run build` first (the renderer bundle in dist-renderer/
 * must be current).
 */

type ElectronFixtures = {
  userDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
  consoleErrors: string[];
};

export const test = base.extend<ElectronFixtures>({
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), "ot-e2e-"));
    await use(dir);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  },

  electronApp: async ({ userDataDir }, use) => {
    const app = await electron.launch({
      args: [".", `--user-data-dir=${userDataDir}`],
    });
    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await use(window);
  },

  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        errors.push(`pageerror: ${err.stack ?? err.message}`);
      });
      await use(errors);
      if (errors.length > 0) {
        await testInfo.attach("console-errors.txt", {
          body: errors.join("\n\n"),
          contentType: "text/plain",
        });
      }
    },
    { auto: true },
  ],
});

/**
 * Run code in the Electron MAIN process (Node context) — e.g. to read the real
 * userData path, assert a file was written to disk, or inspect app state.
 */
export async function inMain<T>(
  app: ElectronApplication,
  fn: (electronModule: typeof import("electron")) => T | Promise<T>,
): Promise<T> {
  return app.evaluate(fn);
}

export { expect };
