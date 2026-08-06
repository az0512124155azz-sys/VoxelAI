/**
 * viewport.js — Three.js 3D scene, camera, lighting, controls
 */

// Wait until Three.js loads via CDN
window.addEventListener('DOMContentLoaded', () => {
  window.VoxelViewport = (function() {
    const canvas = document.getElementById('three-canvas');
    const emptyState = document.getElementById('viewport-empty');

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.01, 10000);
    camera.position.set(0, 1.5, 4);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.01;
    controls.maxDistance = 5000;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x8888cc, 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 8, 5);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7c3aed, 0.4);
    dirLight2.position.set(-5, 3, -5);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.3);
    rimLight.position.set(0, -5, -3);
    scene.add(rimLight);

    // Grid
    const grid = new THREE.GridHelper(20, 40, 0x2a2a4a, 0x1a1a30);
    grid.position.y = -0.001;
    scene.add(grid);

    // State
    let currentModel = null;
    let isWireframe = false;
    let showGrid = true;
    let modelBoundingBox = null;

    // ── Model loading ──────────────────────────────────────
    function clearModel() {
      if (currentModel) {
        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
        modelBoundingBox = null;
        document.getElementById('info-verts').textContent = '—';
        document.getElementById('info-faces').textContent = '—';
        document.getElementById('info-dims').textContent = '—';
      }
    }

    function loadModel(object3d, fitCamera = true) {
      clearModel();
      currentModel = object3d;

      // Normalize: center and scale to ~2 units tall
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      currentModel.scale.multiplyScalar(scale);
      currentModel.position.sub(center.multiplyScalar(scale));
      currentModel.position.y += size.y * scale / 2;

      // Compute bounding box post-transform
      const scaledBox = new THREE.Box3().setFromObject(currentModel);
      modelBoundingBox = scaledBox;

      scene.add(currentModel);
      emptyState.style.display = 'none';

      // Stats
      let verts = 0, faces = 0;
      currentModel.traverse(child => {
        if (child.isMesh && child.geometry) {
          const pos = child.geometry.attributes.position;
          if (pos) verts += pos.count;
          const idx = child.geometry.index;
          faces += idx ? idx.count / 3 : pos.count / 3;
        }
      });
      document.getElementById('info-verts').textContent = verts.toLocaleString();
      document.getElementById('info-faces').textContent = Math.round(faces).toLocaleString();

      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      document.getElementById('info-dims').textContent =
        `${scaledSize.x.toFixed(2)} × ${scaledSize.y.toFixed(2)} × ${scaledSize.z.toFixed(2)}`;

      if (fitCamera) fitCameraToModel();
      applyWireframe(isWireframe);
    }

    function fitCameraToModel() {
      if (!currentModel) return;
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const dist = Math.max(size.x, size.y, size.z) * 2;
      camera.position.set(center.x, center.y + size.y * 0.5, center.z + dist);
      controls.target.copy(center);
      controls.update();
    }

    function applyWireframe(enable) {
      isWireframe = enable;
      if (!currentModel) return;
      currentModel.traverse(child => {
        if (child.isMesh) {
          child.material.wireframe = enable;
        }
      });
    }

    function disposeObject(obj) {
      obj.traverse(child => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material?.dispose();
        }
      });
    }

    // ── Viewport toolbar events ────────────────────────────
    document.getElementById('vp-wireframe').addEventListener('click', function() {
      this.classList.toggle('active');
      applyWireframe(!isWireframe);
    });

    document.getElementById('vp-reset-cam').addEventListener('click', () => {
      if (currentModel) fitCameraToModel();
      else {
        camera.position.set(0, 1.5, 4);
        controls.target.set(0, 0, 0);
        controls.update();
      }
    });

    document.getElementById('vp-grid').addEventListener('click', function() {
      this.classList.toggle('active');
      showGrid = !showGrid;
      grid.visible = showGrid;
    });

    document.getElementById('vp-orbit').addEventListener('click', function() {
      this.classList.add('active');
    });

    // Environment presets
    document.getElementById('env-select').addEventListener('change', function() {
      switch (this.value) {
        case 'studio':
          scene.background = new THREE.Color(0x050510);
          ambientLight.color.set(0x8888cc); ambientLight.intensity = 0.5;
          dirLight1.color.set(0xffffff); dirLight1.intensity = 1.2;
          dirLight2.color.set(0x7c3aed); dirLight2.intensity = 0.4;
          rimLight.color.set(0x06b6d4); rimLight.intensity = 0.3;
          break;
        case 'outdoor':
          scene.background = new THREE.Color(0x1a2040);
          ambientLight.color.set(0xaabbff); ambientLight.intensity = 0.8;
          dirLight1.color.set(0xfff5e0); dirLight1.intensity = 1.5;
          dirLight2.color.set(0x4466ff); dirLight2.intensity = 0.3;
          rimLight.intensity = 0.1;
          break;
        case 'dark':
          scene.background = new THREE.Color(0x000008);
          ambientLight.intensity = 0.2;
          dirLight1.color.set(0xff00ff); dirLight1.intensity = 0.8;
          dirLight2.color.set(0x00ffff); dirLight2.intensity = 0.6;
          rimLight.color.set(0xff006e); rimLight.intensity = 0.5;
          break;
        case 'warm':
          scene.background = new THREE.Color(0x1a0f05);
          ambientLight.color.set(0xffcc88); ambientLight.intensity = 0.6;
          dirLight1.color.set(0xffa050); dirLight1.intensity = 1.2;
          dirLight2.color.set(0xff6030); dirLight2.intensity = 0.4;
          rimLight.color.set(0xff8020); rimLight.intensity = 0.3;
          break;
      }
    });

    // ── Resize observer ────────────────────────────────────
    new ResizeObserver(() => {
      const vp = document.getElementById('viewport-area');
      const w = vp.clientWidth, h = vp.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }).observe(document.getElementById('viewport-area'));

    // ── Render loop ────────────────────────────────────────
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ── Create placeholder shape ───────────────────────────
    function createPlaceholderMesh(label = 'placeholder') {
      const geo = label === 'avatar'
        ? new THREE.SphereGeometry(1, 64, 64)
        : label === 'blend'
        ? new THREE.TorusKnotGeometry(0.8, 0.25, 128, 16)
        : new THREE.IcosahedronGeometry(1, 3);

      const mat = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        metalness: 0.4,
        roughness: 0.3,
        envMapIntensity: 1.0
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // ── Expose API ─────────────────────────────────────────
    return {
      loadModel,
      clearModel,
      createPlaceholderMesh,
      getScene: () => scene,
      getCamera: () => camera,
      getRenderer: () => renderer,
      getCurrentModel: () => currentModel,
      getModelBoundingBox: () => modelBoundingBox,
      fitCameraToModel,
      showEmpty: () => { emptyState.style.display = ''; },
      hideEmpty: () => { emptyState.style.display = 'none'; }
    };
  })();
});
