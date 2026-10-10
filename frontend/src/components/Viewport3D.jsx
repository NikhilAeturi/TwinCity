import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function Viewport3D({
  telemetry,
  sceneConfig,
  showCollisions,
  cameraPreset,
  setCameraPreset
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const robotMeshesRef = useRef({});
  const objectMeshesRef = useRef({});
  const collisionWireframesRef = useRef([]);
  const mocapMarkerRef = useRef(null);
  const trajectorySplineRef = useRef(null);

  // Initialize Three.js Scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06090e);
    scene.fog = new THREE.FogExp2(0x06090e, 0.05);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(2.8, 3.4, 2.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent going below floor
    controls.target.set(0.6, 0.6, 0.0);
    controlsRef.current = controls;

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x111827, 0.8);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 6, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const accentCyanLight = new THREE.PointLight(0x00d2ff, 1.5, 6);
    accentCyanLight.position.set(0, 1.8, 1);
    scene.add(accentCyanLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(12, 24, 0x00d2ff, 0x1e293b);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.85,
      metalness: 0.2
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Mocap End-Effector Target Sphere
    const mocapGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const mocapMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true
    });
    const mocapMesh = new THREE.Mesh(mocapGeo, mocapMat);
    scene.add(mocapMesh);
    mocapMarkerRef.current = mocapMesh;

    // Trajectory spline
    const trajCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.05, 0.0),
      new THREE.Vector3(0.5, 0.05, 0.0),
      new THREE.Vector3(1.1, 0.05, 0.0),
      new THREE.Vector3(0.2, 0.05, 0.6),
      new THREE.Vector3(-0.65, 0.05, 1.25)
    ]);
    const trajGeo = new THREE.TubeGeometry(trajCurve, 64, 0.012, 8, false);
    const trajMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.7 });
    const trajMesh = new THREE.Mesh(trajGeo, trajMat);
    scene.add(trajMesh);
    trajectorySplineRef.current = trajMesh;

    // Build Articulated Humanoid Model
    const robotGroup = buildHumanoidHierarchy(scene);
    robotMeshesRef.current = robotGroup;

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Synchronize Scene Objects from Scene Config
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneConfig || !sceneConfig.objects) return;

    // Clear old scene objects
    Object.values(objectMeshesRef.current).forEach(mesh => scene.remove(mesh));
    collisionWireframesRef.current.forEach(wire => scene.remove(wire));
    objectMeshesRef.current = {};
    collisionWireframesRef.current = [];

    sceneConfig.objects.forEach(obj => {
      if (obj.geometry === 'plane') return;

      const group = new THREE.Group();
      let geom;
      const s = obj.size || [0.2, 0.2, 0.2];

      if (obj.geometry === 'cylinder') {
        geom = new THREE.CylinderGeometry(s[0], s[0], s[1] * 2, 24);
      } else {
        geom = new THREE.BoxGeometry(s[0] * 2, s[2] * 2, s[1] * 2);
      }

      // Visual Mesh
      let mat;
      if (obj.id.includes('bottle')) {
        mat = new THREE.MeshPhysicalMaterial({
          color: 0x00d2ff,
          roughness: 0.1,
          transmission: 0.6,
          thickness: 0.5,
          transparent: true,
          opacity: 0.95
        });
      } else if (obj.id.includes('desk')) {
        mat = new THREE.MeshStandardMaterial({
          color: 0x4a3728,
          roughness: 0.6,
          metalness: 0.1
        });
      } else if (obj.id.includes('shelf')) {
        mat = new THREE.MeshStandardMaterial({
          color: 0x27303f,
          roughness: 0.4,
          metalness: 0.7
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.7
        });
      }

      const visualMesh = new THREE.Mesh(geom, mat);
      visualMesh.castShadow = true;
      visualMesh.receiveShadow = true;
      group.add(visualMesh);

      // Collision Wireframe
      const wireframeMat = new THREE.MeshBasicMaterial({
        color: obj.movable ? 0x00d2ff : 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
      const wireframeMesh = new THREE.Mesh(geom.clone(), wireframeMat);
      wireframeMesh.visible = showCollisions;
      group.add(wireframeMesh);
      collisionWireframesRef.current.push(wireframeMesh);

      // Initial placement
      const p = obj.position || [0, 0, 0];
      group.position.set(p[0], p[2], -p[1]); // MuJoCo (x,y,z) -> Three.js (x,z,-y)
      scene.add(group);
      objectMeshesRef.current[obj.id] = group;
    });
  }, [sceneConfig]);

  // Toggle Collision Wireframes Visibility
  useEffect(() => {
    collisionWireframesRef.current.forEach(w => {
      w.visible = showCollisions;
    });
  }, [showCollisions]);

  // Camera Presets
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (cameraPreset === 'FOLLOW') {
      const robotPelvis = telemetry?.robot?.pelvis?.pos || [0, 0, 0.98];
      camera.position.set(robotPelvis[0] - 1.5, robotPelvis[2] + 1.2, -robotPelvis[1] + 1.8);
      controls.target.set(robotPelvis[0], robotPelvis[2], -robotPelvis[1]);
    } else if (cameraPreset === 'DESK') {
      camera.position.set(1.8, 1.4, 0.8);
      controls.target.set(1.15, 0.75, 0.0);
    } else if (cameraPreset === 'SHELF') {
      camera.position.set(-0.2, 1.6, -1.8);
      controls.target.set(-0.65, 1.1, -1.25);
    } else if (cameraPreset === 'ORBIT') {
      camera.position.set(2.8, 3.4, 2.8);
      controls.target.set(0.6, 0.6, 0.0);
    }
  }, [cameraPreset, telemetry]);

  // Update Dynamic Telemetry Poses (Robot & Objects)
  useEffect(() => {
    if (!telemetry) return;

    // Update Robot Pose
    const robot = robotMeshesRef.current;
    if (robot && telemetry.robot) {
      const pelvis = telemetry.robot.pelvis;
      if (pelvis && pelvis.pos) {
        // MuJoCo Z is up, Three.js Y is up
        robot.group.position.set(pelvis.pos[0], pelvis.pos[2], -pelvis.pos[1]);
      }

      // Update right arm & hand
      if (telemetry.robot.right_hand_pos && robot.rightArm) {
        const rh = telemetry.robot.right_hand_pos;
        // Point right arm toward target
        const localX = rh[0] - (pelvis?.pos[0] || 0);
        const localY = rh[2] - (pelvis?.pos[2] || 0);
        const localZ = -(rh[1] - (pelvis?.pos[1] || 0));
        robot.rightHand.position.set(localX, localY, localZ);
      }

      // Update Mocap target
      if (mocapMarkerRef.current && telemetry.robot.right_hand_pos) {
        const rpos = telemetry.robot.right_hand_pos;
        mocapMarkerRef.current.position.set(rpos[0], rpos[2], -rpos[1]);
      }
    }

    // Update Interactive Objects (e.g. Bottle)
    if (telemetry.objects) {
      Object.entries(telemetry.objects).forEach(([oid, objData]) => {
        const mesh = objectMeshesRef.current[oid];
        if (mesh && objData.pos) {
          mesh.position.set(objData.pos[0], objData.pos[2], -objData.pos[1]);
        }
      });
    }
  }, [telemetry]);

  return (
    <div className="viewport-container" id="viewport-3d-root">
      <div ref={mountRef} className="canvas-3d" />

      {/* Top HUD */}
      <div className="viewport-top-hud">
        <div className="hud-pill" id="hud-engine-status">
          <span className="status-dot" />
          <span>MUJOCO PHYSICS: <strong>500 HZ ACTIVE</strong></span>
        </div>
        <div className="hud-pill" id="hud-sim-time">
          <span>SIM TIME: <strong>{telemetry?.sim_time ? `${telemetry.sim_time.toFixed(2)}s` : '0.00s'}</strong></span>
        </div>
        <div className="hud-pill" id="hud-active-step">
          <span>TASK STEP: <strong>{telemetry?.task?.active ? `STEP ${telemetry.task.current_step + 1}` : 'IDLE'}</strong></span>
        </div>
      </div>

      {/* Camera Preset Toolbar */}
      <div className="camera-controls-overlay" id="camera-preset-controls">
        <button
          className={`cam-btn ${cameraPreset === 'ORBIT' ? 'active' : ''}`}
          onClick={() => setCameraPreset('ORBIT')}
          id="btn-cam-orbit"
        >
          Free Orbit
        </button>
        <button
          className={`cam-btn ${cameraPreset === 'FOLLOW' ? 'active' : ''}`}
          onClick={() => setCameraPreset('FOLLOW')}
          id="btn-cam-follow"
        >
          Follow Robot
        </button>
        <button
          className={`cam-btn ${cameraPreset === 'DESK' ? 'active' : ''}`}
          onClick={() => setCameraPreset('DESK')}
          id="btn-cam-desk"
        >
          Desk Focus
        </button>
        <button
          className={`cam-btn ${cameraPreset === 'SHELF' ? 'active' : ''}`}
          onClick={() => setCameraPreset('SHELF')}
          id="btn-cam-shelf"
        >
          Shelf Focus
        </button>
      </div>

      {/* Bottom Overlays */}
      <div className="viewport-bottom-hud">
        {telemetry?.robot?.has_contact && (
          <div className="contact-alert-badge" id="contact-alert-indicator">
            ⚡ GRIPPER CONTACT CONFIRMED: OBJECT SECURED
          </div>
        )}
      </div>
    </div>
  );
}

