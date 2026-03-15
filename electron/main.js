const { app, BrowserWindow, Tray, ipcMain, shell, nativeImage } = require('electron')
const path = require('path')
const os = require('os')
const http = require('http')
const { autoUpdater } = require('electron-updater')
const Sentry = require('@sentry/electron')

let tray = null
let mainWindow = null

const isDev = !app.isPackaged
const OAUTH_PORT = 54321

// ── Sentry ──────────────────────────────────────────
if (!isDev) {
  Sentry.init({
    dsn: 'https://e7ddc742366a1d89e3e5661d3b9cdb8e@o4511048248918016.ingest.de.sentry.io/4511048252981328',
    environment: isDev ? 'development' : 'production',
    release: `snip@${app.getVersion()}`,
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
    },
  })

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
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'tray-icon.png')
    : path.join(process.resourcesPath, 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  const resizedIcon = icon.resize({ width: 22, height: 22 })

  if (process.platform === 'darwin') {
    resizedIcon.setTemplateImage(true)
  }

  tray = new Tray(resizedIcon)
  tray.setToolTip('Snip')
  tray.on('click', () => {
    toggleWindow()
  })
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
  if (access_token) {
    fetch('/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token })
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
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
          try {
            const tokens = JSON.parse(body)
            if (mainWindow && tokens.access_token) {
              mainWindow.webContents.send('auth-tokens', tokens)
            }
          } catch {}
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
      await startOAuthServer()
      shell.openExternal(url)
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
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide()
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
