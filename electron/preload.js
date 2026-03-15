const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getDeviceName: () => ipcRenderer.invoke('get-device-name'),
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
})
