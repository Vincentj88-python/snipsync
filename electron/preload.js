const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getDeviceName: () => ipcRenderer.invoke('get-device-name'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('set-open-at-login', enabled),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  startOAuth: (url) => ipcRenderer.invoke('start-oauth', url),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  onAuthTokens: (callback) => {
    const handler = (_event, tokens) => callback(tokens)
    ipcRenderer.on('auth-tokens', handler)
    return handler
  },
  removeAuthTokensListener: (handler) => {
    ipcRenderer.removeListener('auth-tokens', handler)
  },
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status)
    ipcRenderer.on('update-status', handler)
    return handler
  },
  removeUpdateStatusListener: (handler) => {
    ipcRenderer.removeListener('update-status', handler)
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  startClipboardWatch: () => ipcRenderer.invoke('start-clipboard-watch'),
  stopClipboardWatch: () => ipcRenderer.invoke('stop-clipboard-watch'),
  onClipboardChange: (callback) => {
    const handler = (_event, text) => callback(text)
    ipcRenderer.on('clipboard-change', handler)
    return handler
  },
  removeClipboardChangeListener: (handler) => {
    ipcRenderer.removeListener('clipboard-change', handler)
  },
})
