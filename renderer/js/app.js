/**
 * app.js — Main application controller
 * Wires up all tabs, events, uploads, generators, exporter, print splitter
 */

// ── Globals ──────────────────────────────────────────────────────────────
let currentImages = [];     // FileList for create
let editModelObject = null; // THREE.Object3D for edit tab
let blendModelA = null;
let blendModelB = null;
let avatarFile = null;
let currentBed = { x: 256, y: 256, z: 256 }; // default 256
let createMode = 'single-image';
let editType = 'geometry';
let avatarStyle = 'pixar';
let avatarSubject = 'human';
let blendTypes = new Set(['geometry', 'texture']);

// ── Toast utility ─────────────────────────────────────────────────────────
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
};

// ── Tab navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(`tab-${tabId}`)?.classList.add('active');
    // Clear split visualization when leaving print tab
    if (tabId !== 'print' && window.VoxelPrintSplitter) {
      window.VoxelPrintSplitter.clearSplitVisualization(window.VoxelViewport);
      document.getElementById('print-result-panel')?.classList.add('hidden');
    }
  });
});

// ── CREATE TAB ─────────────────────────────────────────────────────────────

// Mode selector
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    createMode = btn.dataset.mode;
    updateCreateUI();
  });
});

function updateCreateUI() {
  const imgArea = document.getElementById('image-upload-area');
  const promptArea = document.getElementById('prompt-area');
  const needsImages = createMode !== 'text-only';
  const needsPrompt = ['image-text', 'multi-image-text', 'text-only'].includes(createMode);
  imgArea.style.display = needsImages ? '' : 'none';
  // Prompt always shown but labeled
  const promptEl = document.getElementById('create-prompt');
  if (createMode === 'text-only') {
    promptEl.placeholder = 'תאר בפירוט מה ברצונך ליצור... \'ספינת חלל אנאלוגית עם 4 מנועים וסנפירים\' ';
  } else if (needsPrompt) {
    promptEl.placeholder = 'תוסיף טקסט לכיוון היצירה (אופציונלי אך מומלץ)';
  } else {
    promptEl.placeholder = 'תיאור אופציונלי...';
  }
}

// Image upload
const inputImages = document.getElementById('input-images');
inputImages?.addEventListener('change', (e) => {
  currentImages = e.target.files;
  renderImagePreviews([...e.target.files]);
});

// Drag & drop for image zone
const imgUploadZone = document.getElementById('image-upload-area');
imgUploadZone?.addEventListener('dragover', e => { e.preventDefault(); imgUploadZone.classList.add('drag-over'); });
imgUploadZone?.addEventListener('dragleave', () => imgUploadZone.classList.remove('drag-over'));
imgUploadZone?.addEventListener('drop', e => {
  e.preventDefault();
  imgUploadZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  currentImages = files;
  renderImagePreviews([...files]);
});

function renderImagePreviews(files) {
  const strip = document.getElementById('image-preview-strip');
  if (!strip) return;
  strip.innerHTML = '';
  files.slice(0, 12).forEach(f => {
    const img = document.createElement('img');
    img.className = 'img-thumb';
    img.src = URL.createObjectURL(f);
    strip.appendChild(img);
  });
}

// Guidance scale
document.getElementById('guidance-scale')?.addEventListener('input', function() {
  document.getElementById('guidance-val').textContent = this.value;
});

// Generate button
document.getElementById('btn-generate')?.addEventListener('click', async () => {
  const prompt = document.getElementById('create-prompt')?.value;
  if (createMode !== 'text-only' && currentImages.length === 0) {
    if (createMode === 'single-image') {
      showToast('העלה תמונה אחת לפחות', 'error'); return;
    }
    if (createMode === 'multi-image' || createMode === 'multi-image-text') {
      showToast('העלה לפחות שתי תמונות', 'error'); return;
    }
  }
  if (createMode === 'text-only' && !prompt?.trim()) {
    showToast('הזן תיאור טקסטואלי', 'error'); return;
  }

  await window.VoxelGenerator.generate({
    mode: createMode,
    prompt: prompt?.trim() || '',
    images: currentImages.length > 0 ? currentImages : null
  });
});

// ── EDIT TAB ──────────────────────────────────────────────────────────────

const inputModelEdit = document.getElementById('input-model-edit');
inputModelEdit?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('edit-model-name').textContent = file.name;
  try {
    editModelObject = await window.VoxelLoaders.loadFromFile(file);
    window.VoxelViewport.loadModel(editModelObject);
    showToast(`נטען: ${file.name}`, 'success');
  } catch (err) {
    showToast('שגיאה בטעינת מודל: ' + err.message, 'error');
  }
});

