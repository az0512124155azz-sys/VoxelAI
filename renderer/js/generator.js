/**
 * generator.js — AI generation request handler
 * Connects to local AI endpoints or shows offline placeholder
 */

window.VoxelGenerator = (function() {

  async function checkAIStatus() {
    const indicator = document.getElementById('ai-indicator');
    const statusText = document.getElementById('ai-status-text');
    const endpoints = [
      { url: 'http://localhost:8080/health', name: 'Tripo3D Local' },
      { url: 'http://localhost:5000/health', name: 'Shap-E' },
      { url: 'http://localhost:7860/health', name: 'InstantMesh' },
      { url: 'http://127.0.0.1:3791/api/health', name: 'VoxelAI Server' }
    ];

    let connected = false;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep.url, { signal: AbortSignal.timeout(1500) });
        if (r.ok) {
          indicator.className = 'online';
          statusText.textContent = ep.name;
          connected = true;
          break;
        }
      } catch (_) {}
    }

    if (!connected) {
      indicator.className = 'offline';
      statusText.textContent = 'מצב לא מקוון';
    }
  }

  function showGenerationOverlay(message = 'מייצר מודל 3D...') {
    const overlay = document.getElementById('generation-overlay');
    const text = document.getElementById('gen-status-text');
    const bar = document.getElementById('gen-progress-bar');
    overlay.classList.remove('hidden');
    text.textContent = message;
    bar.style.width = '0%';
    return { overlay, text, bar };
  }

  function hideGenerationOverlay() {
    document.getElementById('generation-overlay').classList.add('hidden');
  }

  function animateProgress(bar, durationMs) {
    let start = null;
    return new Promise(resolve => {
      function step(ts) {
        if (!start) start = ts;
        const pct = Math.min(((ts - start) / durationMs) * 90, 90);
        bar.style.width = pct + '%';
        if (pct < 90) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  /**
   * Generate 3D from prompt/images
   */
  async function generate({ mode, prompt, images }) {
    const { overlay, text, bar } = showGenerationOverlay(
      mode === 'text-only' ? 'ממיר טקסט למודל 3D...' :
      mode === 'single-image' ? 'ממיר תמונה למודל 3D...' :
      'מעבד תמונות ומייצר מודל...'
    );

    const progressPromise = animateProgress(bar, 8000);

    try {
      const formData = new FormData();
      formData.append('mode', mode);
      if (prompt) formData.append('prompt', prompt);
      if (images) {
        Array.from(images).forEach((img, i) => formData.append(`image_${i}`, img));
      }

      let result;
      const trellisEnabled = localStorage.getItem('trellis_enabled') === 'true';
      const trellisKey = localStorage.getItem('trellis_api_key');
      const trellisEndpoint = localStorage.getItem('trellis_endpoint') || 'https://jeffreyxiang-trellis.hf.space/api/predict';

      if (trellisEnabled && trellisKey) {
        text.textContent = 'מתחבר ל-Trellis 2.0 API...';
        try {
          const base64Images = images ? await imagesToBase64Array(images) : [];
          const resp = await fetch(trellisEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${trellisKey}`
            },
            body: JSON.stringify({
              mode,
              prompt,
              images: base64Images
            }),
            signal: AbortSignal.timeout(120000)
          });
          if (resp.ok) {
            result = await resp.json();
          } else {
            throw new Error(`שרת Trellis השיב בשגיאה: ${resp.status} ${resp.statusText}`);
          }
        } catch (err) {
          showToast('שגיאה ב-Trellis API: ' + err.message, 'error');
          result = { offline: true, mode };
        }
      } else {
        try {
          const resp = await fetch('/api/generate-3d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode,
              prompt,
              images: images ? await imagesToBase64Array(images) : []
            }),
            signal: AbortSignal.timeout(60000)
          });
          result = await resp.json();
        } catch (_) {
          result = { offline: true, mode };
        }
      }

      bar.style.width = '100%';
      await new Promise(r => setTimeout(r, 300));

      if (result.offline || result.modelType === 'placeholder') {
        // Show placeholder mesh
        const mesh = window.VoxelViewport.createPlaceholderMesh(
          mode === 'avatar' || mode === 'caricature' ? 'avatar' : 'placeholder'
        );
        window.VoxelViewport.loadModel(mesh);
        showToast('מצב לא מקוון — מוצג מודל דמה. חבר AI מקומי לתוצאות אמיתיות.', 'info');
        if (window.addHistoryItem) {
          window.addHistoryItem({
            type: 'create',
            description: prompt ? `יצירת מודל (דמה): "${prompt}"` : `יצירת מודל (דמה) ממצב ${mode}`
          });
        }
        return { success: true, offline: true };
      }

      if (result.glbData) {
        const obj = await window.VoxelLoaders.loadFromBase64(result.glbData, 'model.glb');
        window.VoxelViewport.loadModel(obj);
        showToast('מודל נוצר בהצלחה!', 'success');
        if (window.addHistoryItem) {
          window.addHistoryItem({
            type: 'create',
            description: prompt ? `יצירת מודל AI: "${prompt}"` : `יצירת מודל AI ממצב ${mode}`
          });
        }
        return { success: true };
      }

      // Fallback placeholder
      window.VoxelViewport.loadModel(window.VoxelViewport.createPlaceholderMesh());
      showToast('AI הפיק תגובה — מוצג מודל דמה', 'info');
      if (window.addHistoryItem) {
        window.addHistoryItem({
          type: 'create',
          description: prompt ? `יצירת מודל (דמה): "${prompt}"` : `יצירת מודל (דמה) ממצב ${mode}`
        });
      }
      return { success: true, offline: true };

    } catch (err) {
      showToast('שגיאה ביצירה: ' + err.message, 'error');
      return { success: false, error: err.message };
    } finally {
      hideGenerationOverlay();
    }
  }

  /**
   * Generate avatar/caricature
   */
  async function generateAvatar({ imageFile, style, subject, extras }) {
    const { bar } = showGenerationOverlay('מייצר קריקטורה 3D...');
    animateProgress(bar, 10000);

    await new Promise(r => setTimeout(r, 2000)); // simulate

    bar.style.width = '100%';
    await new Promise(r => setTimeout(r, 200));
    hideGenerationOverlay();

    const mesh = window.VoxelViewport.createPlaceholderMesh('avatar');
    // Apply style-based color tint
    const styleColors = {
      pixar: 0x4488ff, anime: 0xff88cc, lowpoly: 0x44ffcc,
      clay: 0xee9944, cyberpunk: 0x00ffff, chibi: 0xff99ff,
      realistic: 0xccaa88, toon: 0xffcc00
    };
    mesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.color.set(styleColors[style] || 0x7c3aed);
      }
    });
    window.VoxelViewport.loadModel(mesh);
    showToast(`קריקטורה ${style} נוצרה! (מצב דמה — חבר AI לתוצאות מלאות)`, 'info');
    if (window.addHistoryItem) {
      window.addHistoryItem({
        type: 'avatar',
        description: `קריקטורה בסגנון ${style} (${subject}) ${extras ? ' - ' + extras : ''}`
      });
    }
    return { success: true };
  }

  /**
   * Edit existing model with prompt
   */
  async function editModel({ editType, prompt, strength }) {
    const model = window.VoxelViewport.getCurrentModel();
    if (!model) {
      showToast('אין מודל טעון לעריכה', 'error');
      return { success: false };
    }

    const { bar } = showGenerationOverlay('מחיל שינויים AI...');
    animateProgress(bar, 5000);

    await new Promise(r => setTimeout(r, 2500));

    // Apply simple visual change for demo
    const factor = strength / 100;
    if (editType === 'color' || editType === 'texture') {
      const hue = Math.random();
      model.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.color.setHSL(hue, 0.7, 0.5);
          child.material.needsUpdate = true;
        }
      });
    } else if (editType === 'deform' || editType === 'geometry') {
      model.traverse(child => {
        if (child.isMesh && child.geometry && child.geometry.attributes.position) {
          const pos = child.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            pos.setY(i, pos.getY(i) * (1 + factor * 0.3 * (Math.random() - 0.5)));
          }
          pos.needsUpdate = true;
          child.geometry.computeVertexNormals();
        }
      });
    } else if (editType === 'style') {
      model.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.wireframe = factor > 0.5;
          child.material.metalness = factor;
          child.material.roughness = 1 - factor * 0.5;
          child.material.needsUpdate = true;
        }
      });
    }

    bar.style.width = '100%';
    await new Promise(r => setTimeout(r, 200));
    hideGenerationOverlay();

    showToast('שינויים הוחלו (מצב דמה — AI עריכה מלאה דורש חיבור)', 'info');
    if (window.addHistoryItem) {
      window.addHistoryItem({
        type: 'edit',
        description: `עריכה בסגנון ${editType} בעוצמה ${strength}% ${prompt ? ' - ' + prompt : ''}`
      });
    }
    return { success: true };
  }

  /**
   * Blend two models
   */
  async function blendModels({ modelA, modelB, ratio, prompt, blendTypes }) {
    if (!modelA || !modelB) {
      showToast('יש להעלות שני מודלים למיזוג', 'error');
      return { success: false };
    }
    const { bar } = showGenerationOverlay('ממזג מודלים...');
    animateProgress(bar, 7000);

    await new Promise(r => setTimeout(r, 3000));
    bar.style.width = '100%';
    await new Promise(r => setTimeout(r, 200));
    hideGenerationOverlay();

    // For demo: merge geometries visually
    const merged = new THREE.Group();
    const aClone = modelA.clone();
    const bClone = modelB.clone();

    aClone.position.x = -0.5;
    bClone.position.x = 0.5;

    const rFactor = ratio / 100;
    aClone.scale.multiplyScalar(1 - rFactor * 0.4);
    bClone.scale.multiplyScalar(rFactor * 0.9 + 0.1);
    bClone.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.opacity = rFactor;
        c.material.transparent = rFactor < 1;
      }
    });

    merged.add(aClone);
    merged.add(bClone);

    window.VoxelViewport.loadModel(merged);
    showToast('מיזוג הושלם! (מצב דמה — AI מיזוג מלא דורש חיבור)', 'info');
    if (window.addHistoryItem) {
      window.addHistoryItem({
        type: 'blend',
        description: `מיזוג מודלים ביחס ${ratio}/${100-ratio} ${prompt ? ' - ' + prompt : ''}`
      });
    }
    return { success: true };
  }

  async function imagesToBase64Array(files) {
    return Promise.all([...files].map(f =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      })
    ));
  }

  return { checkAIStatus, generate, generateAvatar, editModel, blendModels };
})();
