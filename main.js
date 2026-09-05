const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let pythonProcess = null;
let isShuttingDown = false;
let telaoWindow = null;
let retornoWindow = null;
let savedTelaoMonitorId = null;
let savedRetornoMonitorId = null;
let telaoWasOpen = false;
let retornoWasOpen = false;
let startupWarningShown = false;

// ── PERSISTÊNCIA DE PREFERÊNCIAS (.data/preferences.json) ──
const prefsDir = path.join(__dirname, '.data');
const prefsFile = path.join(prefsDir, 'preferences.json');

function loadPrefs() {
  try {
    if (fs.existsSync(prefsFile)) {
      return JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
    }
  } catch (e) {
    console.error('[Prefs] Falha ao carregar preferences.json:', e);
  }
  return {};
}

function savePrefs(prefsToSave) {
  try {
    if (!fs.existsSync(prefsDir)) {
      fs.mkdirSync(prefsDir, { recursive: true });
    }
    fs.writeFileSync(prefsFile, JSON.stringify(prefsToSave, null, 4));
  } catch (e) {
    console.error('[Prefs] Falha ao salvar preferences.json:', e);
  }
}

ipcMain.on('get-pref', (event, key) => {
  const val = loadPrefs()[key];
  event.returnValue = val !== undefined ? val : null;
});

ipcMain.on('set-pref', (event, key, value) => {
  const currentPrefs = loadPrefs();
  currentPrefs[key] = value;
  savePrefs(currentPrefs);
});

ipcMain.on('remove-pref', (event, key) => {
  const currentPrefs = loadPrefs();
  delete currentPrefs[key];
  savePrefs(currentPrefs);
});

// ── PERSISTÊNCIA DO ESTADO DAS JANELAS (window-state.json) ──
function getStateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMax = mainWindow.isMaximized();
    const b = isMax ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    let state = {};
    const stateFile = getStateFilePath();
    try {
      if (fs.existsSync(stateFile)) {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      }
    } catch (e) {}

    state.bounds = b;
    state.isMaximized = isMax;
    state.telaoMonitorId = savedTelaoMonitorId;
    state.retornoMonitorId = savedRetornoMonitorId;
    state.telaoIsOpen = !!(telaoWindow && !telaoWindow.isDestroyed());
    state.retornoIsOpen = !!(retornoWindow && !retornoWindow.isDestroyed());

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[WindowState] Falha ao salvar estado das janelas:', e);
  }
}

// ── CRIAÇÃO DA JANELA PRINCIPAL (OPERADOR) ──
function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  let bounds = {
    x: Math.round((width - Math.min(1500, width)) / 2),
    y: Math.round((height - Math.min(920, height)) / 2),
    width: Math.min(1500, width),
    height: Math.min(920, height)
  };
  let isMaximized = false;

  // Restaurar preferências salvas em window-state.json
  const stateFile = getStateFilePath();
  try {
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (state.bounds && state.bounds.width && state.bounds.height) {
        bounds = state.bounds;
      }
      if (state.isMaximized !== undefined) isMaximized = state.isMaximized;
      if (state.telaoMonitorId !== undefined) savedTelaoMonitorId = state.telaoMonitorId;
      if (state.retornoMonitorId !== undefined) savedRetornoMonitorId = state.retornoMonitorId;
      if (state.telaoIsOpen !== undefined) telaoWasOpen = state.telaoIsOpen;
      if (state.retornoIsOpen !== undefined) retornoWasOpen = state.retornoIsOpen;
    }
  } catch (e) {
    console.error('[WindowState] Falha ao ler window-state.json:', e);
  }

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 650,
    title: 'SlideControl V3 — Console Orbital de Produção',
    backgroundColor: '#030508',
    autoHideMenuBar: true,
    closable: false,
    minimizable: true,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  // Salva dimensões sempre que a janela for movida, redimensionada ou maximizada
  mainWindow.on('resized', saveState);
  mainWindow.on('moved', saveState);
  mainWindow.on('maximize', saveState);
  mainWindow.on('unmaximize', saveState);
  mainWindow.on('close', (e) => {
    saveState();
    if (!isShuttingDown) {
      e.preventDefault();
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('show-quit-modal');
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (telaoWindow && !telaoWindow.isDestroyed()) telaoWindow.close();
    if (retornoWindow && !retornoWindow.isDestroyed()) retornoWindow.close();
  });
}

// ── ABERTURA E CONTROLE DO TELÃO ──
function openTelao(targetDisplay = null, isStartup = false) {
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
    finalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];
  }

  // Previne cobrir o operador na inicialização
  if (isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id)) {
      console.log('[Telão] Cancelando abertura automática para não cobrir a tela do Operador.');
      if (!startupWarningShown) {
        startupWarningShown = true;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Dica: Gerenciador de Telas',
          message: 'O sistema detectou que o Telão ou Retorno abriria por cima dos controles do Operador. Para evitar que a tela fique preta e bloqueie o uso, a abertura automática foi cancelada.\n\nComo resolver:\nPara abri-los em outro monitor (ou nesta tela manualmente), utilize o Gerenciador de Telas clicando no botão "🖥️ TELAS" na barra superior.',
          buttons: ['Entendi']
        });
      }
      return;
    }
  } else if (!isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    // Abertura manual na mesma tela do operador: redimensiona e centraliza a janela do operador
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id)) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
      mainWindow.setSize(1024, 650);
      mainWindow.center();
    }
  }

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
    saveState();
  });

  // Devolve o foco imediatamente para a janela principal para não prender inputs do operador
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
  }, 300);

  saveState();
}