// Edit type tags
document.querySelectorAll('[data-edit-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-edit-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    editType = btn.dataset.editType;
  });
});

// Edit strength slider
document.getElementById('edit-strength')?.addEventListener('input', function() {
  document.getElementById('edit-strength-val').textContent = this.value + '%';
});

// Apply edit
document.getElementById('btn-apply-edit')?.addEventListener('click', async () => {
  const prompt = document.getElementById('edit-prompt')?.value;
  const strength = parseInt(document.getElementById('edit-strength')?.value || '50');
  await window.VoxelGenerator.editModel({ editType, prompt, strength });
});

// Drag & drop for edit model zone
const editModelZone = document.getElementById('model-upload-zone');
editModelZone?.addEventListener('dragover', e => { e.preventDefault(); editModelZone.classList.add('drag-over'); });
editModelZone?.addEventListener('dragleave', () => editModelZone.classList.remove('drag-over'));
editModelZone?.addEventListener('drop', async e => {
  e.preventDefault();
  editModelZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  document.getElementById('edit-model-name').textContent = file.name;
  try {
    editModelObject = await window.VoxelLoaders.loadFromFile(file);
    window.VoxelViewport.loadModel(editModelObject);
    showToast(`נטען: ${file.name}`, 'success');
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
  }
});

// ── BLEND TAB ─────────────────────────────────────────────────────────────

async function loadBlendModel(inputId, nameId, slot) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if (!file) return;
  document.getElementById(nameId).textContent = file.name;
  try {
    const obj = await window.VoxelLoaders.loadFromFile(file);
    if (slot === 'A') blendModelA = obj;
    else blendModelB = obj;
    // Preview whichever was loaded last
    window.VoxelViewport.loadModel(obj.clone());
    showToast(`מודל ${slot} נטען`, 'success');
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
  }
}

document.getElementById('input-blend-a')?.addEventListener('change', () => loadBlendModel('input-blend-a', 'blend-a-name', 'A'));
document.getElementById('input-blend-b')?.addEventListener('change', () => loadBlendModel('input-blend-b', 'blend-b-name', 'B'));

document.getElementById('blend-ratio')?.addEventListener('input', function() {
  const v = parseInt(this.value);
  document.getElementById('blend-ratio-val').textContent = `${v}/${100-v}`;
});

document.querySelectorAll('[data-blend]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const type = btn.dataset.blend;
    if (blendTypes.has(type)) blendTypes.delete(type);
    else blendTypes.add(type);
  });
});

document.getElementById('btn-blend')?.addEventListener('click', async () => {
  const ratio = parseInt(document.getElementById('blend-ratio')?.value || '50');
  const prompt = document.getElementById('blend-prompt')?.value;
  await window.VoxelGenerator.blendModels({
    modelA: blendModelA, modelB: blendModelB,
    ratio, prompt, blendTypes: [...blendTypes]
  });
});

// Drag & drop blend zones
['blend-zone-a', 'blend-zone-b'].forEach((zoneId, idx) => {
  const zone = document.getElementById(zoneId);
  const inputId = idx === 0 ? 'input-blend-a' : 'input-blend-b';
  const nameId = idx === 0 ? 'blend-a-name' : 'blend-b-name';
  const slot = idx === 0 ? 'A' : 'B';
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const inp = document.getElementById(inputId);
    const dt = new DataTransfer(); dt.items.add(file);
    inp.files = dt.files;
    await loadBlendModel(inputId, nameId, slot);
  });
});

// ── AVATAR TAB ────────────────────────────────────────────────────────────

document.getElementById('input-avatar')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  avatarFile = file;
  const preview = document.getElementById('avatar-preview');
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.alt = 'תצוגת תמונה';
  preview.appendChild(img);
});

const avatarUploadZone = document.getElementById('avatar-upload-zone');
avatarUploadZone?.addEventListener('dragover', e => { e.preventDefault(); avatarUploadZone.classList.add('drag-over'); });
avatarUploadZone?.addEventListener('dragleave', () => avatarUploadZone.classList.remove('drag-over'));
avatarUploadZone?.addEventListener('drop', e => {
  e.preventDefault(); avatarUploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  avatarFile = file;
  const preview = document.getElementById('avatar-preview');
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  preview.appendChild(img);
});

document.querySelectorAll('[data-style]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-style]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    avatarStyle = btn.dataset.style;
  });
});

