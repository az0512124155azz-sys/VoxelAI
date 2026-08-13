const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const PORT = 3791;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'renderer')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

// ─── API Routes ────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Upload 3D model file
app.post('/api/upload-model', upload.single('model'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const data = req.file.buffer.toString('base64');
  res.json({
    name: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
    data: data
  });
});

// Upload images
app.post('/api/upload-images', upload.array('images', 20), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No images uploaded' });
  const images = req.files.map(f => ({
    name: f.originalname,
    mime: f.mimetype,
    data: f.buffer.toString('base64')
  }));
  res.json({ images });
});

// 3D generation request
app.post('/api/generate-3d', async (req, res) => {
  const { mode, prompt, images } = req.body;
  try {
    const result = await generate3DModel({ mode, prompt, images });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Smart print splitter
app.post('/api/print-split', async (req, res) => {
  const { modelData, bedX, bedY, bedZ, addPins } = req.body;
  res.json({
    status: 'process_client_side',
    bedX, bedY, bedZ,
    addPins: !!addPins
  });
});

// Export model
app.post('/api/export', async (req, res) => {
  const { modelData, format, filename } = req.body;
  res.json({ data: modelData, filename: `${filename}.${format}` });
});

// Save model to history folder
app.post('/api/save-history-model', (req, res) => {
  const { id, modelData } = req.body;
  if (!modelData) return res.status(400).json({ error: 'No model data' });
  try {
    const historyDir = path.join(__dirname, 'renderer', 'history_files');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const filename = `model_${id}.glb`;
    const filePath = path.join(historyDir, filename);
    const buf = Buffer.from(modelData, 'base64');
    fs.writeFileSync(filePath, buf);
    res.json({ success: true, url: `/history_files/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Generation Engine ──────────────────────────────────────────────────────
async function generate3DModel({ mode, prompt, images }) {
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
      }, 2000);
      if (response.ok) return await response.json();
    } catch (_) {}
  }

  return {
    offline: true,
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 VoxelAI Studio Web Server running at http://127.0.0.1:${PORT}`);
  console.log(` Opening in your web browser...\n`);
  exec(`start http://127.0.0.1:${PORT}`);
});
