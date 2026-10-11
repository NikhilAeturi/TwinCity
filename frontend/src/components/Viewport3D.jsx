import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Layers, Eye, Box, Compass, Sparkles, RefreshCw,
  Maximize2, Grid, CheckCircle2, Sliders, Bot, Armchair,
  Smartphone, DoorOpen, Monitor
} from 'lucide-react';

export default function Viewport3D({
  telemetry,
  sceneConfig,
  pointCloudData,
  showPointCloud = true,
  setShowPointCloud
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  // Mesh & point cloud refs
  const solidMeshRef = useRef(null);
  const wireframeMeshRef = useRef(null);
  const pointCloudMeshRef = useRef(null);
  const roomBoundingBoxRef = useRef(null);

  // Digital Twin, Architectural & Humanoid dynamic groups
  const furnitureGroupRef = useRef(null);
  const robotGroupRef = useRef(null);
  const phoneGroupRef = useRef(null);
  const trajectoryLinesRef = useRef(null);

  // Viewport display states
  const [viewMode, setViewMode] = useState('SOLID'); // 'SOLID' | 'POINTS' | 'WIREFRAME' | 'HYBRID'
  const [showRoomBounds, setShowRoomBounds] = useState(true);
  const [showRobot, setShowRobot] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [pointSize, setPointSize] = useState(0.022);
  const [roomMetrics, setRoomMetrics] = useState(null);
  const [renderedFurniture, setRenderedFurniture] = useState({ table: false, chairs: false, doors: false });
  const [meshStats, setMeshStats] = useState({ vertices: 0, triangles: 0, points: 0 });

  // 1. Initialize Three.js Studio Scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || mount.offsetWidth || window.innerWidth || 800;
    const height = mount.clientHeight || mount.offsetHeight || window.innerHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06090e);
    scene.fog = new THREE.FogExp2(0x06090e, 0.012);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);
    camera.position.set(0.0, 1.8, 3.2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0.0, 0.9, 0.0); // Center target onto robot
    controlsRef.current = controls;

    // Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.4);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2, 6, -1);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00d2ff, 0.7);
    fillLight.position.set(-3, 3, 2);
    scene.add(fillLight);

    const warmAccentLight = new THREE.PointLight(0xffeedd, 1.4, 8);
    warmAccentLight.position.set(1.3, 2.2, 0.0);
    scene.add(warmAccentLight);

    // Architectural Ground Grid
    const gridHelper = new THREE.GridHelper(16, 32, 0x00d2ff, 0x1e293b);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // Architectural Ground Plane for shadow reception & floor ambient reflection
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f18,
      roughness: 0.85,
      metalness: 0.15
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.002;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Digital Twin Groups
    const furnitureGroup = new THREE.Group();
    scene.add(furnitureGroup);
    furnitureGroupRef.current = furnitureGroup;

    const robotGroup = new THREE.Group();
    scene.add(robotGroup);
    robotGroupRef.current = robotGroup;

    const phoneGroup = new THREE.Group();
    scene.add(phoneGroup);
    phoneGroupRef.current = phoneGroup;

    const trajectoryGroup = new THREE.Group();
    scene.add(trajectoryGroup);
    trajectoryLinesRef.current = trajectoryGroup;

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler with ResizeObserver support
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || mount.offsetWidth || window.innerWidth || 800;
      const h = mount.clientHeight || mount.offsetHeight || window.innerHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Synchronize Clean 3D Architectural Enclosure and AR Landmark Point Cloud
  // (NOTE: Completely eliminates raw warped single-photo billboard curtains!)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !pointCloudData) return;

    if (solidMeshRef.current) {
      scene.remove(solidMeshRef.current);
      if (solidMeshRef.current.geometry) solidMeshRef.current.geometry.dispose();
      if (solidMeshRef.current.material) solidMeshRef.current.material.dispose();
      solidMeshRef.current = null;
    }
    if (wireframeMeshRef.current) {
      scene.remove(wireframeMeshRef.current);
      if (wireframeMeshRef.current.geometry) wireframeMeshRef.current.geometry.dispose();
      if (wireframeMeshRef.current.material) wireframeMeshRef.current.material.dispose();
      wireframeMeshRef.current = null;
    }
    if (pointCloudMeshRef.current) {
      scene.remove(pointCloudMeshRef.current);
      if (pointCloudMeshRef.current.geometry) pointCloudMeshRef.current.geometry.dispose();
      if (pointCloudMeshRef.current.material) pointCloudMeshRef.current.material.dispose();
      pointCloudMeshRef.current = null;
    }
    if (roomBoundingBoxRef.current) {
      scene.remove(roomBoundingBoxRef.current);
      roomBoundingBoxRef.current = null;
    }

    const positions = pointCloudData.positions || [];
    const colors = pointCloudData.colors || [];
    const dims = pointCloudData.room_dimensions || {};

    // Only construct scanned floor mesh and room dimensions when points exist
    if (positions.length > 0) {
      if (dims.width) setRoomMetrics(dims);

      const roomW = dims.width || 4.8;
      const roomD = dims.depth || 4.8;
      const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111722,
        roughness: 0.75,
        metalness: 0.2
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, 0.001, 0);
      floorMesh.receiveShadow = true;
      floorMesh.visible = (viewMode === 'SOLID' || viewMode === 'HYBRID');
      scene.add(floorMesh);
      solidMeshRef.current = floorMesh;

      const pCount = Math.floor(positions.length / 3);
      const threePos = new Float32Array(positions.length);
      const threeCols = new Float32Array(positions.length);

      for (let i = 0; i < pCount; i++) {
        threePos[i * 3 + 0] = positions[i * 3 + 0];
        threePos[i * 3 + 1] = positions[i * 3 + 2]; // Z up -> Y in Three.js
        threePos[i * 3 + 2] = positions[i * 3 + 1]; // Y forward -> Z in Three.js

        if (colors.length >= (i + 1) * 3) {
          threeCols[i * 3 + 0] = colors[i * 3 + 0];
          threeCols[i * 3 + 1] = colors[i * 3 + 1];
          threeCols[i * 3 + 2] = colors[i * 3 + 2];
        } else {
          threeCols[i * 3 + 0] = 0.0;
          threeCols[i * 3 + 1] = 0.85;
          threeCols[i * 3 + 2] = 1.0;
        }
      }

      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(threePos, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(threeCols, 3));

      const pMat = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
      });
      const pMesh = new THREE.Points(pGeo, pMat);
      pMesh.visible = (viewMode === 'POINTS' || viewMode === 'HYBRID');
      scene.add(pMesh);
      pointCloudMeshRef.current = pMesh;

      setMeshStats({
        vertices: pCount,
        triangles: 2,
        points: pCount
      });

      if (dims.min_bounds && dims.max_bounds) {
        const minB = dims.min_bounds;
        const maxB = dims.max_bounds;
        const box = new THREE.Box3(
          new THREE.Vector3(minB[0], 0.0, minB[1]),
          new THREE.Vector3(maxB[0], roomH, maxB[1])
        );
        const boxHelper = new THREE.Box3Helper(box, 0x00d2ff);
        boxHelper.visible = showRoomBounds;
        scene.add(boxHelper);
        roomBoundingBoxRef.current = boxHelper;
      }
    }
  }, [pointCloudData, viewMode, showRoomBounds, pointSize]);

  // 3. Render 3D CAD Digital Twin Models (Table, Ergonomic Chairs, Doors, Monitors, Phone Indicator)
  useEffect(() => {
    const furnitureGroup = furnitureGroupRef.current;
    const trajectoryGroup = trajectoryLinesRef.current;
    const phoneGroup = phoneGroupRef.current;
    if (!furnitureGroup || !trajectoryGroup || !phoneGroup) return;

    // Clear prior children
    while (furnitureGroup.children.length > 0) {
      const child = furnitureGroup.children[0];
      furnitureGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }
    while (trajectoryGroup.children.length > 0) {
      const child = trajectoryGroup.children[0];
      trajectoryGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    while (phoneGroup.children.length > 0) {
      const child = phoneGroup.children[0];
      phoneGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    if (!showFurniture) return;

    const objects = telemetry?.objects || {};
    const sceneObjs = sceneConfig?.objects || [];
    const spatialAnchors = telemetry?.spatial_anchors || [];

    // Materials
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x483524,
      roughness: 0.35,
      metalness: 0.12
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.3,
      metalness: 0.75
    });
    const chairCushionMat = new THREE.MeshStandardMaterial({
      color: 0x222832,
      roughness: 0.45,
      metalness: 0.15
    });
    const chairBackMat = new THREE.MeshStandardMaterial({
      color: 0x1a212b,
      roughness: 0.35,
      metalness: 0.25
    });
    const doorWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5c4028,
      roughness: 0.4,
      metalness: 0.1
    });
    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x242a35,
      roughness: 0.5,
      metalness: 0.4
    });
    const chromeHandleMat = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8,
      roughness: 0.2,
      metalness: 0.95
    });
    const monitorScreenMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x001a33,
      emissiveIntensity: 0.4
    });

    // Helper: Build Compound CAD Table
    const buildTable = (pos, size, surfH, slots) => {
      const tPos = (Array.isArray(pos) && pos.length >= 2) ? pos : [1.35, 0.0];
      const tSize = (Array.isArray(size) && size.length >= 2) ? size : [0.65, 0.45];
      const tableGroup = new THREE.Group();
      tableGroup.position.set(tPos[0], 0, tPos[1]);

      const w = tSize[0] * 2.0;
      const d = tSize[1] * 2.0;
      const topTh = 0.05;
      const sHeight = typeof surfH === 'number' ? surfH : 0.74;
      const legH = sHeight - topTh;

      // Tabletop slab
      const topGeo = new THREE.BoxGeometry(w, topTh, d);
      const topMesh = new THREE.Mesh(topGeo, tableTopMat);
      topMesh.position.y = sHeight - topTh / 2.0;
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      tableGroup.add(topMesh);

      // Chamfer edge rim
      const edgeGeo = new THREE.BoxGeometry(w + 0.02, 0.015, d + 0.02);
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0x614833, roughness: 0.4 });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.position.y = sHeight - 0.01;
      tableGroup.add(edgeMesh);

      // Under-table metal frame apron
      const apronGeo = new THREE.BoxGeometry(w - 0.12, 0.03, d - 0.12);
      const apronMesh = new THREE.Mesh(apronGeo, darkMetalMat);
      apronMesh.position.y = sHeight - topTh - 0.015;
      tableGroup.add(apronMesh);

      // 4 Metal Cylindrical Legs with feet
      const legOx = tSize[0] - 0.08;
      const legOy = tSize[1] - 0.08;
      const legGeo = new THREE.CylinderGeometry(0.03, 0.025, legH, 16);
      [
        [legOx, legOy], [legOx, -legOy],
        [-legOx, legOy], [-legOx, -legOy]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, darkMetalMat);
        leg.position.set(lx, legH / 2.0, lz);
        leg.castShadow = true;
        tableGroup.add(leg);
      });

      // Target Tuck-in Slot Guides
      (slots || []).forEach((slot) => {
        const sPos = (Array.isArray(slot?.position) && slot.position.length >= 2)
          ? slot.position
          : [tPos[0], tPos[1]];
        const slotGuide = new THREE.Group();
        slotGuide.position.set(sPos[0], 0.005, sPos[1]);

        // Semi-transparent glowing footprint pad
        const padGeo = new THREE.PlaneGeometry(0.48, 0.48);
        const padMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.rotation.x = -Math.PI / 2;
        slotGuide.add(pad);

        // Dashed border outline
        const borderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.24, 0, -0.24),
          new THREE.Vector3(0.24, 0, -0.24),
          new THREE.Vector3(0.24, 0, 0.24),
          new THREE.Vector3(-0.24, 0, 0.24),
          new THREE.Vector3(-0.24, 0, -0.24)
        ]);
        const borderMat = new THREE.LineBasicMaterial({ color: 0x10b981 });
        const border = new THREE.Line(borderGeo, borderMat);
        slotGuide.add(border);

        furnitureGroup.add(slotGuide);
      });

      furnitureGroup.add(tableGroup);
    };

    // Helper: Build Ergonomic Office Chair
    const buildChair = (chairId, pos, quat, status, targetPos) => {
      const cPos = (Array.isArray(pos) && pos.length >= 2) ? pos : [1.0, 0.0];
      const chairGroup = new THREE.Group();
      chairGroup.position.set(cPos[0], 0.0, cPos[1]);

      const seatH = 0.42;
      const seatTh = 0.05;
      const seatW = 0.44;
      const seatD = 0.44;
      const backH = 0.42;

      // 5-Star Wheel Caster Base
      const starBase = new THREE.Group();
      starBase.position.y = 0.05;
      for (let i = 0; i < 5; i++) {
        const ang = (i * Math.PI * 2) / 5;
        const armGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.24, 8);
        const armMesh = new THREE.Mesh(armGeo, darkMetalMat);
        armMesh.rotation.z = Math.PI / 2;
        armMesh.rotation.y = ang;
        armMesh.position.set(Math.cos(ang) * 0.12, 0, Math.sin(ang) * 0.12);
        starBase.add(armMesh);

        // Wheel caster
        const wheelGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const wheelMesh = new THREE.Mesh(wheelGeo, darkMetalMat);
        wheelMesh.position.set(Math.cos(ang) * 0.24, -0.03, Math.sin(ang) * 0.24);
        starBase.add(wheelMesh);
      }
      chairGroup.add(starBase);

      // Central Pneumatic Gas Cylinder Column
      const colGeo = new THREE.CylinderGeometry(0.025, 0.028, seatH - 0.05, 16);
      const colMesh = new THREE.Mesh(colGeo, darkMetalMat);
      colMesh.position.y = (seatH - 0.05) / 2.0 + 0.05;
      chairGroup.add(colMesh);

      // Seat Cushion
      const seatGeo = new THREE.BoxGeometry(seatW, seatTh, seatD);
      const seatMesh = new THREE.Mesh(seatGeo, chairCushionMat);
      seatMesh.position.y = seatH - seatTh / 2.0;
      seatMesh.castShadow = true;
      chairGroup.add(seatMesh);

      // Ergonomic Curved Mesh Backrest
      const backGeo = new THREE.BoxGeometry(0.04, backH, seatD * 0.95);
      const backMesh = new THREE.Mesh(backGeo, chairBackMat);
      backMesh.position.set(-seatW / 2.0 + 0.02, seatH + backH / 2.0, 0);
      backMesh.castShadow = true;
      chairGroup.add(backMesh);

      // Armrests (Left & Right)
      [-seatD / 2.0 + 0.02, seatD / 2.0 - 0.02].forEach(az => {
        const armPostGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.20, 8);
        const armPost = new THREE.Mesh(armPostGeo, darkMetalMat);
        armPost.position.set(0, seatH + 0.10, az);
        chairGroup.add(armPost);

        const padGeo = new THREE.BoxGeometry(0.20, 0.02, 0.04);
        const pad = new THREE.Mesh(padGeo, chairCushionMat);
        pad.position.set(0, seatH + 0.20, az);
        chairGroup.add(pad);
      });

      // Status Floor Ring (Scattered = Amber, Tucked = Emerald)
      const isScattered = status === 'SCATTERED';
      const ringGeo = new THREE.RingGeometry(0.28, 0.31, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isScattered ? 0xf59e0b : 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.003;
      chairGroup.add(ringMesh);

      furnitureGroup.add(chairGroup);

      // Trajectory dashed guideline from chair to target slot if scattered
      if (isScattered && targetPos && Array.isArray(targetPos) && targetPos.length >= 2) {
        const p1 = new THREE.Vector3(cPos[0], 0.02, cPos[1]);
        const p2 = new THREE.Vector3(targetPos[0], 0.02, targetPos[1]);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x00d2ff,
          dashSize: 0.08,
          gapSize: 0.04,
          transparent: true,
          opacity: 0.85
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        trajectoryGroup.add(line);
      }
    };

    // Helper: Build Architectural Door & Frame
    const buildDoor = (pos, size, yaw, relativeTo) => {
      const dPos = (Array.isArray(pos) && pos.length >= 2) ? pos : [-1.6, 2.2];
      const dSize = (Array.isArray(size) && size.length >= 2) ? size : [0.95, 0.12, 2.10];
      const doorGroup = new THREE.Group();
      doorGroup.position.set(dPos[0], 0, dPos[1]);

      const dw = dSize[0] || 0.95;
      const dd = dSize[1] || 0.12;
      const dh = dSize[2] || 2.10;

      // Outer Left & Right Door Frame Jambs
      const postGeo = new THREE.BoxGeometry(0.06, dh, dd);
      const leftPost = new THREE.Mesh(postGeo, doorFrameMat);
      leftPost.position.set(-dw / 2.0, dh / 2.0, 0);
      doorGroup.add(leftPost);

      const rightPost = new THREE.Mesh(postGeo, doorFrameMat);
      rightPost.position.set(dw / 2.0, dh / 2.0, 0);
      doorGroup.add(rightPost);

      // Top Door Lintel Header
      const headerGeo = new THREE.BoxGeometry(dw + 0.12, 0.06, dd);
      const header = new THREE.Mesh(headerGeo, doorFrameMat);
      header.position.set(0, dh - 0.03, 0);
      doorGroup.add(header);

      // Wooden Door Panel (recessed inside frame)
      const panelGeo = new THREE.BoxGeometry(dw - 0.04, dh - 0.08, 0.04);
      const panel = new THREE.Mesh(panelGeo, doorWoodMat);
      panel.position.set(0, (dh - 0.08) / 2.0 + 0.02, 0);
      panel.castShadow = true;
      doorGroup.add(panel);

      // Metal Door Lever Handle
      const handleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12);
      const handle = new THREE.Mesh(handleGeo, chromeHandleMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(dw / 2.0 - 0.14, 1.0, 0.035);
      doorGroup.add(handle);

      furnitureGroup.add(doorGroup);

      // Holographic relative offset guideline from primary table
      const refPos = [1.35, 0.0];
      const p1 = new THREE.Vector3(refPos[0], 0.03, refPos[1]);
      const p2 = new THREE.Vector3(dPos[0], 0.03, dPos[1]);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 0.1,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.55
      });
      const relLine = new THREE.Line(lineGeo, lineMat);
      relLine.computeLineDistances();
      trajectoryGroup.add(relLine);
    };

    // Helper: Build Desktop Monitor Display
    const buildMonitor = (pos) => {
      const mPos = (Array.isArray(pos) && pos.length >= 2) ? pos : [1.35, 0.0];
      const monGroup = new THREE.Group();
      monGroup.position.set(mPos[0], 0.74, mPos[1]);

      // Stand Base & Stem
      const baseGeo = new THREE.BoxGeometry(0.22, 0.01, 0.18);
      const baseMesh = new THREE.Mesh(baseGeo, darkMetalMat);
      baseMesh.position.y = 0.005;
      monGroup.add(baseMesh);

      const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 12);
      const stemMesh = new THREE.Mesh(stemGeo, darkMetalMat);
      stemMesh.position.set(0, 0.11, -0.04);
      monGroup.add(stemMesh);

      // Screen Panel (Widescreen Display)
      const screenGeo = new THREE.BoxGeometry(0.52, 0.32, 0.02);
      const screenMesh = new THREE.Mesh(screenGeo, monitorScreenMat);
      screenMesh.position.set(0, 0.24, 0);
      monGroup.add(screenMesh);

      furnitureGroup.add(monGroup);
    };

    // Helper: Build Live 3D Smartphone Frustum Indicator
    const buildPhoneIndicator = (camPose, motionState) => {
      if (!camPose || !camPose.position) return;
      const cp = camPose.position;
      const rot = camPose.rotation || { yaw: 0, pitch: -22, roll: 0 };

      // Map perception world coordinates [X, Y, Z] to Three.js [X, Z_height, Y_depth]
      const px = cp[0];
      const py = Math.max(0.2, cp[2]); // height
      const pz = cp[1]; // depth into room

      const phoneIndicator = new THREE.Group();
      phoneIndicator.position.set(px, py, pz);

      // Phone Rotation
      phoneIndicator.rotation.y = THREE.MathUtils.degToRad(-rot.yaw || 0);
      phoneIndicator.rotation.x = THREE.MathUtils.degToRad(rot.pitch || -22);

      // Sleek 3D Smartphone Body
      const phoneGeo = new THREE.BoxGeometry(0.08, 0.16, 0.012);
      const phoneMat = new THREE.MeshStandardMaterial({
        color: 0x0a101d,
        metalness: 0.9,
        roughness: 0.2
      });
      const phoneBody = new THREE.Mesh(phoneGeo, phoneMat);
      phoneIndicator.add(phoneBody);

      // Glowing Screen
      const scrGeo = new THREE.PlaneGeometry(0.075, 0.15);
      const scrMat = new THREE.MeshBasicMaterial({
        color: motionState === 'STATIONARY' ? 0xf59e0b : 0x00d2ff,
        side: THREE.DoubleSide
      });
      const scrMesh = new THREE.Mesh(scrGeo, scrMat);
      scrMesh.position.z = 0.007;
      phoneIndicator.add(scrMesh);

      // Holographic Camera Frustum Pyramid (Viewing Field of View)
      const frustumLength = 0.9;
      const frustumW = 0.65;
      const frustumH = 0.45;
      const fPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-frustumW / 2, -frustumH / 2, -frustumLength),
        new THREE.Vector3(frustumW / 2, -frustumH / 2, -frustumLength),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(frustumW / 2, frustumH / 2, -frustumLength),
        new THREE.Vector3(-frustumW / 2, frustumH / 2, -frustumLength),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-frustumW / 2, -frustumH / 2, -frustumLength),
        new THREE.Vector3(-frustumW / 2, frustumH / 2, -frustumLength),
        new THREE.Vector3(frustumW / 2, frustumH / 2, -frustumLength),
        new THREE.Vector3(frustumW / 2, -frustumH / 2, -frustumLength)
      ];
      const fGeo = new THREE.BufferGeometry().setFromPoints(fPoints);
      const fMat = new THREE.LineBasicMaterial({
        color: motionState === 'STATIONARY' ? 0xf59e0b : 0x00d2ff,
        transparent: true,
        opacity: 0.65
      });
      const frustumMesh = new THREE.Line(fGeo, fMat);
      phoneIndicator.add(frustumMesh);

      phoneGroup.add(phoneIndicator);
    };

    // 1. Render Table (only if in scene or telemetry)
    let tableRendered = false;
    for (const [oid, obj] of Object.entries(objects)) {
      if (obj.geometry === 'compound_table' || obj.type === 'table') {
        buildTable(obj.pos || obj.position || [1.35, 0], obj.size || [0.65, 0.45], obj.surface_height || 0.74, obj.slots);
        tableRendered = true;
      }
    }
    if (!tableRendered) {
      for (const obj of sceneObjs) {
        if (obj.geometry === 'compound_table' || obj.type === 'table') {
          buildTable(obj.pos || obj.position || [1.35, 0], obj.size || [0.65, 0.45], obj.surface_height || 0.74, obj.slots);
          tableRendered = true;
        }
      }
    }

    // 2. Render Chairs (only if in scene or telemetry)
    let chairsRendered = false;
    for (const [oid, obj] of Object.entries(objects)) {
      if (obj.geometry === 'compound_chair' || obj.type === 'chair') {
        const cPos = obj.pos || obj.position || [1.0, 0.0];
        buildChair(oid, cPos, obj.quat, obj.status, obj.target_pos);
        chairsRendered = true;
      }
    }
    if (!chairsRendered) {
      for (const obj of sceneObjs) {
        if (obj.geometry === 'compound_chair' || obj.type === 'chair') {
          const cPos = obj.pos || obj.position || [1.0, 0.0];
          buildChair(obj.id || 'chair', cPos, obj.quat, obj.status, obj.target_pos);
          chairsRendered = true;
        }
      }
    }

    // 3. Render Architectural Doors (only if detected in scene)
    let doorsRendered = false;
    for (const obj of sceneObjs) {
      if (obj.geometry === 'door_frame' || obj.type === 'door') {
        buildDoor(obj.pos || obj.position || [-1.6, 2.2], obj.size || [0.95, 0.12, 2.1], obj.yaw);
        doorsRendered = true;
      }
    }
    // Also check spatial anchors from perception
    for (const anc of spatialAnchors) {
      if (anc.type === 'door') {
        buildDoor(anc.position, anc.size, anc.yaw, anc.relative_to);
        doorsRendered = true;
      } else if (anc.type === 'monitor') {
        buildMonitor(anc.position);
      }
    }

    setRenderedFurniture({ table: tableRendered, chairs: chairsRendered, doors: doorsRendered });

  }, [telemetry, sceneConfig, showFurniture]);

  // Humanoid robot and camera indicator disabled as requested
  useEffect(() => {
    const robotGroup = robotGroupRef.current;
    if (robotGroup) {
      while (robotGroup.children.length > 0) {
        const child = robotGroup.children[0];
        robotGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    }
    const phoneGroup = phoneGroupRef.current;
    if (phoneGroup) {
      while (phoneGroup.children.length > 0) {
        const child = phoneGroup.children[0];
        phoneGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    }
  }, []);

  // Camera presets
  const handleFocusCenter = () => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    controls.target.set(0.0, 0.0, 0.0);
    camera.position.set(0.0, 2.5, 3.5);
    controls.update();
  };

  const handleTopDownPlan = () => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    controls.target.set(0.0, 0.0, 0.0);
    camera.position.set(0.0, 6.0, 0.001);
    controls.update();
  };

  return (
    <div className="viewport-container" id="viewport-3d-root" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mountRef} className="canvas-3d" style={{ width: '100%', height: '100%' }} />

      {/* Top Floating HUD: Environment & Digital Twin Status */}
      <div style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        right: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        {/* Left: Reconstructed Environment Dimensions (only shown when roomMetrics exists) */}
        {roomMetrics && roomMetrics.width > 0 ? (
          <div style={{
            background: 'rgba(6, 11, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box size={16} color="#00d2ff" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
                ROOM DIGITAL TWIN
              </span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', color: '#94a3b8' }}>
              <span>W: <strong style={{ color: '#00d2ff' }}>{roomMetrics.width}m</strong></span>
              <span>D: <strong style={{ color: '#00d2ff' }}>{roomMetrics.depth}m</strong></span>
              <span>H: <strong style={{ color: '#00d2ff' }}>{roomMetrics.height}m</strong></span>
              <span>Area: <strong style={{ color: '#10b981' }}>{roomMetrics.floor_area_sqm} m²</strong></span>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(6, 11, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
          }}>
            <Box size={15} color="#64748b" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
              Awaiting Mobile Room Scan
            </span>
          </div>
        )}

        {/* Center: Live Phone Odometry Status */}
        {telemetry?.camera_pose && (
          <div style={{
            background: 'rgba(6, 11, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${telemetry.is_stationary ? 'rgba(245, 158, 11, 0.5)' : 'rgba(0, 210, 255, 0.4)'}`,
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
          }}>
            <Smartphone size={15} color={telemetry.is_stationary ? '#f59e0b' : '#00d2ff'} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: telemetry.is_stationary ? '#f59e0b' : '#00d2ff' }}>
              {telemetry.is_stationary ? 'PHONE STATIONARY (LOCKED)' : 'LIVE PHONE TRACKING'}
            </span>
            {telemetry.camera_pose?.position && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                [{telemetry.camera_pose.position[0]}, {telemetry.camera_pose.position[1]}, {telemetry.camera_pose.position[2]}]
              </span>
            )}
          </div>
        )}

        {/* Right: Quick View Presets & Mode Toggles */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'rgba(6, 11, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '4px',
          pointerEvents: 'auto'
        }}>
          {['SOLID', 'POINTS', 'HYBRID'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                background: viewMode === mode ? 'linear-gradient(135deg, #00d2ff, #0088cc)' : 'transparent',
                color: viewMode === mode ? '#07090e' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Floating Controls & Presets */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={handleFocusCenter}
          style={{
            background: 'rgba(6, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            borderRadius: '10px',
            color: '#fff',
            padding: '7px 12px',
            fontSize: '0.72rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Compass size={14} color="#00d2ff" /> Center View
        </button>
        <button
          onClick={handleTopDownPlan}
          style={{
            background: 'rgba(6, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            color: '#cbd5e1',
            padding: '7px 12px',
            fontSize: '0.72rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Grid size={14} /> Top-Down Plan
        </button>
      </div>

      {/* Bottom Right: Digital Twin Elements Legend (only shown if furniture is present) */}
      {(renderedFurniture.table || renderedFurniture.chairs || renderedFurniture.doors) && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(6, 11, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.7rem',
          color: '#94a3b8',
          zIndex: 10
        }}>
          {renderedFurniture.table && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#483524' }} />
              <span>3D Table</span>
            </div>
          )}
          {renderedFurniture.chairs && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                <span>Scattered Chair</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span>Target Slot</span>
              </div>
            </>
          )}
          {renderedFurniture.doors && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#5c4028' }} />
              <span>Doorway</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