document.querySelectorAll('[data-subject]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-subject]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    avatarSubject = btn.dataset.subject;
  });
});

document.getElementById('btn-avatar')?.addEventListener('click', async () => {
  const extras = document.getElementById('avatar-extras')?.value;
  await window.VoxelGenerator.generateAvatar({ imageFile: avatarFile, style: avatarStyle, subject: avatarSubject, extras });
});

// ── PRINT TAB ─────────────────────────────────────────────────────────────

// Bed size selector
document.querySelectorAll('.bed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sizeStr = btn.dataset.size;
    const customRow = document.getElementById('custom-dims-row');
    if (sizeStr === 'custom') {
      customRow.classList.remove('hidden');
    } else {
      customRow.classList.add('hidden');
      const [x, y, z] = sizeStr.split(',').map(Number);
      currentBed = { x, y, z };
    }
  });
});

// Custom dimension inputs
['dim-x', 'dim-y', 'dim-z'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    currentBed = {
      x: parseInt(document.getElementById('dim-x')?.value || '200'),
      y: parseInt(document.getElementById('dim-y')?.value || '200'),
      z: parseInt(document.getElementById('dim-z')?.value || '200')
    };
  });
});

// Print analyze button
document.getElementById('btn-print-analyze')?.addEventListener('click', () => {
  const model = window.VoxelViewport?.getCurrentModel();
  if (!model) {
    showToast('טען מודל תחילה (ב-עריכה או יצר מודל)', 'error');
    return;
  }
  const addPins = document.getElementById('toggle-pins')?.checked ?? true;
  const minimizeCuts = document.getElementById('toggle-minimize-cuts')?.checked ?? true;

  // Get active bed size
  const activeBed = document.querySelector('.bed-btn.active');
  if (activeBed?.dataset.size !== 'custom') {
    const [x, y, z] = (activeBed?.dataset.size || '256,256,256').split(',').map(Number);
    currentBed = { x, y, z };
  }

  const result = window.VoxelPrintSplitter.analyze(model, currentBed.x, currentBed.y, currentBed.z, addPins, minimizeCuts);

  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  window.VoxelPrintSplitter.visualizeSplit(result, window.VoxelViewport);
  window.VoxelPrintSplitter.renderRecommendationsUI(result.recommendations);
  window.VoxelPrintSplitter.renderResultPanel(result);

  if (result.fits) {
    showToast('✅ המודל נכנס שלם — אין צורך בחיתוך!', 'success');
  } else {
    showToast(`🔪 המודל יחולק ל-${result.splitCount} חלקים`, 'info');
  }
});

// ── EXPORT TAB ────────────────────────────────────────────────────────────

document.querySelectorAll('.export-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    window.VoxelExporter.exportModel(btn.dataset.format);
  });
});

document.getElementById('btn-screenshot')?.addEventListener('click', () => {
  window.VoxelExporter.takeScreenshot();
});

// ── SETTINGS & HISTORY TAB ──────────────────────────────────────────────────

// Toggle Trellis configuration fields visibility
const toggleTrellis = document.getElementById('toggle-trellis');
const trellisConfig = document.getElementById('trellis-config-fields');
const btnSaveTrellis = document.getElementById('btn-save-trellis');
const inputTrellisKey = document.getElementById('trellis-api-key');
const inputTrellisEndpoint = document.getElementById('trellis-endpoint');

toggleTrellis?.addEventListener('change', () => {
  const enabled = toggleTrellis.checked;
  localStorage.setItem('trellis_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    trellisConfig.classList.remove('hidden');
  } else {
    trellisConfig.classList.add('hidden');
  }
});

btnSaveTrellis?.addEventListener('click', () => {
  const apiKey = inputTrellisKey.value.trim();
  const endpoint = inputTrellisEndpoint.value.trim() || 'https://jeffreyxiang-trellis.hf.space/api/predict';
  
  localStorage.setItem('trellis_api_key', apiKey);
  localStorage.setItem('trellis_endpoint', endpoint);
  showToast('הגדרות API של Trellis נשמרו בהצלחה!', 'success');
});

// Load Trellis settings on start
function loadTrellisSettings() {
  const enabled = localStorage.getItem('trellis_enabled') === 'true';
  const apiKey = localStorage.getItem('trellis_api_key') || '';
  const endpoint = localStorage.getItem('trellis_endpoint') || 'https://jeffreyxiang-trellis.hf.space/api/predict';

  if (toggleTrellis) toggleTrellis.checked = enabled;
  if (inputTrellisKey) inputTrellisKey.value = apiKey;
  if (inputTrellisEndpoint) inputTrellisEndpoint.value = endpoint;

  if (enabled) {
    trellisConfig?.classList.remove('hidden');
  } else {
    trellisConfig?.classList.add('hidden');
  }
}

