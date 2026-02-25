import { app, shell, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { handleMediaProtocol } from './protocol/mediaProtocol'
import { registerAllHandlers } from './ipc/index'
import { startBackend, stopBackend, setStatusCallback } from './services/pythonManager'

// Must be called BEFORE app.whenReady() — registers media:// as a privileged scheme
// so that <video>/<audio> src and range requests work correctly
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.whisperapp')
  }

  // Register custom media:// protocol handler (Electron 30+ — no pre-ready registration needed)
  handleMediaProtocol()

  // Register all IPC handlers
  registerAllHandlers()

  createWindow()

  // Start Python backend AFTER renderer has loaded to avoid missing early status events
  setStatusCallback((status) => {
    mainWindow?.webContents.send('backend:status', status)
  })
  mainWindow!.webContents.once('did-finish-load', () => {
    startBackend()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackend()
})
