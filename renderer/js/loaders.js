/**
 * loaders.js — 3D file loading from ArrayBuffer via Three.js loaders
 * Supports: GLB/GLTF, OBJ, STL, PLY, DAE, FBX (where available)
 */

window.VoxelLoaders = (function() {
  /**
   * Load a 3D file by extension from an ArrayBuffer
   * Returns Promise<THREE.Object3D>
   */
  function loadFromBuffer(buffer, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return new Promise((resolve, reject) => {
      try {
        switch (ext) {
          case 'glb':
          case 'gltf':
            loadGLTF(buffer, ext, resolve, reject);
            break;
          case 'obj':
            loadOBJ(buffer, resolve, reject);
            break;
          case 'stl':
            loadSTL(buffer, resolve, reject);
            break;
          case 'ply':
            loadPLY(buffer, resolve, reject);
            break;
          default:
            // Generic fallback: try as binary GLB
            loadGLTF(buffer, 'glb', resolve, (err) => {
              reject(new Error(`פורמט לא נתמך ישירות: .${ext}. ניתן לייבא דרך Blender.`));
            });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  function loadGLTF(buffer, ext, resolve, reject) {
    const loader = new THREE.GLTFLoader();
    try {
      if (ext === 'glb') {
        loader.parse(buffer, '', gltf => resolve(gltf.scene), reject);
      } else {
        const text = new TextDecoder().decode(buffer);
        loader.parse(text, '', gltf => resolve(gltf.scene), reject);
      }
    } catch (e) { reject(e); }
  }

  function loadOBJ(buffer, resolve, reject) {
    try {
      const text = new TextDecoder().decode(buffer);
      const loader = new THREE.OBJLoader();
      const obj = loader.parse(text);
      // Apply default material if meshes lack it
      obj.traverse(child => {
        if (child.isMesh && !child.material) {
          child.material = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.2, roughness: 0.6 });
        }
      });
      resolve(obj);
    } catch (e) { reject(e); }
  }

  function loadSTL(buffer, resolve, reject) {
    try {
      const loader = new THREE.STLLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: 0x8090b0, metalness: 0.15, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true;
      resolve(mesh);
    } catch (e) { reject(e); }
  }

  function loadPLY(buffer, resolve, reject) {
    try {
      const loader = new THREE.PLYLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();
      let mat;
      if (geometry.hasAttribute('color')) {
        mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.8 });
      } else {
        mat = new THREE.MeshStandardMaterial({ color: 0x7788aa, metalness: 0.1, roughness: 0.7 });
      }
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true;
      resolve(mesh);
    } catch (e) { reject(e); }
  }

  /**
   * Load from a File object (drag & drop or input)
   */
  function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        loadFromBuffer(e.target.result, file.name)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Load from base64 string
   */
  function loadFromBase64(base64, filename) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return loadFromBuffer(bytes.buffer, filename);
  }

  return { loadFromFile, loadFromBuffer, loadFromBase64 };
})();
