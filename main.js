const { app, BrowserWindow, screen, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let pythonProcess = null;
let isShuttingDown = false;
let isReassigningScreen = false;
let telaoWindow = null;
let retornoWindow = null;
let savedTelaoMonitorId = null;
let savedRetornoMonitorId = null;
let savedTelaoBounds = null;
let savedRetornoBounds = null;
let savedTelaoDisplayIndex = null;
let savedRetornoDisplayIndex = null;
let telaoWasOpen = true; // Por padrão true (igual V2) para abrir automaticamente no monitor salvo
let retornoWasOpen = false;
let startupWarningShown = false;
const PORT = 8767;

const isDev = process.env.DEV_MODE === "true";

if (isDev) {
  const electronBin = process.platform === "win32"
    ? path.join(__dirname, "node_modules", "electron", "dist", "electron.exe")
    : path.join(__dirname, "node_modules", ".bin", "electron");

  if (fs.existsSync(electronBin)) {
    try {
      require("electron-reload")([
        path.join(__dirname, "main.js"),
        path.join(__dirname, "preload.js"),
        path.join(__dirname, "frontend")
      ], {
        electron: electronBin,
        hardResetMethod: "exit",
        ignored: /node_modules|[\/\\]\.|venv|dist|build|build_secure|__pycache__|\.db|\.sqlite|\.data|api|presets|uploads|media|transcriptions|\.git|\.vscode/
      });
    } catch (e) {
      console.warn("electron-reload warning:", e);
    }
  }
}


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
    state.telaoBounds = savedTelaoBounds;
    state.retornoBounds = savedRetornoBounds;
    state.telaoDisplayIndex = savedTelaoDisplayIndex;
    state.retornoDisplayIndex = savedRetornoDisplayIndex;

    // Se as janelas estiverem vivas, salvar como abertas.
    // Se estiver em processo de desligamento ou reatribuição, manter o último estado telaoWasOpen / retornoWasOpen
    // (só vira false quando o operador fecha expressamente pelo botão 'X' no Gerenciador de Telas).
    if (telaoWindow && !telaoWindow.isDestroyed()) {
      state.telaoIsOpen = true;
      telaoWasOpen = true;
    } else if (isShuttingDown || isReassigningScreen) {
      state.telaoIsOpen = !!telaoWasOpen;
    } else {
      state.telaoIsOpen = !!telaoWasOpen;
    }

    if (retornoWindow && !retornoWindow.isDestroyed()) {
      state.retornoIsOpen = true;
      retornoWasOpen = true;
    } else if (isShuttingDown || isReassigningScreen) {
      state.retornoIsOpen = !!retornoWasOpen;
    } else {
      state.retornoIsOpen = !!retornoWasOpen;
    }

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

    // Sincronizar também no preferences.json para redundância e consumo instantâneo no frontend
    const currentPrefs = loadPrefs();
    let prefsChanged = false;
    if (savedTelaoMonitorId !== null && currentPrefs.slideState_monitor_telao !== savedTelaoMonitorId) {
      currentPrefs.slideState_monitor_telao = savedTelaoMonitorId;
      prefsChanged = true;
    }
    if (savedRetornoMonitorId !== null && currentPrefs.slideState_monitor_retorno !== savedRetornoMonitorId) {
      currentPrefs.slideState_monitor_retorno = savedRetornoMonitorId;
      prefsChanged = true;
    }
    if (currentPrefs.slideState_telao_is_open !== state.telaoIsOpen) {
      currentPrefs.slideState_telao_is_open = state.telaoIsOpen;
      prefsChanged = true;
    }
    if (currentPrefs.slideState_retorno_is_open !== state.retornoIsOpen) {
      currentPrefs.slideState_retorno_is_open = state.retornoIsOpen;
      prefsChanged = true;
    }
    if (prefsChanged) {
      savePrefs(currentPrefs);
    }
  } catch (e) {
    console.error('[WindowState] Falha ao salvar estado das janelas:', e);
  }
}

