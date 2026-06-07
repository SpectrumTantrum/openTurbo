import { defineConfig, devices } from "@playwright/test";

// The renderer dev server. Vite uses strictPort:false, so if 5173 is taken it
// will pick another port — keep one shared `npm run dev` running and this URL
// matches it. `reuseExistingServer` means parallel workers share that one server.
const PORT = Number(process.env.OPENTURBO_E2E_PORT ?? 5173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The browser project parallelises freely. The electron project launches a
  // real desktop app per test with an isolated --user-data-dir, so it is safe
  // to parallelise too, but stays modest to avoid spawning many GUI windows.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "browser",
      testIgnore: ["**/electron/**"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
      },
    },
    {
      name: "electron",
      testMatch: ["**/electron/**/*.spec.ts"],
      // Electron specs launch the built app themselves (see fixtures/electron.ts);
      // they do not use baseURL or a browser context.
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
