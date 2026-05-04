/// <reference types="vite/client" />

import type { OpenTurboApi } from "../main/preload.js";

declare global {
  interface Window {
    openTurbo?: OpenTurboApi;
  }
}
