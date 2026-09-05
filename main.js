const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let mainWindow = null;
let telaoWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    title: 'SlideControl V3 — Console Orbital de Produção',
    backgroundColor: '#05070c',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (telaoWindow) {
      telaoWindow.close();
    }
  });
}

function openTelaoWindow() {
  if (telaoWindow) {
    telaoWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  // If there's an external monitor, use the second one, otherwise place on primary
  const externalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];

  telaoWindow = new BrowserWindow({
    x: externalDisplay.bounds.x + 50,
    y: externalDisplay.bounds.y + 50,
    width: 1280,
    height: 720,
    title: 'SlideControl V3 — Telão de Projeção',
    backgroundColor: '#000000',
    fullscreen: displays.length > 1, // Auto-fullscreen on secondary screen
    frame: displays.length <= 1,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  telaoWindow.loadFile(path.join(__dirname, 'frontend', 'display.html'));

  telaoWindow.on('closed', () => {
    telaoWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