// ── ABERTURA E CONTROLE DO RETORNO DE PALCO ──
function openRetorno(targetDisplay = null, isStartup = false) {
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

  // Previne cobrir o operador na inicialização
  if (isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id)) {
      console.log('[Retorno] Cancelando abertura automática para não cobrir a tela do Operador.');
      if (!startupWarningShown) {
        startupWarningShown = true;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Dica: Gerenciador de Telas',
          message: 'O sistema detectou que o Retorno abriria por cima dos controles do Operador. Para evitar que a tela fique preta e bloqueie o uso, a abertura automática foi cancelada.\n\nUtilize o Gerenciador de Telas para posicionar o Retorno no monitor desejado.',
          buttons: ['Entendi']
        });
      }
      return;
    }
  } else if (!isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id)) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
      mainWindow.setSize(1024, 650);
      mainWindow.center();
    }
  }

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

  retornoWindow.loadFile(path.join(__dirname, 'frontend', 'retorno.html'));

  retornoWindow.on('closed', () => {
    retornoWindow = null;
    saveState();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
  }, 300);

  saveState();
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
            background: rgba(3, 5, 8, 0.78);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 8px solid #00f0ff;
            box-sizing: border-box;
            color: #ffffff;
          }
          .num {
            font-size: 22vw;
            font-weight: 800;
            color: #00f0ff;
            text-shadow: 0 0 50px rgba(0, 240, 255, 0.85);
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
  const d = displays.find(disp => String(disp.id) === String(monitorId));
  if (!d) return false;

  if (windowType === 'telao') {
    savedTelaoMonitorId = monitorId;
    saveState();

    if (!telaoWindow || telaoWindow.isDestroyed()) {
      openTelao(d);
      return true;
    } else {
      telaoWindow.close();
      return new Promise(resolve => {
        setTimeout(() => {
          openTelao(d);
          resolve(true);
        }, 150);
      });
    }
  } else if (windowType === 'retorno') {
    savedRetornoMonitorId = monitorId;
    saveState();

    if (!retornoWindow || retornoWindow.isDestroyed()) {
      openRetorno(d);
      return true;
    } else {
      retornoWindow.close();
      return new Promise(resolve => {
        setTimeout(() => {
          openRetorno(d);
          resolve(true);
        }, 150);
      });
    }
  }
  return false;
});

ipcMain.handle('close-screen', (event, windowType) => {
  if (windowType === 'telao') {
    if (telaoWindow && !telaoWindow.isDestroyed()) {
      telaoWindow.close();
      telaoWindow = null;
    }
  } else if (windowType === 'retorno') {
    if (retornoWindow && !retornoWindow.isDestroyed()) {
      retornoWindow.close();
      retornoWindow = null;
    }
  }
  saveState();
  return true;
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
    mainWindow.webContents.focus();
  }
});

ipcMain.on('fechar-app', () => {
  isShuttingDown = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setClosable(true);
  }
  app.quit();
});

// ── INICIALIZAÇÃO DA APLICAÇÃO ELECTRON ──
app.whenReady().then(() => {
  startPythonBackend();
  createMainWindow();

  // Checagem pós-inicialização para restaurar telas salvas
  setTimeout(() => {
    if (telaoWasOpen) {
      openTelao(null, true);
    }
    if (savedRetornoMonitorId && retornoWasOpen) {
      openRetorno(null, true);
    }
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function startPythonBackend() {
  if (process.env.DEV_MODE === 'true') return;

  const backendScript = path.join(__dirname, 'run_backend.py');
  if (!fs.existsSync(backendScript)) return;

  console.log('[PyBackend] Iniciando backend Python...');
  if (app.isPackaged) {
    const backendExe = process.platform === 'win32' ? 'backend.exe' : 'backend';
    const backendPath = path.join(process.resourcesPath, 'backend', backendExe);
    if (process.platform !== 'win32' && fs.existsSync(backendPath)) {
      fs.chmodSync(backendPath, '755');
    }
    pythonProcess = spawn(backendPath, [], { cwd: path.join(process.resourcesPath, 'backend') });
  } else {
    const isWin = process.platform === 'win32';
    const pythonPath = isWin 
      ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
      : path.join(__dirname, 'venv', 'bin', 'python');
    const exe = fs.existsSync(pythonPath) ? pythonPath : 'python3';
    pythonProcess = spawn(exe, ['run_backend.py'], { cwd: __dirname });
  }

  pythonProcess.stdout?.on('data', (d) => console.log(`[Py]: ${d}`));
  pythonProcess.stderr?.on('data', (d) => console.error(`[PyErr]: ${d}`));
}

app.on('before-quit', (e) => {
  if (!isShuttingDown) {
    e.preventDefault();
    isShuttingDown = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setClosable(true);
    }

    // Fecha todas as janelas imediatamente
    if (telaoWindow && !telaoWindow.isDestroyed()) telaoWindow.close();
    if (retornoWindow && !retornoWindow.isDestroyed()) retornoWindow.close();

    // Notifica backend Python para encerramento gracioso
    http.get('http://127.0.0.1:8767/api/system/shutdown').on('error', () => {});
    http.get('http://127.0.0.1:8769/api/system/shutdown').on('error', () => {});

    if (pythonProcess) {
      try {
        pythonProcess.kill('SIGTERM');
      } catch (err) {}
    }

    setTimeout(() => {
      app.quit();
    }, 200);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('quit', () => {
  if (pythonProcess) {
    try {
      pythonProcess.kill('SIGKILL');
    } catch (err) {}
  }
});
