const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const http = require("http");

const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";

// Fixed (not OS-assigned) so the resulting origin is stable across launches
// — the backend's CORS_ORIGIN is a single exact-match string (see
// backend/CLAUDE.md), so it needs one known value to allow. Set the
// backend's CORS_ORIGIN to `http://localhost:${PACKAGED_APP_PORT}` when
// running the packaged app (a different value than the `next dev` origin
// used by `npm run electron:dev`).
const PACKAGED_APP_PORT = 51247;
const PACKAGED_APP_URL = `http://localhost:${PACKAGED_APP_PORT}`;

let mainWindow = null;

function createWindow(url) {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Avenova",
    icon: path.join(__dirname, "../public/images/Avenova_logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);
}

// The packaged app has no Next/Node server at runtime — `next build` (with
// `output: "export"` in next.config.ts) produces static HTML/CSS/JS in
// `out/`, bundled alongside the app as an extraResource. Pages reference
// absolute `/_next/...` asset paths, so they need to be served over real
// HTTP — loading them via `file://` breaks those absolute paths and hits
// Chromium's CORS restrictions on the file protocol. This spins up a small
// local-only static file server (loopback, fixed port) instead.
//
// Binds the raw socket to 127.0.0.1 (loopback only, no LAN exposure) but the
// window always navigates to the `localhost` hostname, not the IP — the
// backend's refresh-token cookie is `Domain=localhost` (COOKIE_DOMAIN env,
// see frontend/CLAUDE.md's cookie-domain gotcha) and won't round-trip
// against a bare `127.0.0.1` origin.
function startStaticServer() {
  const serveHandler = require("serve-handler");
  const outDir = path.join(process.resourcesPath, "out");

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      serveHandler(req, res, { public: outDir, cleanUrls: true, trailingSlash: false });
    });
    server.on("error", reject);
    server.listen(PACKAGED_APP_PORT, "127.0.0.1", () => {
      resolve(PACKAGED_APP_URL);
    });
  });
}

// Without this, launching the packaged app twice would race two processes
// for the same fixed port instead of just focusing the existing window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const url = app.isPackaged ? await startStaticServer() : DEV_URL;

    createWindow(url);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
