const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const multer = require('multer');
const cors = require('cors');

let mainWindow;
const isDev = process.argv.includes('--dev');

// ─── Express API server (local backend) ───────────────────────────────────────
const apiApp = express();
apiApp.use(cors());
apiApp.use(express.json({ limit: '200mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

// Serve renderer files via Express
apiApp.use(express.static(path.join(__dirname, 'renderer')));

// ─── API Routes ────────────────────────────────────────────────────────────────

// Health check
apiApp.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Upload 3D model file for preview/editing
apiApp.post('/api/upload-model', upload.single('model'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const data = req.file.buffer.toString('base64');
  res.json({
    name: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
    data: data
  });
});

// Upload images for 3D generation
apiApp.post('/api/upload-images', upload.array('images', 20), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No images uploaded' });
  const images = req.files.map(f => ({
    name: f.originalname,
    mime: f.mimetype,
    data: f.buffer.toString('base64')
  }));
  res.json({ images });
});

// 3D generation request (connects to local AI or mock)
apiApp.post('/api/generate-3d', express.json(), async (req, res) => {
  const { mode, prompt, images } = req.body;
  // Attempt connection to local AI engines (Shap-E, Tripo, InstantMesh, etc.)
  // Falls back to a procedural mock model for offline use
  try {
    const result = await generate3DModel({ mode, prompt, images });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Smart print splitter
apiApp.post('/api/print-split', express.json(), async (req, res) => {
  const { modelData, bedX, bedY, bedZ, addPins } = req.body;
  try {
    const result = splitForPrinting({ modelData, bedX, bedY, bedZ, addPins });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export model in target format
apiApp.post('/api/export', express.json(), async (req, res) => {
  const { modelData, format, filename } = req.body;
  try {
    const exported = convertModelFormat(modelData, format);
    res.json({ data: exported, filename: `${filename}.${format}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Generation Engine (mock/bridge) ────────────────────────────────────────
async function generate3DModel({ mode, prompt, images }) {
  // Try local endpoints in order: Tripo3D local, Shap-E, InstantMesh, Ollama
  const localEndpoints = [
    'http://localhost:8080/generate',
    'http://localhost:5000/generate',
    'http://localhost:7860/generate',
  ];

  for (const endpoint of localEndpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt, images: images?.slice(0, 4) })
      }, 3000);
      if (response.ok) {
        return await response.json();
      }
    } catch (_) {
      // try next
    }
  }

  // Offline mock: Return a procedural GLB placeholder
  return {
    offline: true,
    message: `[Offline Mode] No local AI engine detected. Model for "${prompt || mode}" will appear as placeholder. Connect a local AI like Shap-E or Tripo3D for real generation.`,
    modelType: 'placeholder',
    mode
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// 3D print splitting logic (geometry-aware, runs in JS)
function splitForPrinting({ modelData, bedX, bedY, bedZ, addPins }) {
  // This is handled client-side in Three.js renderer for full 3D geometry access
  // Server just validates and routes
  return {
    status: 'process_client_side',
    bedX, bedY, bedZ,
    addPins: !!addPins
  };
}

function convertModelFormat(modelData, format) {
  // Format conversions handled in renderer via Three.js exporters
  return modelData;
}

// ─── Start API server ──────────────────────────────────────────────────────────
const server = http.createServer(apiApp);
server.listen(3791, '127.0.0.1', () => {
  if (isDev) console.log('VoxelAI API server running on http://127.0.0.1:3791');
});

// ─── Electron window ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'VoxelAI Studio',
    backgroundColor: '#050510',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadURL('http://127.0.0.1:3791');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    server.close();
  });
}

// IPC handlers
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

ipcMain.handle('dialog:save-file', async (_, { defaultName, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
});

ipcMain.handle('fs:write-file', async (_, { filePath, data }) => {
  try {
    const buf = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buf);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('shell:open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('app:get-path', (_, name) => app.getPath(name));

app.whenReady().then(() => {
  // Wait a moment for the server to start
  setTimeout(createWindow, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
