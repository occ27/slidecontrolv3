const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getScreens: () => ipcRenderer.invoke('get-screens'),
  identifyScreens: () => ipcRenderer.invoke('identify-screens'),
  assignScreen: (windowType, monitorId) => ipcRenderer.invoke('assign-screen', windowType, monitorId),
  closeScreen: (windowType) => ipcRenderer.invoke('close-screen', windowType),
  getOpenScreens: () => ipcRenderer.invoke('get-open-screens'),
  getPref: (key) => ipcRenderer.sendSync('get-pref', key),
  setPref: (key, val) => ipcRenderer.send('set-pref', key, val),
  removePref: (key) => ipcRenderer.send('remove-pref', key),
  refocusWindow: () => ipcRenderer.send('refocus-main-window'),
  fecharApp: () => ipcRenderer.send('fechar-app'),
  onShowQuitModal: (callback) => ipcRenderer.on('show-quit-modal', callback)
});
