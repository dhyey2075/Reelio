const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');

const EXPANDED = { width: 420, height: 740 };
const distPath = path.join(__dirname, '..', 'dist', 'index.html');

let mainWindow = null;

function getBottomRightPosition(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - width - 20,
    y: workArea.y + workArea.height - height - 20,
  };
}

function ensureOnTop() {
  if (!mainWindow) return;
  const level = process.platform === 'darwin' ? 'floating' : 'screen-saver';
  mainWindow.setAlwaysOnTop(true, level);
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function focusWindow() {
  if (!mainWindow) return;
  ensureOnTop();
  mainWindow.show();
  mainWindow.focus();
}

function setExpandedSize() {
  if (!mainWindow) return;
  const pos = getBottomRightPosition(EXPANDED.width, EXPANDED.height);
  mainWindow.setSize(EXPANDED.width, EXPANDED.height);
  mainWindow.setPosition(pos.x, pos.y);
  ensureOnTop();
}

function loadPlayerContent(window) {
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  if (fs.existsSync(distPath)) {
    window.loadFile(distPath);
    return;
  }

  dialog.showErrorBox(
    'Reelio Player',
    'Player UI not built.\n\nRun: cd player && npm run build\nOr use dev mode: npm run dev'
  );
  app.quit();
}

function createWindow() {
  const pos = getBottomRightPosition(EXPANDED.width, EXPANDED.height);

  mainWindow = new BrowserWindow({
    width: EXPANDED.width,
    height: EXPANDED.height,
    x: pos.x,
    y: pos.y,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ensureOnTop();
  loadPlayerContent(mainWindow);
}

ipcMain.handle('window:expand', () => {
  setExpandedSize();
  focusWindow();
});

ipcMain.handle('window:focus', () => {
  focusWindow();
});

ipcMain.handle('window:minimize', () => {
  if (!mainWindow) return;
  mainWindow.hide();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
