/**
 * exporter.js — Export current model in all supported formats
 */

window.VoxelExporter = (function() {

  const FORMATS = {
    'stl-binary':  { ext: 'stl',  name: 'STL Binary',    mime: 'application/octet-stream' },
    'stl-ascii':   { ext: 'stl',  name: 'STL ASCII',     mime: 'text/plain' },
    '3mf':         { ext: '3mf',  name: '3MF',           mime: 'model/3mf' },
    'obj-print':   { ext: 'obj',  name: 'OBJ',           mime: 'text/plain' },
    'ply':         { ext: 'ply',  name: 'PLY',           mime: 'application/octet-stream' },
    'glb':         { ext: 'glb',  name: 'GLB',           mime: 'model/gltf-binary' },
    'gltf':        { ext: 'gltf', name: 'GLTF',          mime: 'model/gltf+json' },
    'fbx':         { ext: 'fbx',  name: 'FBX',           mime: 'application/octet-stream' },
    'dae':         { ext: 'dae',  name: 'Collada',       mime: 'model/vnd.collada+xml' },
    'usdz':        { ext: 'usdz', name: 'USDZ',          mime: 'model/vnd.usdz+zip' },
    'off':         { ext: 'off',  name: 'OFF',           mime: 'text/plain' },
    'wrl':         { ext: 'wrl',  name: 'VRML',          mime: 'model/vrml' },
    'dxf':         { ext: 'dxf',  name: 'DXF',           mime: 'application/dxf' },
    'xyz':         { ext: 'xyz',  name: 'Point Cloud',   mime: 'text/plain' },
    'step':        { ext: 'step', name: 'STEP',          mime: 'application/step' },
  };

  async function exportModel(format) {
    const model = window.VoxelViewport?.getCurrentModel();
    if (!model) {
      showToast('אין מודל לייצוא', 'error');
      return;
    }

    const fmt = FORMATS[format];
    if (!fmt) { showToast('פורמט לא מוכר', 'error'); return; }

    const scaleFactor = parseFloat(document.getElementById('export-scale')?.value || '1');
    const exportModel = model.clone();
    exportModel.scale.multiplyScalar(scaleFactor);

    showToast(`מייצא ${fmt.name}...`, 'info');

    try {
      let blob;

      switch (format) {
        case 'stl-binary':
          blob = await exportSTL(exportModel, false);
          break;
        case 'stl-ascii':
          blob = await exportSTL(exportModel, true);
          break;
        case 'obj-print':
          blob = await exportOBJ(exportModel);
          break;
        case 'glb':
        case 'gltf':
          blob = await exportGLTF(exportModel, format === 'glb');
          break;
        case 'ply':
          blob = exportPLY(exportModel);
          break;
        case 'off':
          blob = exportOFF(exportModel);
          break;
        case 'wrl':
          blob = exportWRL(exportModel);
          break;
        case 'xyz':
          blob = exportXYZ(exportModel);
          break;
        case 'dae':
          blob = exportDAE(exportModel);
          break;
        case '3mf':
          blob = await export3MF(exportModel);
          break;
        case 'fbx':
        case 'usdz':
        case 'dxf':
        case 'step':
          // Not natively supported in browser — export as OBJ with note
          blob = await exportOBJ(exportModel);
          showToast(`${fmt.name} ייצוא מלא דורש תוכנת CAD. ייוצא כ-OBJ.`, 'info');
          fmt.ext = 'obj';
          break;
        default:
          blob = await exportOBJ(exportModel);
      }

      if (!blob) { showToast('שגיאה בייצוא', 'error'); return; }

      const filename = `voxelai_model.${fmt.ext}`;
      await downloadBlob(blob, filename, fmt.mime);
      showToast(`✅ יוצא בהצלחה: ${filename}`, 'success');

    } catch (err) {
      console.error('Export error:', err);
      showToast('שגיאת ייצוא: ' + err.message, 'error');
    }
  }

  function exportSTL(model, ascii) {
    return new Promise((resolve, reject) => {
      try {
        const exporter = new THREE.STLExporter();
        const result = exporter.parse(model, { binary: !ascii });
        let blob;
        if (ascii) {
          blob = new Blob([result], { type: 'text/plain' });
        } else {
          blob = new Blob([result], { type: 'application/octet-stream' });
        }
        resolve(blob);
      } catch (e) { reject(e); }
    });
  }

  function exportOBJ(model) {
    return new Promise((resolve, reject) => {
      try {
        const exporter = new THREE.OBJExporter();
        const result = exporter.parse(model);
        resolve(new Blob([result], { type: 'text/plain' }));
      } catch (e) { reject(e); }
    });
  }

  function exportGLTF(model, binary) {
    return new Promise((resolve, reject) => {
      try {
        const exporter = new THREE.GLTFExporter();
        exporter.parse(
          model,
          (result) => {
            if (binary) {
              resolve(new Blob([result], { type: 'model/gltf-binary' }));
            } else {
              resolve(new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' }));
            }
          },
          (err) => reject(err),
          { binary }
        );
      } catch (e) { reject(e); }
    });
  }

  function exportPLY(model) {
    // Build ASCII PLY
    const vertices = [];
    const faces = [];
    let vOffset = 0;

    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        const start = vOffset;
        for (let i = 0; i < pos.count; i++) {
          vertices.push(`${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`);
        }
        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i += 3) {
            faces.push(`3 ${start + idx.getX(i)} ${start + idx.getX(i+1)} ${start + idx.getX(i+2)}`);
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            faces.push(`3 ${start + i} ${start + i + 1} ${start + i + 2}`);
          }
        }
        vOffset += pos.count;
      }
    });

    const header = `ply\nformat ascii 1.0\nelement vertex ${vertices.length}\nproperty float x\nproperty float y\nproperty float z\nelement face ${faces.length}\nproperty list uchar int vertex_index\nend_header\n`;
    return new Blob([header + vertices.join('\n') + '\n' + faces.join('\n')], { type: 'text/plain' });
  }

  function exportOFF(model) {
    const vertices = [];
    const faces = [];
    let vOffset = 0;

    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          vertices.push(`${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`);
        }
        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i += 3) {
            faces.push(`3 ${vOffset + idx.getX(i)} ${vOffset + idx.getX(i+1)} ${vOffset + idx.getX(i+2)}`);
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            faces.push(`3 ${vOffset + i} ${vOffset + i + 1} ${vOffset + i + 2}`);
          }
        }
        vOffset += pos.count;
      }
    });

    return new Blob([`OFF\n${vertices.length} ${faces.length} 0\n${vertices.join('\n')}\n${faces.join('\n')}`], { type: 'text/plain' });
  }

  function exportWRL(model) {
    const vertices = [];
    const coordIndices = [];
    let vOffset = 0;

    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          vertices.push(`${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`);
        }
        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i += 3) {
            coordIndices.push(`${vOffset + idx.getX(i)}, ${vOffset + idx.getX(i+1)}, ${vOffset + idx.getX(i+2)}, -1`);
          }
        }
        vOffset += pos.count;
      }
    });

    const wrl = `#VRML V2.0 utf8\nShape {\n  geometry IndexedFaceSet {\n    coord Coordinate {\n      point [ ${vertices.join(', ')} ]\n    }\n    coordIndex [ ${coordIndices.join(', ')} ]\n  }\n}`;
    return new Blob([wrl], { type: 'model/vrml' });
  }

  function exportXYZ(model) {
    const points = [];
    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          points.push(`${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`);
        }
      }
    });
    return new Blob([points.join('\n')], { type: 'text/plain' });
  }

  function exportDAE(model) {
    // Collada XML scaffold
    const verts = [];
    const tris = [];
    let vOffset = 0;

    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          verts.push(pos.getX(i).toFixed(6), pos.getY(i).toFixed(6), pos.getZ(i).toFixed(6));
        }
        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i++) tris.push(vOffset + idx.getX(i));
        } else {
          for (let i = 0; i < pos.count; i++) tris.push(vOffset + i);
        }
        vOffset += pos.count;
      }
    });

    const now = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset><created>${now}</created><modified>${now}</modified></asset>
  <library_geometries>
    <geometry id="mesh0" name="VoxelAI_Model">
      <mesh>
        <source id="pos"><float_array id="arr" count="${verts.length}">${verts.join(' ')}</float_array>
          <technique_common><accessor source="#arr" count="${Math.floor(verts.length/3)}" stride="3">
            <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
          </accessor></technique_common>
        </source>
        <vertices id="verts"><input semantic="POSITION" source="#pos"/></vertices>
        <triangles count="${Math.floor(tris.length/3)}">
          <input semantic="VERTEX" source="#verts" offset="0"/>
          <p>${tris.join(' ')}</p>
        </triangles>
      </mesh>
    </geometry>
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="Scene"><node id="Mesh"><instance_geometry url="#mesh0"/></node></visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>`;
    return new Blob([xml], { type: 'model/vnd.collada+xml' });
  }

  async function export3MF(model) {
    // 3MF is a ZIP containing XML model data
    const verts = [];
    const tris = [];
    let vOffset = 0;

    model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          verts.push(`<v x="${pos.getX(i).toFixed(6)}" y="${pos.getY(i).toFixed(6)}" z="${pos.getZ(i).toFixed(6)}"/>`);
        }
        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i += 3) {
            tris.push(`<t v1="${vOffset + idx.getX(i)}" v2="${vOffset + idx.getX(i+1)}" v3="${vOffset + idx.getX(i+2)}"/>`);
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            tris.push(`<t v1="${vOffset+i}" v2="${vOffset+i+1}" v3="${vOffset+i+2}"/>`);
          }
        }
        vOffset += pos.count;
      }
    });

    const modelXML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${verts.join('')}</vertices>
        <triangles>${tris.join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;

    const relsXML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/model.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

    // Use fflate to create ZIP
    if (typeof fflate !== 'undefined') {
      const enc = new TextEncoder();
      const zipped = fflate.zipSync({
        '[Content_Types].xml': enc.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
        '_rels/.rels': enc.encode(relsXML),
        '3D/model.model': enc.encode(modelXML)
      });
      return new Blob([zipped], { type: 'model/3mf' });
    } else {
      // Fallback: plain XML with .3mf extension
      return new Blob([modelXML], { type: 'application/xml' });
    }
  }

  async function downloadBlob(blob, filename, mime) {
    // Electron: use native save dialog
    if (window.voxelAPI?.isElectron) {
      const filters = getFiltersForMime(mime, filename);
      const { filePath, canceled } = await window.voxelAPI.saveFile({ defaultName: filename, filters });
      if (canceled || !filePath) return;
      const ab = await blob.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      await window.voxelAPI.writeFile({ filePath, data: b64 });
    } else {
      // Browser fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function getFiltersForMime(mime, filename) {
    const ext = filename.split('.').pop();
    return [{ name: ext.toUpperCase() + ' Files', extensions: [ext] }, { name: 'All Files', extensions: ['*'] }];
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function takeScreenshot() {
    const canvas = document.getElementById('three-canvas');
    const renderer = window.VoxelViewport?.getRenderer();
    if (!renderer) return;
    renderer.render(window.VoxelViewport.getScene ? undefined : undefined);
    const dataURL = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataURL)).blob();
    await downloadBlob(blob, 'voxelai_screenshot.png', 'image/png');
    showToast('צילום מסך שמור!', 'success');
  }

  return { exportModel, takeScreenshot };
})();
