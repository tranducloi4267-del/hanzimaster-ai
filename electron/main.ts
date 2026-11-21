import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { synthesizeEdgeTts, type EdgeTtsOptions } from './edgeTts';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 920,
    minHeight: 620,
    title: 'HanziMaster AI — Học Tiếng Trung Offline-First',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Tự động cấp quyền Microphone & Audio cho các tính năng Luyện nói / Gia sư AI
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media' || permission === 'clipboard-read') {
        callback(true);
      } else {
        callback(false);
      }
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Microsoft Edge TTS 0đ (chạy trực tiếp trong Main Process Node.js)
ipcMain.handle('edge-tts:synthesize', async (_event, options: EdgeTtsOptions) => {
  const audioBuffer = await synthesizeEdgeTts(options);
  return audioBuffer.toString('base64');
});

// IPC: Đọc gói từ điển & nét chữ nén đóng gói sẵn trong dist/data (hoạt động chắc chắn với file://)
const ALLOWED_DATA_FILES = new Set([
  'full-dictionary.json.gz',
  'full-graphics.json.gz',
  'full-dictionary.json',
  'full-graphics.json'
]);

ipcMain.handle('local-asset:read-data', async (_event, fileName: string) => {
  if (!ALLOWED_DATA_FILES.has(fileName)) return null;
  const candidates = [
    path.join(__dirname, '../dist/data', fileName),
    path.join(__dirname, '../public/data', fileName)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const buf = await fs.promises.readFile(candidate);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
  }
  return null;
});

// IPC: Mã hóa/giải mã API Key cục bộ an toàn bằng Windows DPAPI (safeStorage)
ipcMain.handle('secure-storage:is-available', () => {
  return safeStorage.isEncryptionAvailable();
});

ipcMain.handle('secure-storage:encrypt', (_event, plainText: string) => {
  if (!plainText) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    return `plain:${Buffer.from(plainText, 'utf8').toString('base64')}`;
  }
  const encrypted = safeStorage.encryptString(plainText);
  return `enc:${encrypted.toString('base64')}`;
});

ipcMain.handle('secure-storage:decrypt', (_event, payload: string) => {
  if (!payload) return '';
  if (payload.startsWith('plain:')) {
    return Buffer.from(payload.slice(6), 'base64').toString('utf8');
  }
  if (payload.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
    const buf = Buffer.from(payload.slice(4), 'base64');
    return safeStorage.decryptString(buf);
  }
  return payload;
});
