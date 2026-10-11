import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Activity, Maximize2, Minimize2, RotateCcw,
  Shield, Zap, Radio, Footprints, Layers, Sparkles
} from 'lucide-react';

/**
 * High-Fidelity 3D Articulated Humanoid Kinematics Viewer.
 * Visualizes a 16-DOF robotic skeletal digital twin with real-time joint rotations:
 * - Spine (pitch, yaw), Neck (pitch, yaw)
 * - Shoulders & Elbows (flexion, extension, arm pump, wave gestures)
 * - Hips, Knees & Ankles (inverted pendulum leg swing, knee flexion, ground contact)
 * Powered by Three.js with PBR metallic shaders, ground grid, and live telemetry gauges.
 */
export default function HumanoidKinematicsViewer({
  currentFrame,
  activeScene,
  className = ''
}) {
  const mountRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedJointView, setSelectedJointView] = useState('ALL'); // 'ALL' | 'LEGS' | 'ARMS' | 'TORSO'

  // Three.js instances
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Joint hierarchy refs for 60 FPS rotation updates
  const jointsRef = useRef({
    pelvis: null,
    spine: null,
    neck: null,
    head: null,
    rShoulder: null,
    rElbow: null,
    lShoulder: null,
    lElbow: null,
    rHip: null,
    rKnee: null,
    rAnkle: null,
    lHip: null,
    lKnee: null,
    lAnkle: null
  });

  // 1. Initialize Three.js Scene and Articulated Robot Hierarchy
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 340;
    const height = mount.clientHeight || 280;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.15);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 50);
    camera.position.set(0, 1.35, 3.2);
    cameraRef.current = camera;

    // Renderer with antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.id = 'humanoid-kinematics-canvas';
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.95, 0);
    controls.minDistance = 1.2;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(2, 4, 3);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 1.8);
    dirLight2.position.set(-3, 2, -2);
    scene.add(dirLight2);

    const floorLight = new THREE.PointLight(0x0284c7, 2.5, 5.0);
    floorLight.position.set(0, 0.05, 0);
    scene.add(floorLight);

    // Ground Grid & Concentric Cyber Rings
    const grid = new THREE.GridHelper(4.0, 24, 0x0284c7, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    const ringGeo = new THREE.RingGeometry(0.7, 0.74, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.005;
    scene.add(ringMesh);

    // --- Build Articulated Robot Skeleton Hierarchy ---
    // Materials
    const matArmor = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.22,
      envMapIntensity: 1.0
    });
    const matChassis = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.35
    });
    const matJoint = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x0369a1,
      emissiveIntensity: 0.3
    });
    const matVisor = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const matCore = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Root Group
    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    // 1. Pelvis
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 0.95, 0);
    robotRoot.add(pelvisGroup);
    jointsRef.current.pelvis = pelvisGroup;

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.14), matChassis);
    pelvisGroup.add(pelvisMesh);
    const pelvisArmor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.08), matArmor);
    pelvisArmor.position.set(0, 0.02, 0.01);
    pelvisGroup.add(pelvisArmor);

    // 2. Spine (Rotates around base of waist)
    const spineJoint = new THREE.Group();
    spineJoint.position.set(0, 0.11, 0);
    pelvisGroup.add(spineJoint);
    jointsRef.current.spine = spineJoint;

    const spinePivot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), matJoint);
    spineJoint.add(spinePivot);

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.20), matChassis);
    torsoMesh.position.set(0, 0.18, 0);
    spineJoint.add(torsoMesh);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.06), matArmor);
    chestPlate.position.set(0, 0.19, 0.10);
    spineJoint.add(chestPlate);

    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), matCore);
    coreMesh.rotation.x = Math.PI / 2;
    coreMesh.position.set(0, 0.20, 0.13);
    spineJoint.add(coreMesh);

    // 3. Neck & Head
    const neckJoint = new THREE.Group();
    neckJoint.position.set(0, 0.35, 0);
    spineJoint.add(neckJoint);
    jointsRef.current.neck = neckJoint;

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), matJoint);
    neckJoint.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.14, 0.02);
    neckJoint.add(headGroup);
    jointsRef.current.head = headGroup;

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.20), matArmor);
    headGroup.add(headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), matVisor);
    visorMesh.position.set(0, 0.01, 0.11);
    headGroup.add(visorMesh);

    const antennaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), matJoint);
    antennaMesh.position.set(0.07, 0.13, -0.05);
    headGroup.add(antennaMesh);

    // 4. Arms
    // Left Shoulder
    const lShoulderGroup = new THREE.Group();
    lShoulderGroup.position.set(0.22, 0.27, 0);
    spineJoint.add(lShoulderGroup);
    jointsRef.current.lShoulder = lShoulderGroup;

    const lShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
    lShoulderGroup.add(lShoulderBall);

    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16), matArmor);
    lUpperArm.position.set(0, -0.13, 0);
    lShoulderGroup.add(lUpperArm);

    const lElbowGroup = new THREE.Group();
    lElbowGroup.position.set(0, -0.26, 0);
    lShoulderGroup.add(lElbowGroup);
    jointsRef.current.lElbow = lElbowGroup;

    const lElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), matJoint);
    lElbowGroup.add(lElbowBall);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 16), matChassis);
    lForearm.position.set(0, -0.13, 0.02);
    lElbowGroup.add(lForearm);

    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matArmor);
    lHand.position.set(0, -0.26, 0.03);
    lElbowGroup.add(lHand);

    // Right Shoulder
    const rShoulderGroup = new THREE.Group();
    rShoulderGroup.position.set(-0.22, 0.27, 0);
    spineJoint.add(rShoulderGroup);
    jointsRef.current.rShoulder = rShoulderGroup;

    const rShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
    rShoulderGroup.add(rShoulderBall);

    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16), matArmor);
    rUpperArm.position.set(0, -0.13, 0);
    rShoulderGroup.add(rUpperArm);

    const rElbowGroup = new THREE.Group();
    rElbowGroup.position.set(0, -0.26, 0);
    rShoulderGroup.add(rElbowGroup);
    jointsRef.current.rElbow = rElbowGroup;

    const rElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), matJoint);
    rElbowGroup.add(rElbowBall);

    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 16), matChassis);
    rForearm.position.set(0, -0.13, 0.02);
    rElbowGroup.add(rForearm);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matArmor);
    rHand.position.set(0, -0.26, 0.03);
    rElbowGroup.add(rHand);

    // 5. Legs
    // Left Hip
    const lHipGroup = new THREE.Group();
    lHipGroup.position.set(0.11, -0.06, 0);
    pelvisGroup.add(lHipGroup);
    jointsRef.current.lHip = lHipGroup;

    const lHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
    lHipGroup.add(lHipBall);

    const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
    lThigh.position.set(0, -0.21, 0);
    lHipGroup.add(lThigh);

    const lKneeGroup = new THREE.Group();
    lKneeGroup.position.set(0, -0.42, 0.02);
    lHipGroup.add(lKneeGroup);
    jointsRef.current.lKnee = lKneeGroup;

    const lKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
    lKneeGroup.add(lKneeBall);

    const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
    lShin.position.set(0, -0.20, -0.01);
    lKneeGroup.add(lShin);

    const lAnkleGroup = new THREE.Group();
    lAnkleGroup.position.set(0, -0.40, 0);
    lKneeGroup.add(lAnkleGroup);
    jointsRef.current.lAnkle = lAnkleGroup;

    const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
    lFoot.position.set(0, 0.03, 0.04);
    lAnkleGroup.add(lFoot);

    // Right Hip
    const rHipGroup = new THREE.Group();
    rHipGroup.position.set(-0.11, -0.06, 0);
    pelvisGroup.add(rHipGroup);
    jointsRef.current.rHip = rHipGroup;

    const rHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
    rHipGroup.add(rHipBall);

    const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
    rThigh.position.set(0, -0.21, 0);
    rHipGroup.add(rThigh);

    const rKneeGroup = new THREE.Group();
    rKneeGroup.position.set(0, -0.42, 0.02);
    rHipGroup.add(rKneeGroup);
    jointsRef.current.rKnee = rKneeGroup;

    const rKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
    rKneeGroup.add(rKneeBall);

    const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
    rShin.position.set(0, -0.20, -0.01);
    rKneeGroup.add(rShin);

    const rAnkleGroup = new THREE.Group();
    rAnkleGroup.position.set(0, -0.40, 0);
    rKneeGroup.add(rAnkleGroup);
    jointsRef.current.rAnkle = rAnkleGroup;

    const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
    rFoot.position.set(0, 0.03, 0.04);
    rAnkleGroup.add(rFoot);

    // Render loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (autoRotate && robotRoot) {
        robotRoot.rotation.y += 0.005;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
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
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 2. Update Articulated Joint Rotations in Real-Time at 60 FPS
  useEffect(() => {
    if (!currentFrame || !jointsRef.current.pelvis) return;

    const j = currentFrame.joints || {};
    const d2r = THREE.MathUtils.degToRad;
    const jf = jointsRef.current;

    // Pelvis base altitude adaptation
    const vertOffset = currentFrame.pos?.altitude_offset || 0.0;
    jf.pelvis.position.y = 0.95 + vertOffset;

    // Body pitch/roll
    const pitch = currentFrame.pitch || 0.0;
    const roll = currentFrame.roll || 0.0;
    jf.pelvis.rotation.x = d2r(pitch);
    jf.pelvis.rotation.z = d2r(roll);

    // Spine
    if (jf.spine) {
      jf.spine.rotation.x = d2r(j.spine_pitch || 0.0);
      jf.spine.rotation.y = d2r(j.spine_yaw || 0.0);
    }

    // Neck & Head
    if (jf.neck) {
      jf.neck.rotation.x = d2r(j.neck_pitch || 0.0);
      jf.neck.rotation.y = d2r(j.neck_yaw || 0.0);
    }

    // Left Arm (Shoulder pitch, roll, elbow flexion)
    if (jf.lShoulder) {
      jf.lShoulder.rotation.x = d2r(j.l_shoulder_pitch || 0.0);
      jf.lShoulder.rotation.z = d2r(j.l_shoulder_roll || 10.0);
    }
    if (jf.lElbow) {
      jf.lElbow.rotation.x = d2r(j.l_elbow || 20.0);
    }

    // Right Arm
    if (jf.rShoulder) {
      jf.rShoulder.rotation.x = d2r(j.r_shoulder_pitch || 0.0);
      jf.rShoulder.rotation.z = d2r(j.r_shoulder_roll || -10.0);
    }
    if (jf.rElbow) {
      jf.rElbow.rotation.x = d2r(j.r_elbow || 20.0);
    }

    // Left Leg (Hip pitch, Knee flexion, Ankle pitch)
    if (jf.lHip) {
      jf.lHip.rotation.x = d2r(j.l_hip_pitch || 0.0);
    }
    if (jf.lKnee) {
      // In Three.js, knee bends backwards -> negative X rotation
      jf.lKnee.rotation.x = d2r(-(j.l_knee || 5.0));
    }
    if (jf.lAnkle) {
      jf.lAnkle.rotation.x = d2r(j.l_ankle_pitch || 0.0);
    }

    // Right Leg
    if (jf.rHip) {
      jf.rHip.rotation.x = d2r(j.r_hip_pitch || 0.0);
    }
    if (jf.rKnee) {
      jf.rKnee.rotation.x = d2r(-(j.r_knee || 5.0));
    }
    if (jf.rAnkle) {
      jf.rAnkle.rotation.x = d2r(j.r_ankle_pitch || 0.0);
    }
  }, [currentFrame]);

  // Telemetry values
  const action = currentFrame?.action || 'IDLE';
  const joints = currentFrame?.joints || {};
  const terrain = currentFrame?.terrain_telemetry || {};
  const normalForce = terrain?.normal_force_n || 735.0;
  const slopeDeg = terrain?.slope_deg || 0.0;
  const speed = currentFrame?.speed || 0.0;

  return (
    <div
      style={
        isExpanded
          ? {
              position: 'fixed',
              top: '24px',
              left: '24px',
              right: '24px',
              bottom: '24px',
              zIndex: 9999,
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid #00d2ff',
              background: 'rgba(10, 15, 29, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 0 50px rgba(0, 210, 255, 0.4), 0 20px 60px rgba(0,0,0,0.85)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              fontFamily: 'Inter, system-ui, sans-serif'
            }
          : {
              width: '320px',
              height: '290px',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(0, 210, 255, 0.35)',
              background: 'rgba(10, 15, 29, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 210, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              fontFamily: 'Inter, system-ui, sans-serif'
            }
      }
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(15, 23, 42, 0.9)',
          borderBottom: '1px solid rgba(0, 210, 255, 0.2)',
          fontSize: '0.72rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
            <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', width: '100%', height: '100%', borderRadius: '50%', background: '#00d2ff', opacity: 0.75 }} />
            <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: '8px', height: '8px', background: '#00d2ff' }} />
          </span>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
            KINEMATICS TWIN 60FPS
          </span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.62rem',
              fontFamily: 'monospace',
              fontWeight: 700,
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)'
            }}
          >
            {action}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360 Turntable Orbit"
            style={{
              background: autoRotate ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '4px',
              color: autoRotate ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Expand Kinematics Studio'}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '4px',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* 3D Viewport Mount */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          minHeight: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.9) 0%, rgba(3, 7, 18, 1) 100%)'
        }}
      >
        <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

        {/* Live Joint Gauges Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: '0.62rem'
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ color: '#38bdf8' }}>R-KNEE:</span>
            <strong style={{ color: '#ffffff' }}>{(joints.r_knee || 0).toFixed(1)}°</strong>
            <span style={{ color: '#38bdf8', marginLeft: '4px' }}>L-KNEE:</span>
            <strong style={{ color: '#ffffff' }}>{(joints.l_knee || 0).toFixed(1)}°</strong>
          </div>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ color: '#7dd3fc' }}>R-ARM:</span>
            <strong style={{ color: '#ffffff' }}>{(joints.r_shoulder_pitch || 0).toFixed(1)}°</strong>
            <span style={{ color: '#7dd3fc', marginLeft: '4px' }}>L-ARM:</span>
            <strong style={{ color: '#ffffff' }}>{(joints.l_shoulder_pitch || 0).toFixed(1)}°</strong>
          </div>
        </div>

        {/* Dynamic Force & Posture Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: '0.62rem',
            color: '#cbd5e1',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            padding: '5px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(56, 189, 248, 0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={11} color="#f59e0b" />
            <span>Fn: <strong style={{ color: '#fde68a' }}>{normalForce.toFixed(0)} N</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={11} color="#38bdf8" />
            <span>Slope: <strong style={{ color: '#7dd3fc' }}>{slopeDeg.toFixed(1)}°</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Footprints size={11} color="#10b981" />
            <span>Spd: <strong style={{ color: '#6ee7b7' }}>{speed.toFixed(1)} m/s</strong></span>
          </div>
        </div>
      </div>

      {/* Expanded Full-Studio Telemetry Drawer */}
      {isExpanded && (
        <div
          style={{
            height: '180px',
            background: 'rgba(15, 23, 42, 0.96)',
            borderTop: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            overflowY: 'auto'
          }}
        >
          {/* Column 1: Lower Extremities */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ color: '#38bdf8', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Footprints size={14} /> Bipedal Leg Joints
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Hip Pitch:</span><strong style={{ color: '#fff' }}>{(joints.r_hip_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Hip Pitch:</span><strong style={{ color: '#fff' }}>{(joints.l_hip_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Knee Flex:</span><strong style={{ color: '#38bdf8' }}>{(joints.r_knee || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Knee Flex:</span><strong style={{ color: '#38bdf8' }}>{(joints.l_knee || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Ankle Roll:</span><strong style={{ color: '#94a3b8' }}>{(joints.r_ankle_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Ankle Roll:</span><strong style={{ color: '#94a3b8' }}>{(joints.l_ankle_pitch || 0).toFixed(1)}°</strong></div>
            </div>
          </div>

          {/* Column 2: Upper Extremities */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ color: '#7dd3fc', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={14} /> Manipulator Arms
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Shoulder Pitch:</span><strong style={{ color: '#fff' }}>{(joints.r_shoulder_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Shoulder Pitch:</span><strong style={{ color: '#fff' }}>{(joints.l_shoulder_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Shoulder Roll:</span><strong style={{ color: '#fff' }}>{(joints.r_shoulder_roll || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Shoulder Roll:</span><strong style={{ color: '#fff' }}>{(joints.l_shoulder_roll || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>R Elbow Flex:</span><strong style={{ color: '#7dd3fc' }}>{(joints.r_elbow || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>L Elbow Flex:</span><strong style={{ color: '#7dd3fc' }}>{(joints.l_elbow || 0).toFixed(1)}°</strong></div>
            </div>
          </div>

          {/* Column 3: Torso, Spine & Head */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ color: '#818cf8', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={14} /> Axial Posture & Neck
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Spine Pitch:</span><strong style={{ color: '#fff' }}>{(joints.spine_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Spine Yaw:</span><strong style={{ color: '#fff' }}>{(joints.spine_yaw || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Neck Pitch:</span><strong style={{ color: '#fff' }}>{(joints.neck_pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Neck Yaw (Scan):</span><strong style={{ color: '#818cf8' }}>{(joints.neck_yaw || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Body Pitch:</span><strong style={{ color: '#94a3b8' }}>{(currentFrame.pitch || 0).toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Body Roll:</span><strong style={{ color: '#94a3b8' }}>{(currentFrame.roll || 0).toFixed(1)}°</strong></div>
            </div>
          </div>

          {/* Column 4: Contact & Physics Telemetry */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ color: '#34d399', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={14} /> Surface Dynamics
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ground Clamped:</span><strong style={{ color: '#34d399' }}>YES (Terrain Clamped)</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Normal Force Fn:</span><strong style={{ color: '#fde68a' }}>{normalForce.toFixed(0)} N</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Slope Incline:</span><strong style={{ color: '#38bdf8' }}>{slopeDeg.toFixed(1)}°</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Forward Velocity:</span><strong style={{ color: '#fff' }}>{speed.toFixed(2)} m/s</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Altitude Offset:</span><strong style={{ color: '#94a3b8' }}>{(currentFrame.pos?.altitude_offset || 0).toFixed(2)} m</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Simulation Rate:</span><strong style={{ color: '#34d399' }}>60 FPS</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

