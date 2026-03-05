import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'MétréPlan',
    show: false,
  })

  // N'afficher la fenêtre qu'une fois prête (évite le flash blanc)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  if (isDev) {
    // Mode développement : Vite dev server
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // Mode production : fichiers buildés
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Ouvrir les liens externes (http/https) dans le navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

// Quitter quand toutes les fenêtres sont fermées (sauf macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Sur macOS : recréer la fenêtre si l'icône du dock est cliquée
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