// History loading & rendering
const historyList = document.getElementById('history-list');
const btnClearHistory = document.getElementById('btn-clear-history');

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('voxel_history') || '[]');
  } catch (_) {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem('voxel_history', JSON.stringify(history.slice(0, 20))); // Limit to last 20
}

window.getCurrentModelGLBBase64 = function() {
  return new Promise((resolve) => {
    const model = window.VoxelViewport?.getCurrentModel();
    if (!model) return resolve(null);
    const exporter = new THREE.GLTFExporter();
    exporter.parse(model, (gltf) => {
      const blob = new Blob([gltf], { type: 'model/gltf-binary' });
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    }, (err) => {
      console.error(err);
      resolve(null);
    }, { binary: true });
  });
};

window.addHistoryItem = async function({ type, description }) {
  const history = getHistory();
  const id = Date.now();
  const timestamp = new Date().toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  
  let fileUrl = null;
  const modelData = await window.getCurrentModelGLBBase64();
  if (modelData) {
    try {
      // Save GLB locally using server API
      const response = await fetch('/api/save-history-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, modelData })
      });
      if (response.ok) {
        const data = await response.json();
        fileUrl = data.url;
      }
    } catch (e) {
      console.error('Failed to save model to local history folder:', e);
    }
  }

  history.unshift({ id, type, description, timestamp, fileUrl });
  saveHistory(history);
  renderHistory();
};

function renderHistory() {
  if (!historyList) return;
  const history = getHistory();
  if (history.length === 0) {
    historyList.innerHTML = `<div class="empty-history-text" style="color: var(--text-muted); text-align: center; padding: 12px; font-size: 12px;">אין פריטים בהיסטוריה</div>`;
    return;
  }

  const typeEmojis = {
    'create': '🎨',
    'edit': '🛠️',
    'blend': '🔀',
    'avatar': '👤'
  };

  const typeNames = {
    'create': 'יצירה',
    'edit': 'עריכה',
    'blend': 'מיזוג',
    'avatar': 'קריקטורה'
  };

  historyList.innerHTML = history.map(item => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-item-header">
        <span class="history-item-title">${typeEmojis[item.type] || '📦'} ${typeNames[item.type] || 'מודל'}</span>
        <span class="history-item-time">${item.timestamp}</span>
      </div>
      <div class="history-item-body">${item.description}</div>
      <div class="history-item-actions">
        ${item.fileUrl ? `<button class="history-item-btn" onclick="loadHistoryModel('${item.fileUrl}')">טען מודל</button>` : ''}
        <button class="history-item-btn" style="border-color:rgba(236,72,153,0.15);color:var(--accent-pink);" onclick="deleteHistoryItem(${item.id})">מחק</button>
      </div>
    </div>
  `).join('');
}

window.loadHistoryModel = async function(url) {
  showToast('טוען מודל מההיסטוריה...', 'info');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    const buffer = await response.arrayBuffer();
    const obj = await window.VoxelLoaders.loadFromBuffer(buffer, 'model.glb');
    window.VoxelViewport.loadModel(obj);
    showToast('המודל מההיסטוריה נטען בהצלחה!', 'success');
  } catch (err) {
    showToast('שגיאה בטעינת המודל מההיסטוריה: ' + err.message, 'error');
  }
};

window.deleteHistoryItem = function(id) {
  const history = getHistory().filter(item => item.id !== id);
  saveHistory(history);
  renderHistory();
  showToast('פריט נמחק מההיסטוריה', 'info');
};

btnClearHistory?.addEventListener('click', () => {
  if (confirm('האם אתה בטוח שברצונך למחוק את כל ההיסטוריה?')) {
    saveHistory([]);
    renderHistory();
    showToast('כל ההיסטוריה נמחקה', 'success');
  }
});

// ── INIT ──────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  // Check AI status periodically
  window.VoxelGenerator.checkAIStatus();
  setInterval(() => window.VoxelGenerator.checkAIStatus(), 15000);

  // Init UI state
  updateCreateUI();
  
  // Load settings & history
  loadTrellisSettings();
  renderHistory();

  console.log('🚀 VoxelAI Studio initialized');
});
