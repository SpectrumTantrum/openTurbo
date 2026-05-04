import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { createOpenTurboPaths } from "./appPaths.js";
import { OpenTurboStore } from "./database.js";
import { registerIpc } from "./ipc.js";

let store: OpenTurboStore | undefined;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 760,
    title: "OpenTurbo",
    backgroundColor: "#f7f9fb",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(join(import.meta.dirname, "../../../dist-renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const paths = createOpenTurboPaths(app.getPath("userData"));
  store = new OpenTurboStore(paths);
  registerIpc(store);
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  store?.close();
});
