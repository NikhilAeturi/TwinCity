import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Global cache for rendered thumbnails: modelId -> dataUrl
const thumbnailCache = new Map();
const inProgressRequests = new Map();

// Check if static thumbnail exists or was cached
function getStoredThumbnail(modelId) {
  if (thumbnailCache.has(modelId)) {
    return thumbnailCache.get(modelId);
  }
  try {
    const session = sessionStorage.getItem(`rt_thumb_v3_${modelId}`);
    if (session) {
      thumbnailCache.set(modelId, session);
      return session;
    }
  } catch (e) {
    // Session storage unavailable
  }
  return null;
}

// Stylized visual previews tailored to each model as instant fallbacks
export const MODEL_VISUAL_PREVIEWS = {
  vehicle_sedan: {
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)',
    iconType: 'sedan',
    badge: 'AERO SEDAN'
  },
  vehicle_suv: {
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
    iconType: 'suv',
    badge: 'TACTICAL 4X4'
  },
  vehicle_sportscar: {
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
    iconType: 'sportscar',
    badge: 'GT SUPERCAR'
  },
  vehicle_truck: {
    color: '#e2e8f0',
    gradient: 'linear-gradient(135deg, #334155 0%, #64748b 100%)',
    iconType: 'truck',
    badge: 'LOGISTICS BOX'
  },
  vehicle_police: {
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
    iconType: 'police',
    badge: 'INTERCEPTOR'
  },
  humanoid_pedestrian: {
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    iconType: 'humanoid',
    badge: '29-DoF BIPED'
  },
  robot_expressive: {
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    iconType: 'rover',
    badge: 'MOBILE ROVER'
  },
  drone_quadcopter: {
    color: '#c084fc',
    gradient: 'linear-gradient(135deg, #581c87 0%, #9333ea 100%)',
    iconType: 'drone',
    badge: 'AERIAL UAV'
  },
  prop_barrier: {
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
    iconType: 'barrier',
    badge: 'CRASH BARRIER'
  },
  prop_traffic_light: {
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
    iconType: 'traffic_light',
    badge: 'SIGNAL MAST'
  },
  prop_traffic_cone: {
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    iconType: 'cone',
    badge: 'SAFETY PYLON'
  },
  prop_delivery_crate: {
    color: '#d97706',
    gradient: 'linear-gradient(135deg, #451a03 0%, #b45309 100%)',
    iconType: 'crate',
    badge: 'CARGO CRATE'
  },
  prop_debris_cluster: {
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #b91c1c 100%)',
    iconType: 'debris',
    badge: 'DEBRIS SCATTER'
  }
};

/**
 * Singleton Offscreen WebGL Renderer
 * Reuses a single canvas to avoid browser WebGL context limits.
 */
class OffscreenThumbnailRenderer {
  constructor() {
    this.width = 360;
    this.height = 240;
    this.loader = new GLTFLoader();
    this.queue = [];
    this.isProcessing = false;
    this.initRenderer();
  }

  initRenderer() {
    if (typeof window === 'undefined') return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.35;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.warn('WebGL offscreen renderer init note:', e);
      this.renderer = null;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.1, 100);

