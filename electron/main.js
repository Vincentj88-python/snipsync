const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, clipboard } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const { autoUpdater } = require('electron-updater')
const Sentry = require('@sentry/electron/main')

let tray = null
let mainWindow = null
let clipboardWatcher = null
let lastClipboardHash = ''
let oauthState = null

const isDev = !app.isPackaged
const OAUTH_PORT = 54321

// ── Single instance lock ────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) toggleWindow()
      mainWindow.focus()
    }
  })
}

// ── Sentry ──────────────────────────────────────────
if (!isDev) {
  Sentry.init({
    dsn: 'https://e7ddc742366a1d89e3e5661d3b9cdb8e@o4511048248918016.ingest.de.sentry.io/4511048252981328',
    environment: isDev ? 'development' : 'production',
    release: `snipsync@${app.getVersion()}`,
  })
}

// ── Auto-updater ────────────────────────────────────
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.logger = null

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'available', version: info.version })
  }
})

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version })
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  // Deny all permission requests (camera, mic, geolocation, etc.)
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _perm, callback) => callback(false))
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('blur', () => {
    mainWindow.hide()
  })
}

function positionWindow() {
  if (!tray || !mainWindow) return

  const trayBounds = tray.getBounds()
  const windowBounds = mainWindow.getBounds()

  let x, y

  if (process.platform === 'darwin') {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    y = Math.round(trayBounds.y + trayBounds.height + 4)
  } else {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    y = Math.round(trayBounds.y - windowBounds.height - 4)
  }

  mainWindow.setPosition(x, y, false)
}

function toggleWindow() {
  if (!mainWindow) return

  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    positionWindow()
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray() {
  const baseDir = isDev
    ? path.join(__dirname, '..', 'public')
    : process.resourcesPath
  const icon = nativeImage.createFromPath(path.join(baseDir, 'tray-icon.png'))

  // Add @2x for Retina displays
  const icon2x = nativeImage.createFromPath(path.join(baseDir, 'tray-icon@2x.png'))
  if (!icon2x.isEmpty()) {
    icon.addRepresentation({ scaleFactor: 2.0, buffer: icon2x.toPNG() })
  }

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('SnipSync')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open SnipSync', click: () => toggleWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.on('click', () => toggleWindow())
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu))
}

// Start a temporary local HTTP server to receive OAuth callback tokens
function startOAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/callback') {
        // Serve a small HTML page that reads the hash fragment and POSTs tokens
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<!DOCTYPE html>
<html><head><title>Sign in</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <p>Signing you in...</p>
  <p style="color:#555;font-size:13px">You can close this tab.</p>
</div>
<script>
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  // Extract state from URL query string for CSRF validation
  const query = new URLSearchParams(window.location.search);
  const state = query.get('state') || params.get('state') || '';
  if (access_token) {
    fetch('/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token, state })
    }).then(() => {
      document.body.innerHTML = '<div style="text-align:center"><p style="color:#22c55e">Signed in! You can close this tab.</p></div>';
    });
  }
</script>
</body></html>`)
        return
      }

      if (req.method === 'POST' && req.url === '/token') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const tokens = JSON.parse(body)
            // Validate CSRF state token
            if (oauthState && tokens.state !== oauthState) {
              res.writeHead(403, { 'Content-Type': 'application/json' })
              res.end('{"error":"Invalid state"}')
              return
            }
            oauthState = null // Single-use
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end('{"ok":true}')
            if (mainWindow && tokens.access_token) {
              mainWindow.webContents.send('auth-tokens', tokens)
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end('{"error":"Invalid body"}')
          }
          // Close server after receiving tokens
          setTimeout(() => {
            server.close()
            clearTimeout(timeout)
          }, 500)
        })
        return
      }

      res.writeHead(404)
      res.end()
    })

    // Timeout: close server after 120s if no callback received
    const timeout = setTimeout(() => {
      server.close()
    }, 120000)

    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      resolve(server)
    })

    server.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

function registerIpcHandlers() {
  ipcMain.handle('get-platform', () => {
    return process.platform
  })

  ipcMain.handle('get-device-name', () => {
    return os.hostname()
  })

  ipcMain.handle('get-machine-id', () => {
    // Persistent UUID stored in userData — survives hardware changes
    const idPath = path.join(app.getPath('userData'), 'device-id.txt')
    try {
      const existing = fs.readFileSync(idPath, 'utf-8').trim()
      if (existing) return existing
    } catch {
      // File doesn't exist yet
    }
    const newId = crypto.randomUUID()
    fs.writeFileSync(idPath, newId, 'utf-8')
    return newId
  })

  ipcMain.handle('get-legacy-machine-id', () => {
    // Old SHA-256 hardware fingerprint — used only for one-time migration
    const parts = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || '',
      os.totalmem().toString(),
      os.homedir(),
    ]
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)
  })

  ipcMain.handle('open-url', (_event, url) => {
    // Validate URL — only allow http: and https: protocols
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url)
      }
    } catch {
      // Invalid URL — silently ignore
    }
  })

  ipcMain.handle('start-oauth', async (_event, url) => {
    try {
      // Generate CSRF state token and append to OAuth URL
      oauthState = crypto.randomBytes(32).toString('hex')
      const separator = url.includes('?') ? '&' : '?'
      const urlWithState = `${url}${separator}state=${oauthState}`
      await startOAuthServer()
      shell.openExternal(urlWithState)
    } catch {
      // Server failed to start — try opening URL directly
      shell.openExternal(url)
    }
  })

  ipcMain.handle('hide-window', () => {
    if (mainWindow) mainWindow.hide()
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('get-login-item-settings', () => {
    return app.getLoginItemSettings()
  })

  ipcMain.handle('set-open-at-login', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  })

  // ── Clipboard auto-capture ──────────────────────────
  ipcMain.handle('start-clipboard-watch', () => {
    if (clipboardWatcher) return
    // Seed with current clipboard content so we don't immediately capture it
    const current = clipboard.readText()
    if (current) {
      lastClipboardHash = crypto.createHash('md5').update(current).digest('hex')
    }
    clipboardWatcher = setInterval(() => {
      const text = clipboard.readText()
      if (!text || text.length > 10000) return
      const hash = crypto.createHash('md5').update(text).digest('hex')
      if (hash !== lastClipboardHash) {
        lastClipboardHash = hash
        if (mainWindow) {
          mainWindow.webContents.send('clipboard-change', text)
        }
      }
    }, 1500)
  })

  ipcMain.handle('stop-clipboard-watch', () => {
    if (clipboardWatcher) {
      clearInterval(clipboardWatcher)
      clipboardWatcher = null
    }
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  // Launch on system startup (production only)
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    })
  }

  registerIpcHandlers()
  createTray()
  createWindow()

  // Check for updates after launch (production only)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 5000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
