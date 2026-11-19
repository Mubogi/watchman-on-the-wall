/**
 * Electron entry point for the desktop builds (Windows / Linux).
 *
 * The game is a self-contained web app, so the shell only needs to load it in
 * a hardened BrowserWindow. Node integration stays off and navigation is
 * confined to the bundled files.
 */
const { app, BrowserWindow, Menu, shell, protocol, net } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { resolveAssetPath } = require("./asset-path");

const WWW = path.join(__dirname, "www");
const APP_URL = "app://bundle/index.html";

// The game loads its code as ES modules, which Chromium refuses to fetch over
// file:// (module scripts are subject to CORS). Serving the bundle from a
// privileged custom scheme keeps the modules loading exactly as on the web.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let win = null;

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const target = resolveAssetPath(WWW, pathname);
    if (!target) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#070a14",
    title: "Watchman on the Wall",
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "www", "assets", "icons", "icon-512.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadURL(APP_URL);

  // Avoid a white flash while the canvas paints its first frame.
  win.once("ready-to-show", () => win.show());

  // Keep the game inside the app; send any external link to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("app://")) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    win = null;
  });
}

// F11 toggles fullscreen, F12 opens devtools — handy for a game window.
function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Game",
        submenu: [
          { role: "togglefullscreen", accelerator: "F11" },
          { role: "reload" },
          { role: "toggleDevTools", accelerator: "F12" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "View",
        submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }],
      },
    ])
  );
}

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