    // Studio lighting rig
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4.5, 6.0, 5.0);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 1.4);
    fillLight.position.set(-4.5, 3.0, 2.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    rimLight.position.set(0, 5.0, -5.0);
    this.scene.add(rimLight);

    const bounceLight = new THREE.DirectionalLight(0x10b981, 0.8);
    bounceLight.position.set(0, -4.0, 1.0);
    this.scene.add(bounceLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambientLight);
  }

  enqueue(modelId, src, category) {
    const cached = getStoredThumbnail(modelId);
    if (cached) {
      return Promise.resolve(cached);
    }

    if (inProgressRequests.has(modelId)) {
      return inProgressRequests.get(modelId);
    }

    const promise = new Promise((resolve) => {
      this.queue.push({ modelId, src, category, resolve });
      this.processNext();
    });

    inProgressRequests.set(modelId, promise);
    return promise;
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0 || !this.renderer) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();

    try {
      const dataUrl = await this.renderModel(task.modelId, task.src, task.category);
      if (dataUrl) {
        thumbnailCache.set(task.modelId, dataUrl);
        try {
          sessionStorage.setItem(`rt_thumb_v3_${task.modelId}`, dataUrl);
        } catch (e) {}

        // Optionally persist to server in background
        this.saveToServer(task.modelId, dataUrl);
      }
      task.resolve(dataUrl);
    } catch (err) {
      console.warn(`Render thumbnail failed for ${task.modelId}:`, err);
      task.resolve(null);
    } finally {
      inProgressRequests.delete(task.modelId);
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 20);
    }
  }

  saveToServer(modelId, dataUrl) {
    if (typeof fetch !== 'function') return;
    fetch('http://localhost:8000/api/assets/save_thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: modelId, image_base64: dataUrl })
    }).catch(() => {});
  }

  renderModel(modelId, src, category) {
    return new Promise((resolve, reject) => {
      const resolvedSrc = typeof window !== 'undefined' && window.location
        ? new URL(src, window.location.origin).href
        : src;

      this.loader.load(
        resolvedSrc,
        (gltf) => {
          const model = gltf.scene;

          // Material enhancement for automotive / robot luster
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.geometry && child.geometry.attributes.color) {
                if (child.material) {
                  child.material.vertexColors = true;
                }
              }

              if (child.material) {
                child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.4);
                child.material.metalness = Math.max(child.material.metalness ?? 0.2, 0.45);
                child.material.needsUpdate = true;
              }
            }
          });

          // Center model and sit on ground plane
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          model.position.x = -center.x;
          model.position.y = -box.min.y;
          model.position.z = -center.z;

          // Add a soft contact shadow disc beneath the model
          const maxFootprint = Math.max(size.x, size.z, 0.6);
          const shadowGeo = new THREE.PlaneGeometry(maxFootprint * 1.4, maxFootprint * 1.4);
          const shadowCanvas = document.createElement('canvas');
          shadowCanvas.width = 128;
          shadowCanvas.height = 128;
          const ctx = shadowCanvas.getContext('2d');
          const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
          grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 128, 128);
          const shadowTex = new THREE.CanvasTexture(shadowCanvas);

          const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
          });
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.position.y = 0.005;

          const renderGroup = new THREE.Group();
          renderGroup.add(shadowMesh);
          renderGroup.add(model);
          this.scene.add(renderGroup);

          // Calculate ideal beauty camera angle
          const maxDim = Math.max(size.x, size.y, size.z, 1.0);
          const fovRad = (this.camera.fov * Math.PI) / 180;
          let dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.38;
          if (dist < 1.6) dist = 1.6;

          // Studio camera positioning
          let camX = dist * 0.88;
          let camY = dist * 0.52;
          let camZ = dist * 0.98;
          let lookY = size.y * 0.44;

          if (category === 'character' || category === 'robot' || size.y > size.x * 1.4) {
            // Standing robot / mast: eye-level beauty shot
            camX = dist * 0.72;
            camY = dist * 0.38;
            camZ = dist * 1.15;
            lookY = size.y * 0.52;
          } else if (category === 'drone') {
            // Quadcopter: elevated angle to view 4 rotors
            camX = dist * 0.78;
            camY = dist * 0.82;
            camZ = dist * 0.88;
            lookY = size.y * 0.3;
          } else if (category === 'vehicle') {
            // Vehicle: 3/4 dynamic front quarter view
            camX = dist * 0.92;
            camY = dist * 0.48;
            camZ = dist * 0.95;
            lookY = size.y * 0.38;
          }

          this.camera.position.set(camX, camY, camZ);
          this.camera.lookAt(0, lookY, 0);

          // Render
          this.renderer.render(this.scene, this.camera);
          const dataUrl = this.canvas.toDataURL('image/png');

          // Cleanup scene
          this.scene.remove(renderGroup);
          shadowGeo.dispose();
          shadowMat.dispose();
          shadowTex.dispose();

          resolve(dataUrl);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
}

// Global renderer instance
let globalRenderer = null;
function getRenderer() {
  if (!globalRenderer && typeof window !== 'undefined') {
    globalRenderer = new OffscreenThumbnailRenderer();
  }
  return globalRenderer;
}

/**
 * Main export: Retrieves or renders a 3D model thumbnail data URL.
 */
export function getOrRenderModelThumbnail(modelId, src, category = 'vehicle') {
  const cached = getStoredThumbnail(modelId);
  if (cached) return Promise.resolve(cached);

  const renderer = getRenderer();
  if (!renderer) return Promise.resolve(null);

  return renderer.enqueue(modelId, src, category);
}
