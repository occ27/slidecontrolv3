const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let telaoWindow = null;
let retornoWindow = null;
let savedTelaoMonitorId = null;
let savedRetornoMonitorId = null;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1600, width),
    height: Math.min(960, height),
    minWidth: 1100,
    minHeight: 700,
    title: 'SlideControl V3 — Console Orbital de Produção',
    backgroundColor: '#030508',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (telaoWindow) telaoWindow.close();
    if (retornoWindow) retornoWindow.close();
  });
}

function openTelao(targetDisplay = null) {
  if (telaoWindow && !telaoWindow.isDestroyed()) {
    telaoWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  let finalDisplay = targetDisplay;

  if (!finalDisplay && savedTelaoMonitorId) {
    finalDisplay = displays.find(d => String(d.id) === String(savedTelaoMonitorId));
  }
  if (!finalDisplay) {
    // Busca monitor secundário (HDMI ou externo), senão usa o primário
    finalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];
  }

  // Se houver mais de um monitor e finalDisplay for o mesmo do operador, alerta o operador
  if (displays.length > 1 && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id)) {
      // Abre em janela menor para não cobrir totalmente os controles
      telaoWindow = new BrowserWindow({
        x: finalDisplay.bounds.x + 80,
        y: finalDisplay.bounds.y + 80,
        width: 1280,
        height: 720,
        title: 'SlideControl V3 — Telão de Projeção',
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      telaoWindow.loadFile(path.join(__dirname, 'frontend', 'display.html'));
      telaoWindow.on('closed', () => { telaoWindow = null; });
      return;
    }
  }

  // Projeção em tela cheia sem bordas no monitor dedicado
  telaoWindow = new BrowserWindow({
    x: finalDisplay.bounds.x,
    y: finalDisplay.bounds.y,
    width: finalDisplay.bounds.width,
    height: finalDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    title: 'SlideControl V3 — Telão de Projeção',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  telaoWindow.loadFile(path.join(__dirname, 'frontend', 'display.html'));

  telaoWindow.on('closed', () => {
    telaoWindow = null;
  });

  // Retorna foco para a janela do operador
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  }, 200);
}

function openRetorno(targetDisplay = null) {
  if (retornoWindow && !retornoWindow.isDestroyed()) {
    retornoWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  let finalDisplay = targetDisplay;

  if (!finalDisplay && savedRetornoMonitorId) {
    finalDisplay = displays.find(d => String(d.id) === String(savedRetornoMonitorId));
  }
  if (!finalDisplay) return;

  retornoWindow = new BrowserWindow({
    x: finalDisplay.bounds.x,
    y: finalDisplay.bounds.y,
    width: finalDisplay.bounds.width,
    height: finalDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    title: 'SlideControl V3 — Retorno do Palco',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  retornoWindow.loadFile(path.join(__dirname, 'frontend', 'display.html'));

  retornoWindow.on('closed', () => {
    retornoWindow = null;
  });
}

// ── IPC HANDLERS PARA GERENCIAMENTO NATIVO DE TELAS ──

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-screens', () => {
  let mainWindowId = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const b = mainWindow.getBounds();
    const d = screen.getDisplayMatching(b);
    if (d) mainWindowId = d.id;
  }

  return screen.getAllDisplays().map((d, idx) => ({
    id: d.id,
    index: idx + 1,
    bounds: d.bounds,
    primary: d.bounds.x === 0 && d.bounds.y === 0,
    isOperador: String(mainWindowId) === String(d.id),
    label: `Monitor ${idx + 1} (${d.bounds.width}x${d.bounds.height})`
  }));
});

ipcMain.handle('identify-screens', () => {
  const displays = screen.getAllDisplays();
  displays.forEach((d, index) => {
    let win = new BrowserWindow({
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(3, 5, 8, 0.75);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 8px solid #00f0ff;
            box-sizing: border-box;
            color: #ffffff;
          }
          .num {
            font-size: 22vw;
            font-weight: 800;
            color: #00f0ff;
            text-shadow: 0 0 50px rgba(0, 240, 255, 0.8);
            line-height: 1;
          }
          .desc {
            font-size: 2.2rem;
            font-weight: 600;
            color: #ffffff;
            margin-top: 10px;
            letter-spacing: 0.1em;
          }
        </style>
      </head>
      <body>
        <div class="num">${index + 1}</div>
        <div class="desc">MONITOR ${index + 1} • ${d.bounds.width}x${d.bounds.height}</div>
      </body>
      </html>
    `;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    setTimeout(() => {
      if (!win.isDestroyed()) win.close();
    }, 3000);
  });
});

ipcMain.handle('assign-screen', async (event, windowType, monitorId) => {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find(d => String(d.id) === String(monitorId)) || displays[0];

  if (windowType === 'telao') {
    savedTelaoMonitorId = monitorId;
    if (telaoWindow && !telaoWindow.isDestroyed()) {
      telaoWindow.setBounds({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height
      });
      telaoWindow.setFullScreen(true);
    } else {
      openTelao(targetDisplay);
    }
    return true;
  } else if (windowType === 'retorno') {
    savedRetornoMonitorId = monitorId;
    if (retornoWindow && !retornoWindow.isDestroyed()) {
      retornoWindow.setBounds({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height
      });
      retornoWindow.setFullScreen(true);
    } else {
      openRetorno(targetDisplay);
    }
    return true;
  }
});

ipcMain.handle('close-screen', (event, windowType) => {
  if (windowType === 'telao' && telaoWindow && !telaoWindow.isDestroyed()) {
    telaoWindow.close();
    telaoWindow = null;
  } else if (windowType === 'retorno' && retornoWindow && !retornoWindow.isDestroyed()) {
    retornoWindow.close();
    retornoWindow = null;
  }
});

ipcMain.handle('get-open-screens', () => {
  const open = [];
  if (telaoWindow && !telaoWindow.isDestroyed()) open.push('telao');
  if (retornoWindow && !retornoWindow.isDestroyed()) open.push('retorno');
  return open;
});

ipcMain.on('refocus-main-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
  }
});

ipcMain.on('fechar-app', () => {
  app.quit();
});

// Inicialização da Aplicação Electron
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
