const express = require('express');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3791;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'renderer')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 VoxelAI Studio Web Server running at http://127.0.0.1:${PORT}`);
  console.log(` Opening in your web browser...\n`);
  exec(`start http://127.0.0.1:${PORT}`);
});
