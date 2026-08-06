/**
 * print-splitter.js
 * Smart 3D Print splitter:
 *  - Checks if model fits in print bed (no split needed)
 *  - If not, splits along optimal axis planes into min number of parts
 *  - Optionally adds alignment pins (cylinders) at cut faces
 *  - Generates slicer recommendations
 */

window.VoxelPrintSplitter = (function() {

  const PIN_RADIUS = 0.025; // normalized units (~2.5% of model)
  const PIN_HEIGHT = 0.08;
  const PIN_MARGIN = 0.15;  // margin from edge

  /**
   * Main entry point.
   * @param {THREE.Object3D} model  — the loaded model (normalized 0-2 scale)
   * @param {number} bedX  — bed X in mm
   * @param {number} bedY  — bed Y in mm
   * @param {number} bedZ  — bed Z in mm
   * @param {boolean} addPins
   * @param {boolean} minimizeCuts
   * @returns {object} result with parts array, recommendations, fits flag
   */
  function analyze(model, bedX, bedY, bedZ, addPins, minimizeCuts) {
    if (!model) return { error: 'אין מודל טעון' };

    // Get real bounding box
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());

    // Model is normalized to ~2 units. We treat 1 unit = 100mm for display.
    // Map normalized size to mm (user sets bed in mm)
    // We scale model real-world: assume 1 Three.js unit = 100mm for analysis
    const scale = 100; // 1 unit = 100mm
    const modelMM = {
      x: size.x * scale,
      y: size.y * scale,
      z: size.z * scale
    };

    const fits = modelMM.x <= bedX && modelMM.y <= bedY && modelMM.z <= bedZ;

    if (fits) {
      return {
        fits: true,
        parts: [{ id: 1, label: 'מודל שלם — נכנס במשטח', color: '#10b981', bbox: bbox }],
        recommendations: buildRecommendations(modelMM, { x: bedX, y: bedY, z: bedZ }, 1),
        splitAxis: null,
        splitCount: 1
      };
    }

    // Need to split
    // Determine which axis(es) are too large
    const overX = modelMM.x > bedX;
    const overY = modelMM.y > bedY;
    const overZ = modelMM.z > bedZ;

    // Find optimal split axis (largest overflow)
    const overflows = [
      { axis: 'x', ratio: modelMM.x / bedX, label: 'X (רוחב)' },
      { axis: 'y', ratio: modelMM.y / bedY, label: 'Y (גובה)' },
      { axis: 'z', ratio: modelMM.z / bedZ, label: 'Z (עומק)' }
    ].filter(o => o.ratio > 1).sort((a, b) => b.ratio - a.ratio);

    const primaryAxis = overflows[0]?.axis || 'x';
    const primaryRatio = overflows[0]?.ratio || 1;

    // Calculate minimum number of parts
    const splitCount = Math.ceil(primaryRatio);
    const actualSplits = minimizeCuts ? splitCount : splitCount;

    // Build visual split parts (bounding box regions)
    const parts = buildSplitParts(bbox, primaryAxis, actualSplits, model, scale, { x: bedX, y: bedY, z: bedZ });

    // Add pins if requested
    const pins = addPins ? buildPins(bbox, primaryAxis, actualSplits, parts) : [];

    return {
      fits: false,
      parts,
      pins,
      splitAxis: primaryAxis,
      splitCount: actualSplits,
      overflows,
      recommendations: buildRecommendations(modelMM, { x: bedX, y: bedY, z: bedZ }, actualSplits),
      modelSizeMM: modelMM
    };
  }

  function buildSplitParts(bbox, axis, count, model, scale, bed) {
    const min = bbox.min.clone();
    const max = bbox.max.clone();
    const totalLen = max[axis] - min[axis];
    const partLen = totalLen / count;
    const parts = [];
    const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < count; i++) {
      const partMin = min.clone();
      const partMax = max.clone();
      partMin[axis] = min[axis] + i * partLen;
      partMax[axis] = min[axis] + (i + 1) * partLen;

      const partSize = partMax.clone().sub(partMin);
      const partSizeMM = { x: partSize.x * scale, y: partSize.y * scale, z: partSize.z * scale };

      parts.push({
        id: i + 1,
        label: `חלק ${i + 1}`,
        color: colors[i % colors.length],
        min: partMin,
        max: partMax,
        sizeMM: partSizeMM,
        fitsInBed: partSizeMM.x <= bed.x && partSizeMM.y <= bed.y && partSizeMM.z <= bed.z
      });
    }
    return parts;
  }

  function buildPins(bbox, axis, count, parts) {
    const pins = [];
    // Place pins at each cut plane
    for (let i = 1; i < count; i++) {
      const cutPos = parts[i - 1].max.clone();
      // Multiple pin positions at cut face (2x2 grid)
      const perp1 = axis === 'x' ? 'y' : 'x';
      const perp2 = axis === 'z' ? 'y' : 'z';
      const center1 = (bbox.min[perp1] + bbox.max[perp1]) / 2;
      const center2 = (bbox.min[perp2] + bbox.max[perp2]) / 2;
      const span1 = (bbox.max[perp1] - bbox.min[perp1]) * 0.3;
      const span2 = (bbox.max[perp2] - bbox.min[perp2]) * 0.3;

      const positions = [
        [center1 + span1, center2 + span2],
        [center1 - span1, center2 + span2],
        [center1 + span1, center2 - span2],
        [center1 - span1, center2 - span2]
      ];

      positions.forEach(([p1, p2]) => {
        const pos = new THREE.Vector3();
        pos[axis] = cutPos[axis];
        pos[perp1] = p1;
        pos[perp2] = p2;
        pins.push({
          position: pos,
          axis,
          cutIndex: i
        });
      });
    }
    return pins;
  }

  /**
   * Render split visualization on the THREE scene
   */
  function visualizeSplit(result, viewport) {
    const scene = viewport.getScene();

    // Remove old split helpers
    const toRemove = [];
    scene.traverse(obj => { if (obj.userData.isSplitHelper) toRemove.push(obj); });
    toRemove.forEach(obj => scene.remove(obj));

    if (result.fits || !result.parts || result.parts.length <= 1) return;

    const { parts, pins } = result;

    // Draw cut planes
    parts.forEach((part, idx) => {
      if (idx === 0) return; // Skip first — show cut between part[0] and part[1]
      const plane = part.min;
      const axis = result.splitAxis;

      // Create a translucent plane at cut
      const size1 = axis === 'x' ? (parts[0].max.z - parts[0].min.z) : (parts[0].max.x - parts[0].min.x);
      const size2 = axis === 'y' ? (parts[0].max.z - parts[0].min.z) : (parts[0].max.y - parts[0].min.y);

      const planeGeo = new THREE.PlaneGeometry(Math.max(size1, 0.1) * 1.1, Math.max(size2, 0.1) * 1.1);
      const planeMat = new THREE.MeshBasicMaterial({
        color: part.color,
        transparent: true, opacity: 0.15,
        side: THREE.DoubleSide
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.userData.isSplitHelper = true;

      if (axis === 'x') planeMesh.rotation.y = Math.PI / 2;
      else if (axis === 'z') planeMesh.rotation.x = Math.PI / 2;

      planeMesh.position.copy(plane.clone().lerp(parts[idx - 1].max, 0.5));
      scene.add(planeMesh);

      // Wireframe border line
      const edges = new THREE.EdgesGeometry(planeGeo);
      const edgeMat = new THREE.LineBasicMaterial({ color: part.color, linewidth: 2 });
      const edgeLine = new THREE.LineSegments(edges, edgeMat);
      edgeLine.userData.isSplitHelper = true;
      edgeLine.rotation.copy(planeMesh.rotation);
      edgeLine.position.copy(planeMesh.position);
      scene.add(edgeLine);
    });

    // Draw pins
    if (pins) {
      pins.forEach(pin => {
        const geo = new THREE.CylinderGeometry(PIN_RADIUS, PIN_RADIUS, PIN_HEIGHT, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.isSplitHelper = true;
        mesh.position.copy(pin.position);
        if (pin.axis === 'x') mesh.rotation.z = Math.PI / 2;
        else if (pin.axis === 'z') mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
      });
    }
  }

  function clearSplitVisualization(viewport) {
    const scene = viewport.getScene();
    const toRemove = [];
    scene.traverse(obj => { if (obj.userData.isSplitHelper) toRemove.push(obj); });
    toRemove.forEach(obj => scene.remove(obj));
  }

  /**
   * Build slicer recommendations based on geometry and bed
   */
  function buildRecommendations(modelMM, bed, partCount) {
    const maxDim = Math.max(modelMM.x, modelMM.y, modelMM.z);
    const volume = modelMM.x * modelMM.y * modelMM.z;

    // Layer height: larger model → thicker layers ok
    const layerHeight = maxDim > 200 ? '0.2mm' : maxDim > 80 ? '0.15mm' : '0.12mm';

    // Infill
    const infill = volume > 500000 ? '10–15%' : volume > 100000 ? '20%' : '25–30%';

    // Support
    const needsSupport = modelMM.y > modelMM.x * 1.5 || modelMM.y > modelMM.z * 1.5;
    const support = needsSupport ? 'מומלץ — Tree Supports בלבד' : 'לא נדרש';

    // Print orientation
    const tallAxis = Object.entries(modelMM).sort((a,b)=>b[1]-a[1])[0][0];
    const orientationTip = tallAxis === 'y'
      ? 'הדפס כשהציר הגבוה עומד — צמצם שכבות'
      : `הטה על ציר ${tallAxis} לצמצום תלויות`;

    // Wall thickness
    const walls = maxDim > 150 ? '2–3 קירות' : '3–4 קירות';

    // Tolerance for pins (if split)
    const pinTolerance = partCount > 1
      ? '0.2mm – התאם ב-Slicer לפינים (Male -0.1mm, Female +0.1mm)'
      : null;

    // Print speed
    const speed = maxDim > 200 ? '60–80mm/s' : '40–60mm/s';

    return {
      layerHeight,
      infill,
      support,
      orientationTip,
      walls,
      pinTolerance,
      speed,
      partCount,
      fitNote: partCount === 1
        ? '✅ המודל נכנס שלם — ללא חיתוך!'
        : `🔪 נחלק ל-${partCount} חלקים — ייצא כ-ZIP עם קבצי STL נפרדים`
    };
  }

  /**
   * Render recommendations into the UI panel
   */
  function renderRecommendationsUI(recs) {
    const panel = document.getElementById('slicer-recs');
    const content = document.getElementById('slicer-content');
    if (!panel || !content) return;

    const rows = [
      { key: 'גובה שכבה', val: recs.layerHeight },
      { key: 'אחוז מילוי', val: recs.infill },
      { key: 'קירות', val: recs.walls },
      { key: 'מהירות הדפסה', val: recs.speed },
      { key: 'תמיכות', val: recs.support },
      { key: 'כיוון הדפסה', val: recs.orientationTip },
      recs.pinTolerance ? { key: 'טולרנס פינים', val: recs.pinTolerance } : null
    ].filter(Boolean);

    content.innerHTML = rows.map(r => `
      <div class="slicer-row">
        <span class="slicer-key">${r.key}</span>
        <span class="slicer-val">${r.val}</span>
      </div>
    `).join('') + `<div class="slicer-note">${recs.fitNote}</div>`;

    panel.classList.remove('hidden');
  }

  /**
   * Render result overlay panel
   */
  function renderResultPanel(result) {
    const panel = document.getElementById('print-result-panel');
    const content = document.getElementById('print-result-content');
    if (!panel || !content) return;

    if (result.fits) {
      content.innerHTML = `
        <div class="print-result-header">✅ המודל נכנס שלם</div>
        <div class="print-part"><span class="part-num" style="background:#10b981">1</span>
          <span class="part-info">אין צורך בחיתוך</span>
        </div>`;
    } else {
      content.innerHTML = `
        <div class="print-result-header">🔪 ${result.splitCount} חלקים</div>
        ${result.parts.map(p => `
          <div class="print-part">
            <span class="part-num" style="background:${p.color}">${p.id}</span>
            <div>
              <div class="part-info">${p.label}</div>
              <div class="part-size">${Math.round(p.sizeMM.x)}×${Math.round(p.sizeMM.y)}×${Math.round(p.sizeMM.z)} mm</div>
            </div>
            <span style="color:${p.fitsInBed?'#10b981':'#ec4899'};font-size:10px">${p.fitsInBed?'✓':'⚠'}</span>
          </div>`).join('')}`;
    }
    panel.classList.remove('hidden');
  }

  return { analyze, visualizeSplit, clearSplitVisualization, renderRecommendationsUI, renderResultPanel };
})();
