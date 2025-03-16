const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;
const iconPath = "./Fluxion/Icon/Fluxion_icon.ico";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("ignore-gpu-blacklist");

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      icon: iconPath,
      width: 1280,
      height: 720,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        devTools: true, // IMPORTANT: Disable dev tools in production
        spellcheck: false,
        accessibleTitle: false,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    mainWindow.setMenuBarVisibility(true);
    mainWindow.setTitle("Fluxion"); // Title for the game window TODO: properly pass the setTitle function to the game framework

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    mainWindow.loadFile("./Examples/Character/index.html");
  });

  ipcMain.on("set-title", (event, title) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    win.setTitle(title);
  });
} 