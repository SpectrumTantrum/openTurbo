import { test as base, expect } from "@playwright/test";

/**
 * Browser-preview test fixture for OpenTurbo (Vite dev server + in-memory client).
 *
 * The workhorse here is `consoleErrors`: an auto fixture that records every
 * `console.error` and uncaught `pageerror` for the page, attaching them to the
 * test report. These objective signals (uncaught exceptions, React error-boundary
 * trips) are far more reliable bug indicators than guessed expected/actual
 * assertions — so specs SHOULD assert `expect(consoleErrors).toEqual([])` at
 * points where the page is expected to be clean.
 */

// Known-benign console noise to filter out (not app bugs).
const IGNORED_CONSOLE: RegExp[] = [
  /favicon\.ico/, // dev server serves no favicon → harmless 404 on every load
];

type Fixtures = {
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        errors.push(`console.error: ${text}`);
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

export { expect };
