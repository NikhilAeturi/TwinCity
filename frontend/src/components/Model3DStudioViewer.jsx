import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCcw, Play, Pause, Eye, Box, Compass } from 'lucide-react';

export default function Model3DStudioViewer({ model }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [loading, setLoading] = useState(true);

  const sceneRef = useRef(null);
  const modelGroupRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const initialCamPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !model?.src) return;

    setLoading(true);
    const width = mount.clientWidth || 380;
    const height = mount.clientHeight || 180;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    // 4. Studio Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    fillLight.position.set(-4, 2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // Subtle studio grid ground
    const grid = new THREE.GridHelper(8, 16, 0x10b981, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // 5. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = 1.0;
    controls.maxDistance = 15.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't flip below floor
    controlsRef.current = controls;

    // 6. Load GLTF Model
    const loader = new GLTFLoader();
    const resolvedSrc = typeof window !== 'undefined' && window.location
      ? new URL(model.src, window.location.origin).href
      : model.src;

    let isDisposed = false;

    loader.load(
      resolvedSrc,
      (gltf) => {
        if (isDisposed) return;
        const loadedGroup = gltf.scene;

        loadedGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry?.attributes?.color && child.material) {
              child.material.vertexColors = true;
            }
            if (child.material) {
              child.material.wireframe = isWireframe;
              child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.4);
              child.material.metalness = Math.max(child.material.metalness ?? 0.2, 0.4);
              child.material.needsUpdate = true;
            }
          }
        });

        // Center on floor
        const box = new THREE.Box3().setFromObject(loadedGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        loadedGroup.position.x = -center.x;
        loadedGroup.position.y = -box.min.y;
        loadedGroup.position.z = -center.z;

        const group = new THREE.Group();
        group.add(loadedGroup);
        scene.add(group);
        modelGroupRef.current = group;

        // Position camera
        const maxDim = Math.max(size.x, size.y, size.z, 1.0);
        const fovRad = (camera.fov * Math.PI) / 180;
        let dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.45;
        if (dist < 1.6) dist = 1.6;

        camera.position.set(dist * 0.9, dist * 0.55, dist * 0.95);
        camera.lookAt(0, size.y * 0.45, 0);
        controls.target.set(0, size.y * 0.45, 0);
        controls.update();

        initialCamPosRef.current.copy(camera.position);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.warn('Model3DStudioViewer load error:', err);
        setLoading(false);
      }
    );

    // 7. Render Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (modelGroupRef.current && autoRotate) {
        modelGroupRef.current.rotation.y += 0.008;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount && renderer.domElement) {
        mount.innerHTML = '';
      }
    };
  }, [model?.id, model?.src]);

  // Update wireframe mode dynamically
  useEffect(() => {
    if (modelGroupRef.current) {
      modelGroupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = isWireframe;
          child.material.needsUpdate = true;
        }
      });
    }
  }, [isWireframe]);

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current && modelGroupRef.current) {
      modelGroupRef.current.rotation.set(0, 0, 0);
      cameraRef.current.position.copy(initialCamPosRef.current);
      controlsRef.current.update();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '180px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(16, 185, 129, 0.12) 0%, rgba(8, 14, 28, 0.95) 75%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.6)'
      }}
    >
      {/* 3D Canvas Mount */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8, 14, 28, 0.85)',
            gap: '8px',
            color: '#94a3b8',
            fontSize: '0.72rem',
            fontFamily: 'monospace'
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid rgba(16, 185, 129, 0.2)',
              borderTopColor: '#10b981',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <span>Rendering 3D Studio Preview...</span>
        </div>
      )}

      {/* Dimensions & Category Tag Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none'
        }}
      >
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontFamily: 'monospace'
          }}
        >
          3D STUDIO INSPECTOR
        </span>
        {model?.dimensions && (
          <span
            style={{
              fontSize: '0.60rem',
              color: '#94a3b8',
              background: 'rgba(0,0,0,0.6)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}
          >
            {model.dimensions.length}m × {model.dimensions.width}m × {model.dimensions.height}m
          </span>
        )}
      </div>

      {/* Controls Overlay in Bottom Right */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px'
        }}
      >
        <button
          onClick={() => setAutoRotate(prev => !prev)}
          title={autoRotate ? 'Pause 360° Turntable' : 'Play 360° Turntable'}
          style={{
            background: autoRotate ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.75)',
            border: autoRotate ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
            color: autoRotate ? '#34d399' : '#94a3b8',
            borderRadius: '6px',
            padding: '4px 6px',
            fontSize: '0.62rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          {autoRotate ? <Pause size={10} /> : <Play size={10} />}
          <span>360°</span>
        </button>

        <button
          onClick={() => setIsWireframe(prev => !prev)}
          title="Toggle Wireframe"
          style={{
            background: isWireframe ? 'rgba(6, 182, 212, 0.25)' : 'rgba(15, 23, 42, 0.75)',
            border: isWireframe ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
            color: isWireframe ? '#38bdf8' : '#94a3b8',
            borderRadius: '6px',
            padding: '4px 6px',
            fontSize: '0.62rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <Eye size={10} />
          <span>Wire</span>
        </button>

        <button
          onClick={handleResetCamera}
          title="Reset Camera Angle"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: '4px 6px',
            fontSize: '0.62rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <RotateCcw size={10} />
        </button>
      </div>

      {/* Drag instruction chip */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          fontSize: '0.58rem',
          color: '#64748b',
          pointerEvents: 'none'
        }}
      >
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