// ── LOCALIZADOR INTELIGENTE DE DISPLAY (RESISTENTE A TROCA DE ID NO MAC/WINDOWS) ──
function findTargetDisplay(savedId, savedBounds, savedIndex) {
  const displays = screen.getAllDisplays();
  if (!displays || displays.length === 0) return null;

  // 1. Tentar por ID exato
  if (savedId !== null && savedId !== undefined) {
    const byId = displays.find(d => String(d.id) === String(savedId));
    if (byId) return byId;
  }

  // 2. Se o ID mudou (comum no macOS após sleep/dock/reiniciar), tentar por bounds exatos
  if (savedBounds && savedBounds.width && savedBounds.height) {
    const byExactBounds = displays.find(d => 
      d.bounds.x === savedBounds.x && 
      d.bounds.y === savedBounds.y && 
      d.bounds.width === savedBounds.width && 
      d.bounds.height === savedBounds.height
    );
    if (byExactBounds) return byExactBounds;

    // 3. Tentar por dimensão em monitor secundário (x !== 0 ou y !== 0)
    const byRes = displays.find(d => 
      (d.bounds.x !== 0 || d.bounds.y !== 0) &&
      d.bounds.width === savedBounds.width && 
      d.bounds.height === savedBounds.height
    );
    if (byRes) return byRes;
  }

  // 4. Tentar por índice de monitor (ex: 3º monitor se salvo índice 2)
  if (savedIndex !== undefined && savedIndex !== null && displays[savedIndex]) {
    return displays[savedIndex];
  }

  // 5. Fallback para monitor externo que não seja o operador
  let opDisplay = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
  }
  const externalDisplays = displays.filter(d => !opDisplay || String(d.id) !== String(opDisplay.id));
  if (externalDisplays.length > 0) {
    return externalDisplays[externalDisplays.length - 1];
  }

  return displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];
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

  // Restaurar preferências salvas em window-state.json e preferences.json
  const prefs = loadPrefs();
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
      if (state.telaoBounds) savedTelaoBounds = state.telaoBounds;
      if (state.retornoBounds) savedRetornoBounds = state.retornoBounds;
      if (state.telaoDisplayIndex !== undefined) savedTelaoDisplayIndex = state.telaoDisplayIndex;
      if (state.retornoDisplayIndex !== undefined) savedRetornoDisplayIndex = state.retornoDisplayIndex;
      if (state.telaoIsOpen !== undefined) telaoWasOpen = state.telaoIsOpen;
      if (state.retornoIsOpen !== undefined) retornoWasOpen = state.retornoIsOpen;
    }
  } catch (e) {
    console.error('[WindowState] Falha ao ler window-state.json:', e);
  }

  // Fallbacks de preferences.json caso window-state.json não possua alguma informação
  if (savedTelaoMonitorId === null && prefs.slideState_monitor_telao !== undefined) {
    savedTelaoMonitorId = prefs.slideState_monitor_telao;
  }
  if (savedRetornoMonitorId === null && prefs.slideState_monitor_retorno !== undefined) {
    savedRetornoMonitorId = prefs.slideState_monitor_retorno;
  }
  if (prefs.slideState_telao_is_open !== undefined) {
    telaoWasOpen = !!prefs.slideState_telao_is_open;
  } else if (savedTelaoMonitorId !== null && telaoWasOpen === undefined) {
    telaoWasOpen = true;
  }
  if (prefs.slideState_retorno_is_open !== undefined) {
    retornoWasOpen = !!prefs.slideState_retorno_is_open;
  }

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 650,
    title: 'SlideControl Lumina — Console de Produção',
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

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);

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
    saveState();
    mainWindow = null;
    if (telaoWindow && !telaoWindow.isDestroyed()) telaoWindow.close();
    if (retornoWindow && !retornoWindow.isDestroyed()) retornoWindow.close();
    app.quit();
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

  if (!finalDisplay) {
    finalDisplay = findTargetDisplay(savedTelaoMonitorId, savedTelaoBounds, savedTelaoDisplayIndex);
  }

  if (!finalDisplay) return;

  // Atualizar ID, bounds e índice salvos para manter tudo em sincronia
  savedTelaoMonitorId = finalDisplay.id;
  savedTelaoBounds = finalDisplay.bounds;
  savedTelaoDisplayIndex = displays.findIndex(d => String(d.id) === String(finalDisplay.id));
  telaoWasOpen = true;

  // Previne cobrir o operador na inicialização apenas se for tela única
  if (isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id) && displays.length <= 1) {
      console.log('[Telão] Cancelando abertura automática para não cobrir a tela do Operador em monitor único.');
      if (!startupWarningShown) {
        startupWarningShown = true;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Dica: Gerenciador de Telas',
          message: 'O sistema detectou apenas 1 monitor conectado. Para evitar que o Telão cubra os controles do Operador, a abertura automática foi cancelada.\n\nComo resolver:\nConecte um monitor externo ou utilize o Gerenciador de Telas clicando no botão "🖥️ TELAS" na barra superior.',
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
    title: 'SlideControl Lumina — Telão de Projeção',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  telaoWindow.loadURL(`http://127.0.0.1:${PORT}/display`);

  telaoWindow.on('closed', () => {
    telaoWindow = null;
    // NÃO chamar saveState() aqui para não zerar telaoIsOpen no encerramento do app
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

  if (!finalDisplay) {
    finalDisplay = findTargetDisplay(savedRetornoMonitorId, savedRetornoBounds, savedRetornoDisplayIndex);
  }

  if (!finalDisplay) return;

  // Atualizar ID, bounds e índice salvos para manter tudo em sincronia
  savedRetornoMonitorId = finalDisplay.id;
  savedRetornoBounds = finalDisplay.bounds;
  savedRetornoDisplayIndex = displays.findIndex(d => String(d.id) === String(finalDisplay.id));
  retornoWasOpen = true;

  // Previne cobrir o operador na inicialização apenas se for tela única
  if (isStartup && finalDisplay && mainWindow && !mainWindow.isDestroyed()) {
    const opDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (opDisplay && String(finalDisplay.id) === String(opDisplay.id) && displays.length <= 1) {
      console.log('[Retorno] Cancelando abertura automática para não cobrir a tela do Operador em monitor único.');
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
    title: 'SlideControl Lumina — Retorno do Palco',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  retornoWindow.loadURL(`http://127.0.0.1:${PORT}/retorno`);

  retornoWindow.on('closed', () => {
    retornoWindow = null;
    // NÃO chamar saveState() aqui para não zerar retornoIsOpen no encerramento do app
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

  let telaoDisplayId = null;
  if (telaoWindow && !telaoWindow.isDestroyed()) {
    const d = screen.getDisplayMatching(telaoWindow.getBounds());
    if (d) telaoDisplayId = d.id;
  }

  let retornoDisplayId = null;
  if (retornoWindow && !retornoWindow.isDestroyed()) {
    const d = screen.getDisplayMatching(retornoWindow.getBounds());
    if (d) retornoDisplayId = d.id;
  }

  return screen.getAllDisplays().map((d, idx) => ({
    id: d.id,
    index: idx + 1,
    bounds: d.bounds,
    primary: d.bounds.x === 0 && d.bounds.y === 0,
    isOperador: String(mainWindowId) === String(d.id),
    isTelao: String(telaoDisplayId) === String(d.id),
    isRetorno: String(retornoDisplayId) === String(d.id),
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

  const dIndex = displays.findIndex(disp => String(disp.id) === String(monitorId));

  if (windowType === 'telao') {
    savedTelaoMonitorId = monitorId;
    savedTelaoBounds = d.bounds;
    savedTelaoDisplayIndex = dIndex;
    telaoWasOpen = true;
    saveState();

    if (!telaoWindow || telaoWindow.isDestroyed()) {
      openTelao(d);
      return true;
    } else {
      isReassigningScreen = true;
      telaoWindow.close();
      return new Promise(resolve => {
        setTimeout(() => {
          isReassigningScreen = false;
          openTelao(d);
          resolve(true);
        }, 150);
      });
    }
  } else if (windowType === 'retorno') {
    savedRetornoMonitorId = monitorId;
    savedRetornoBounds = d.bounds;
    savedRetornoDisplayIndex = dIndex;
    retornoWasOpen = true;
    saveState();

    if (!retornoWindow || retornoWindow.isDestroyed()) {
      openRetorno(d);
      return true;
    } else {
      isReassigningScreen = true;
      retornoWindow.close();
      return new Promise(resolve => {
        setTimeout(() => {
          isReassigningScreen = false;
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
    telaoWasOpen = false;
    if (telaoWindow && !telaoWindow.isDestroyed()) {
      telaoWindow.close();
      telaoWindow = null;
    }
  } else if (windowType === 'retorno') {
    retornoWasOpen = false;
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setClosable(true);
  }
  app.quit();
});

// ── GERENCIAMENTO NATIVO DE ARQUIVOS E PASTAS DO SO (FINDER / EXPLORER) ──
function getCustomUploadsDir() {
  const localDevPath = path.join(__dirname, 'frontend', 'uploads', 'custom');
  if (fs.existsSync(localDevPath)) {
    return localDevPath;
  }
  const userPath = path.join(app.getPath('userData'), 'frontend', 'uploads', 'custom');
  if (!fs.existsSync(userPath)) {
    fs.mkdirSync(userPath, { recursive: true });
  }
  return userPath;
}

ipcMain.handle('open-uploads-folder', async (event, relPath = '') => {
  try {
    const baseDir = getCustomUploadsDir();
    const safeRel = path.normalize(relPath || '').replace(/^(\.\.[\/\\])+/, '');
    const targetDir = path.join(baseDir, safeRel);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const errMsg = await shell.openPath(targetDir);
    if (errMsg) {
      console.warn('[open-uploads-folder] shell.openPath error:', errMsg);
      return { success: false, error: errMsg };
    }
    return { success: true, targetDir };
  } catch (err) {
    console.error('[open-uploads-folder] error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('reveal-item-in-folder', async (event, relPath = '') => {
  try {
    const baseDir = getCustomUploadsDir();
    const safeRel = path.normalize(relPath || '').replace(/^(\.\.[\/\\])+/, '');
    const targetFile = path.join(baseDir, safeRel);
    if (fs.existsSync(targetFile)) {
      shell.showItemInFolder(targetFile);
      return { success: true };
    }
    return { success: false, error: 'Arquivo não encontrado' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('trash-item', async (event, relPath = '') => {
  try {
    const baseDir = getCustomUploadsDir();
    const safeRel = path.normalize(relPath || '').replace(/^(\.\.[\/\\])+/, '');
    const targetFile = path.join(baseDir, safeRel);
    if (fs.existsSync(targetFile)) {
      await shell.trashItem(targetFile);
      return { success: true };
    }
    return { success: false, error: 'Arquivo não encontrado' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── INICIALIZAÇÃO DA APLICAÇÃO ELECTRON ──
function waitForBackendAndCreateWindow() {
  console.log(`[Electron] Aguardando FastAPI na porta ${PORT}...`);
  const checkServer = () => {
    http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      if (res.statusCode === 200) {
        console.log("[Electron] Backend FastAPI online!");
        createMainWindow();
        setTimeout(() => {
          if (telaoWasOpen) openTelao(null, true);
          if (retornoWasOpen) openRetorno(null, true);
        }, 1000);
      } else {
        setTimeout(checkServer, 300);
      }
    }).on("error", () => {
      setTimeout(checkServer, 300);
    });
  };
  checkServer();
}

app.whenReady().then(() => {
  startPythonBackend();
  waitForBackendAndCreateWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function startPythonBackend() {
  if (process.env.DEV_MODE === 'true') {
    console.log("Modo de desenvolvimento (F5): Backend Python gerenciado pelo VS Code.");
    return;
  }

  const backendScript = path.join(__dirname, 'run_backend.py');
  if (!fs.existsSync(backendScript)) return;

  console.log('[PyBackend] Iniciando backend Python...');
  const userDataPath = app.getPath('userData');
  const spawnEnv = {
    ...process.env,
    SLIDECONTROL_USER_DATA: userDataPath
  };

  if (app.isPackaged) {
    const backendExe = process.platform === 'win32' ? 'backend.exe' : 'backend';
    const backendPath = path.join(process.resourcesPath, 'backend', backendExe);
    if (process.platform !== 'win32' && fs.existsSync(backendPath)) {
      fs.chmodSync(backendPath, '755');
    }
    pythonProcess = spawn(backendPath, [], { cwd: path.join(process.resourcesPath, 'backend'), env: spawnEnv });
  } else {
    const isWin = process.platform === 'win32';
    const pythonPath = isWin 
      ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
      : path.join(__dirname, 'venv', 'bin', 'python');
    const exe = fs.existsSync(pythonPath) ? pythonPath : 'python3';
    pythonProcess = spawn(exe, ['run_backend.py'], { cwd: __dirname, env: spawnEnv });
  }

  pythonProcess.stdout?.on('data', (d) => console.log(`[Py]: ${d}`));
  pythonProcess.stderr?.on('data', (d) => console.error(`[PyErr]: ${d}`));
}

app.on('before-quit', (e) => {
  if (!isShuttingDown) {
    e.preventDefault();
    saveState(); // Salva o estado com as janelas ainda ativas antes de fechar tudo
    isShuttingDown = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setClosable(true);
    }

    // Fecha todas as janelas imediatamente
    if (telaoWindow && !telaoWindow.isDestroyed()) telaoWindow.close();
    if (retornoWindow && !retornoWindow.isDestroyed()) retornoWindow.close();

    // Notifica backend Python para encerramento gracioso
    http.get(`http://127.0.0.1:${PORT}/api/system/shutdown`).on('error', () => {});

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