// Build Articulated 3D Humanoid Mesh Group
function buildHumanoidHierarchy(scene) {
  const group = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0xdce2ec,
    metalness: 0.3,
    roughness: 0.3
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x1e2638,
    metalness: 0.8,
    roughness: 0.2
  });
  const cyanGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff
  });

  // Pelvis
  const pelvisGeo = new THREE.BoxGeometry(0.24, 0.16, 0.18);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, jointMat);
  group.add(pelvisMesh);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.26, 0.32, 0.22);
  const torsoMesh = new THREE.Mesh(torsoGeo, chassisMat);
  torsoMesh.position.y = 0.24;
  pelvisMesh.add(torsoMesh);

  // Chest Reactor Light
  const reactorGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
  const reactorMesh = new THREE.Mesh(reactorGeo, cyanGlowMat);
  reactorMesh.rotation.x = Math.PI / 2;
  reactorMesh.position.set(0, 0.06, 0.11);
  torsoMesh.add(reactorMesh);

  // Head & Visor
  const headGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, jointMat);
  headMesh.position.y = 0.26;
  torsoMesh.add(headMesh);

  const visorGeo = new THREE.BoxGeometry(0.12, 0.04, 0.05);
  const visorMesh = new THREE.Mesh(visorGeo, cyanGlowMat);
  visorMesh.position.set(0, 0.01, 0.08);
  headMesh.add(visorMesh);

  // Right Arm (Articulated hierarchy)
  const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), jointMat);
  rShoulder.position.set(0.19, 0.1, 0.0);
  torsoMesh.add(rShoulder);

  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.22, 12), chassisMat);
  rUpperArm.position.set(0.05, -0.12, 0.0);
  rShoulder.add(rUpperArm);

  const rElbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), jointMat);
  rElbow.position.set(0, -0.12, 0);
  rUpperArm.add(rElbow);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.2, 12), chassisMat);
  rForearm.position.set(0, -0.1, 0);
  rElbow.add(rForearm);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.07), jointMat);
  rHand.position.set(0, -0.12, 0);
  rForearm.add(rHand);

  // Left Arm
  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), jointMat);
  lShoulder.position.set(-0.19, 0.1, 0.0);
  torsoMesh.add(lShoulder);

  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.22, 12), chassisMat);
  lUpperArm.position.set(-0.05, -0.12, 0.0);
  lShoulder.add(lUpperArm);

  const lElbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), jointMat);
  lElbow.position.set(0, -0.12, 0);
  lUpperArm.add(lElbow);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.2, 12), chassisMat);
  lForearm.position.set(0, -0.1, 0);
  lElbow.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.07), jointMat);
  lHand.position.set(0, -0.12, 0);
  lForearm.add(lHand);

  // Legs
  const rHip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 12), chassisMat);
  rHip.position.set(0.09, -0.24, 0);
  pelvisMesh.add(rHip);

  const rKnee = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), jointMat);
  rKnee.position.set(0, -0.18, 0);
  rHip.add(rKnee);

  const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.35, 12), chassisMat);
  rShin.position.set(0, -0.18, 0);
  rKnee.add(rShin);

  const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.18), jointMat);
  rFoot.position.set(0, -0.18, 0.04);
  rShin.add(rFoot);

  // Left Leg
  const lHip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 12), chassisMat);
  lHip.position.set(-0.09, -0.24, 0);
  pelvisMesh.add(lHip);

  const lKnee = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), jointMat);
  lKnee.position.set(0, -0.18, 0);
  lHip.add(lKnee);

  const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.35, 12), chassisMat);
  lShin.position.set(0, -0.18, 0);
  lKnee.add(lShin);

  const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.18), jointMat);
  lFoot.position.set(0, -0.18, 0.04);
  lShin.add(lFoot);

  scene.add(group);

  return {
    group,
    pelvis: pelvisMesh,
    torso: torsoMesh,
    rightArm: rUpperArm,
    rightHand: rHand,
    leftHand: lHand
  };
}
