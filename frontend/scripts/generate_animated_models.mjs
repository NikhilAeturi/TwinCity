import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../public/models');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Node.js FileReader polyfill for GLTFExporter writeAsync
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

/**
 * Builds the articulated 16-DOF humanoid robot Three.js hierarchy.
 * Returns { root, nodes }
 */
function buildRobotHierarchy() {
  const root = new THREE.Group();
  root.name = 'HumanoidRobot';

  // Materials with PBR metallic sheen
  const matArmor = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.25
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
    emissive: 0x0284c7,
    emissiveIntensity: 0.4
  });

  const matVisor = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  const matCore = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // 1. Pelvis Root Node
  const pelvis = new THREE.Group();
  pelvis.name = 'Pelvis';
  pelvis.position.set(0, 0.95, 0);
  root.add(pelvis);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.14), matChassis);
  pelvis.add(pelvisMesh);

  const pelvisArmor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.08), matArmor);
  pelvisArmor.position.set(0, 0.02, 0.01);
  pelvis.add(pelvisArmor);

  // 2. Spine / Torso (Child of Pelvis)
  const spine = new THREE.Group();
  spine.name = 'Spine';
  spine.position.set(0, 0.11, 0);
  pelvis.add(spine);

  const spinePivot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), matJoint);
  spine.add(spinePivot);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.20), matChassis);
  torsoMesh.position.set(0, 0.18, 0);
  spine.add(torsoMesh);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.06), matArmor);
  chestPlate.position.set(0, 0.19, 0.10);
  spine.add(chestPlate);

  const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), matCore);
  coreMesh.rotation.x = Math.PI / 2;
  coreMesh.position.set(0, 0.20, 0.13);
  spine.add(coreMesh);

  // 3. Neck & Head (Child of Spine)
  const neck = new THREE.Group();
  neck.name = 'Neck';
  neck.position.set(0, 0.35, 0);
  spine.add(neck);

  const neckPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 16), matJoint);
  neckPivot.position.set(0, 0.03, 0);
  neck.add(neckPivot);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matArmor);
  headMesh.position.set(0, 0.14, 0);
  neck.add(headMesh);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.04), matVisor);
  visorMesh.position.set(0, 0.14, 0.095);
  neck.add(visorMesh);

  // Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), matJoint);
  antenna.position.set(0.06, 0.28, -0.02);
  neck.add(antenna);

  // 4. Left Arm (Child of Spine)
  const lShoulder = new THREE.Group();
  lShoulder.name = 'L_Shoulder';
  lShoulder.position.set(0.22, 0.26, 0);
  spine.add(lShoulder);

  const lShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), matJoint);
  lShoulder.add(lShoulderBall);

  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.26, 16), matArmor);
  lUpperArm.position.set(0, -0.13, 0);
  lShoulder.add(lUpperArm);

  const lElbow = new THREE.Group();
  lElbow.name = 'L_Elbow';
  lElbow.position.set(0, -0.26, 0);
  lShoulder.add(lElbow);

  const lElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), matJoint);
  lElbow.add(lElbowBall);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 16), matChassis);
  lForearm.position.set(0, -0.12, 0);
  lElbow.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), matArmor);
  lHand.position.set(0, -0.26, 0);
  lElbow.add(lHand);

  // 5. Right Arm (Child of Spine)
  const rShoulder = new THREE.Group();
  rShoulder.name = 'R_Shoulder';
  rShoulder.position.set(-0.22, 0.26, 0);
  spine.add(rShoulder);

  const rShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), matJoint);
  rShoulder.add(rShoulderBall);

  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.26, 16), matArmor);
  rUpperArm.position.set(0, -0.13, 0);
  rShoulder.add(rUpperArm);

  const rElbow = new THREE.Group();
  rElbow.name = 'R_Elbow';
  rElbow.position.set(0, -0.26, 0);
  rShoulder.add(rElbow);

  const rElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), matJoint);
  rElbow.add(rElbowBall);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 16), matChassis);
  rForearm.position.set(0, -0.12, 0);
  rElbow.add(rForearm);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), matArmor);
  rHand.position.set(0, -0.26, 0);
  rElbow.add(rHand);

  // 6. Left Leg (Child of Pelvis)
  const lHip = new THREE.Group();
  lHip.name = 'L_Hip';
  lHip.position.set(0.11, -0.06, 0);
  pelvis.add(lHip);

  const lHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  lHip.add(lHipBall);

  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
  lThigh.position.set(0, -0.21, 0);
  lHip.add(lThigh);

  const lKnee = new THREE.Group();
  lKnee.name = 'L_Knee';
  lKnee.position.set(0, -0.42, 0.02);
  lHip.add(lKnee);

  const lKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
  lKnee.add(lKneeBall);

  const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
  lShin.position.set(0, -0.20, -0.01);
  lKnee.add(lShin);

  const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
  lFoot.position.set(0, -0.38, 0.04);
  lKnee.add(lFoot);

  // 7. Right Leg (Child of Pelvis)
  const rHip = new THREE.Group();
  rHip.name = 'R_Hip';
  rHip.position.set(-0.11, -0.06, 0);
  pelvis.add(rHip);

  const rHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  rHip.add(rHipBall);

  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
  rThigh.position.set(0, -0.21, 0);
  rHip.add(rThigh);

  const rKnee = new THREE.Group();
  rKnee.name = 'R_Knee';
  rKnee.position.set(0, -0.42, 0.02);
  rHip.add(rKnee);

  const rKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
  rKnee.add(rKneeBall);

  const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
  rShin.position.set(0, -0.20, -0.01);
  rKnee.add(rShin);

  const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
  rFoot.position.set(0, -0.38, 0.04);
  rKnee.add(rFoot);

  return {
    root,
    nodes: {
      pelvis,
      spine,
      neck,
      lShoulder,
      lElbow,
      rShoulder,
      rElbow,
      lHip,
      lKnee,
      rHip,
      rKnee
    }
  };
}

/**
 * Creates rotation keyframe tracks from Euler angles in degrees.
 */
function makeQuatTrack(nodeName, times, eulerArrayDeg) {
  const quatValues = [];
  const euler = new THREE.Euler();
  const q = new THREE.Quaternion();

  for (const [xDeg, yDeg, zDeg] of eulerArrayDeg) {
    euler.set(
      THREE.MathUtils.degToRad(xDeg),
      THREE.MathUtils.degToRad(yDeg),
      THREE.MathUtils.degToRad(zDeg),
      'XYZ'
    );
    q.setFromEuler(euler);
    quatValues.push(q.x, q.y, q.z, q.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, quatValues);
}

/**
 * Creates position keyframe tracks.
 */
function makePosTrack(nodeName, times, posArray) {
  const flat = posArray.flat();
  return new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, flat);
}

/**
 * Generates an AnimationClip for a given action profile.
 */
function generateAnimationClip(action) {
  const tracks = [];

  if (action === 'walk') {
    // 1.2s bipedal walk cycle sampled at 8 phases
    const duration = 1.2;
    const numFrames = 9;
    const times = [];
    const lHipRot = [];
    const rHipRot = [];
    const lKneeRot = [];
    const rKneeRot = [];
    const lArmRot = [];
    const rArmRot = [];
    const lElbowRot = [];
    const rElbowRot = [];
    const pelvisPos = [];
    const spineRot = [];

    for (let i = 0; i < numFrames; i++) {
      const t = (i / (numFrames - 1)) * duration;
      const phase = (i / (numFrames - 1)) * Math.PI * 2;
      times.push(t);

      // Legs alternating swing
      const hipSwing = 26.0 * Math.sin(phase);
      lHipRot.push([hipSwing, 0, 0]);
      rHipRot.push([-hipSwing, 0, 0]);

      // Knee flexes during swing-through phase
      const lKneeFlex = Math.max(0, -hipSwing * 1.6);
      const rKneeFlex = Math.max(0, hipSwing * 1.6);
      lKneeRot.push([-lKneeFlex, 0, 0]);
      rKneeRot.push([-rKneeFlex, 0, 0]);

      // Arms counter-swing opposite to legs
      const armSwing = -24.0 * Math.sin(phase);
      lArmRot.push([armSwing, 0, 10.0]);
      rArmRot.push([-armSwing, 0, -10.0]);

      // Elbows flex on forward swing
      lElbowRot.push([Math.max(15, armSwing + 25), 0, 0]);
      rElbowRot.push([Math.max(15, -armSwing + 25), 0, 0]);

      // Pelvis vertical bounce at 2x frequency
      const bounce = Math.abs(Math.sin(phase)) * 0.035;
      pelvisPos.push([0, 0.95 - bounce, 0]);

      // Torso slight counter-yaw
      spineRot.push([3.0, 4.0 * Math.sin(phase), 0]);
    }

    tracks.push(makeQuatTrack('L_Hip', times, lHipRot));
    tracks.push(makeQuatTrack('R_Hip', times, rHipRot));
    tracks.push(makeQuatTrack('L_Knee', times, lKneeRot));
    tracks.push(makeQuatTrack('R_Knee', times, rKneeRot));
    tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));
    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('L_Elbow', times, lElbowRot));
    tracks.push(makeQuatTrack('R_Elbow', times, rElbowRot));
    tracks.push(makeQuatTrack('Spine', times, spineRot));
    tracks.push(makePosTrack('Pelvis', times, pelvisPos));

    return new THREE.AnimationClip('WalkCycle', duration, tracks);
  }

  if (action === 'jog') {
    // 0.8s athletic run cycle
    const duration = 0.8;
    const numFrames = 9;
    const times = [];
    const lHipRot = [];
    const rHipRot = [];
    const lKneeRot = [];
    const rKneeRot = [];
    const lArmRot = [];
    const rArmRot = [];
    const lElbowRot = [];
    const rElbowRot = [];
    const pelvisPos = [];
    const spineRot = [];

    for (let i = 0; i < numFrames; i++) {
      const t = (i / (numFrames - 1)) * duration;
      const phase = (i / (numFrames - 1)) * Math.PI * 2;
      times.push(t);

      const hipSwing = 40.0 * Math.sin(phase);
      lHipRot.push([hipSwing, 0, 0]);
      rHipRot.push([-hipSwing, 0, 0]);

      const lKneeFlex = Math.max(10, -hipSwing * 1.8);
      const rKneeFlex = Math.max(10, hipSwing * 1.8);
      lKneeRot.push([-lKneeFlex, 0, 0]);
      rKneeRot.push([-rKneeFlex, 0, 0]);

      const armSwing = -42.0 * Math.sin(phase);
      lArmRot.push([armSwing, 0, 14.0]);
      rArmRot.push([-armSwing, 0, -14.0]);

      lElbowRot.push([65.0 + (armSwing * 0.4), 0, 0]);
      rElbowRot.push([65.0 - (armSwing * 0.4), 0, 0]);

      const bounce = Math.abs(Math.sin(phase)) * 0.06;
      pelvisPos.push([0, 0.94 - bounce, 0]);
      spineRot.push([8.0, 7.0 * Math.sin(phase), 0]);
    }

    tracks.push(makeQuatTrack('L_Hip', times, lHipRot));
    tracks.push(makeQuatTrack('R_Hip', times, rHipRot));
    tracks.push(makeQuatTrack('L_Knee', times, lKneeRot));
    tracks.push(makeQuatTrack('R_Knee', times, rKneeRot));
    tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));
    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('L_Elbow', times, lElbowRot));
    tracks.push(makeQuatTrack('R_Elbow', times, rElbowRot));
    tracks.push(makeQuatTrack('Spine', times, spineRot));
    tracks.push(makePosTrack('Pelvis', times, pelvisPos));

    return new THREE.AnimationClip('JogCycle', duration, tracks);
  }

  if (action === 'wave') {
    // 1.4s friendly greeting wave with oscillating right arm
    const duration = 1.4;
    const numFrames = 9;
    const times = [];
    const rArmRot = [];
    const rElbowRot = [];
    const lArmRot = [];
    const neckRot = [];
    const spineRot = [];

    for (let i = 0; i < numFrames; i++) {
      const t = (i / (numFrames - 1)) * duration;
      const phase = (i / (numFrames - 1)) * Math.PI * 4; // 2 waves per cycle
      times.push(t);

      // Raised right arm waving side-to-side
      const waveRoll = -115.0 + (18.0 * Math.sin(phase));
      const wavePitch = 22.0 + (8.0 * Math.cos(phase));
      rArmRot.push([wavePitch, 0, waveRoll]);
      rElbowRot.push([85.0 + (10.0 * Math.sin(phase)), 0, 0]);

      lArmRot.push([-5.0, 0, 10.0]);
      neckRot.push([6.0, -12.0 + (4.0 * Math.sin(phase)), 0]);
      spineRot.push([0, -6.0, 0]);
    }

    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('R_Elbow', times, rElbowRot));
    tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));
    tracks.push(makeQuatTrack('Neck', times, neckRot));
    tracks.push(makeQuatTrack('Spine', times, spineRot));

    return new THREE.AnimationClip('WaveCycle', duration, tracks);
  }

  if (action === 'scan') {
    // 3.0s tactical perimeter survey panning head and torso
    const duration = 3.0;
    const times = [0, 0.75, 1.5, 2.25, 3.0];
    const neckRot = [
      [5.0, 0.0, 0],
      [8.0, 48.0, 0],
      [4.0, 0.0, 0],
      [8.0, -48.0, 0],
      [5.0, 0.0, 0]
    ];
    const spineRot = [
      [2.0, 0.0, 0],
      [2.0, 14.0, 0],
      [2.0, 0.0, 0],
      [2.0, -14.0, 0],
      [2.0, 0.0, 0]
    ];
    const rArmRot = [
      [8.0, 0, -14.0],
      [12.0, 0, -14.0],
      [8.0, 0, -14.0],
      [12.0, 0, -14.0],
      [8.0, 0, -14.0]
    ];
    const lArmRot = [
      [8.0, 0, 14.0],
      [12.0, 0, 14.0],
      [8.0, 0, 14.0],
      [12.0, 0, 14.0],
      [8.0, 0, 14.0]
    ];

    tracks.push(makeQuatTrack('Neck', times, neckRot));
    tracks.push(makeQuatTrack('Spine', times, spineRot));
    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));

    return new THREE.AnimationClip('ScanCycle', duration, tracks);
  }

  if (action === 'crouch') {
    // 2.0s deep squat inspection with reaching hand
    const duration = 2.0;
    const times = [0, 0.6, 1.4, 2.0];
    const pelvisPos = [
      [0, 0.95, 0],
      [0, 0.68, 0],
      [0, 0.68, 0],
      [0, 0.95, 0]
    ];
    const spineRot = [
      [0, 0, 0],
      [28.0, 0, 0],
      [32.0, 6.0, 0],
      [0, 0, 0]
    ];
    const neckRot = [
      [0, 0, 0],
      [-22.0, 0, 0],
      [-24.0, 0, 0],
      [0, 0, 0]
    ];
    const lHipRot = [
      [0, 0, 0],
      [-48.0, 0, 0],
      [-48.0, 0, 0],
      [0, 0, 0]
    ];
    const rHipRot = [
      [0, 0, 0],
      [-46.0, 0, 0],
      [-46.0, 0, 0],
      [0, 0, 0]
    ];
    const lKneeRot = [
      [0, 0, 0],
      [-66.0, 0, 0],
      [-66.0, 0, 0],
      [0, 0, 0]
    ];
    const rKneeRot = [
      [0, 0, 0],
      [-64.0, 0, 0],
      [-64.0, 0, 0],
      [0, 0, 0]
    ];
    const rArmRot = [
      [0, 0, -10.0],
      [42.0, 0, -6.0],
      [48.0, 0, -6.0],
      [0, 0, -10.0]
    ];
    const rElbowRot = [
      [20.0, 0, 0],
      [45.0, 0, 0],
      [48.0, 0, 0],
      [20.0, 0, 0]
    ];

    tracks.push(makePosTrack('Pelvis', times, pelvisPos));
    tracks.push(makeQuatTrack('Spine', times, spineRot));
    tracks.push(makeQuatTrack('Neck', times, neckRot));
    tracks.push(makeQuatTrack('L_Hip', times, lHipRot));
    tracks.push(makeQuatTrack('R_Hip', times, rHipRot));
    tracks.push(makeQuatTrack('L_Knee', times, lKneeRot));
    tracks.push(makeQuatTrack('R_Knee', times, rKneeRot));
    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('R_Elbow', times, rElbowRot));

    return new THREE.AnimationClip('InspectCrouchCycle', duration, tracks);
  }

  if (action === 'celebrate') {
    // 1.5s victory double arm pump
    const duration = 1.5;
    const numFrames = 7;
    const times = [];
    const lArmRot = [];
    const rArmRot = [];
    const spineRot = [];
    const neckRot = [];

    for (let i = 0; i < numFrames; i++) {
      const t = (i / (numFrames - 1)) * duration;
      const phase = (i / (numFrames - 1)) * Math.PI * 2;
      times.push(t);

      const pump = 15.0 * Math.sin(phase);
      lArmRot.push([20.0 + pump, 0, 125.0]);
      rArmRot.push([20.0 + pump, 0, -125.0]);
      spineRot.push([-10.0, 0, 0]); // Arch chest up
      neckRot.push([18.0, 0, 0]); // Look up at sky
    }

    tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));
    tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));
    tracks.push(makeQuatTrack('Spine', times, spineRot));
    tracks.push(makeQuatTrack('Neck', times, neckRot));

    return new THREE.AnimationClip('CelebrateCycle', duration, tracks);
  }

  // Default: Idle breathing cycle
  const duration = 2.0;
  const times = [0, 1.0, 2.0];
  const spineRot = [
    [0, 0, 0],
    [3.0, 0, 0],
    [0, 0, 0]
  ];
  const neckRot = [
    [0, 0, 0],
    [2.0, 0, 0],
    [0, 0, 0]
  ];
  const lArmRot = [
    [-4.0, 0, 10.0],
    [-2.0, 0, 12.0],
    [-4.0, 0, 10.0]
  ];
  const rArmRot = [
    [-4.0, 0, -10.0],
    [-2.0, 0, -12.0],
    [-4.0, 0, -10.0]
  ];

  tracks.push(makeQuatTrack('Spine', times, spineRot));
  tracks.push(makeQuatTrack('Neck', times, neckRot));
  tracks.push(makeQuatTrack('L_Shoulder', times, lArmRot));
  tracks.push(makeQuatTrack('R_Shoulder', times, rArmRot));

  return new THREE.AnimationClip('IdleBreathCycle', duration, tracks);
}

/**
 * Exports a robot model with its action clip into binary GLB format.
 */
function exportModel(actionName, filename) {
  return new Promise((resolve, reject) => {
    const { root } = buildRobotHierarchy();
    const clip = generateAnimationClip(actionName);

    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (glbBuffer) => {
        const outPath = path.join(outputDir, filename);
        fs.writeFileSync(outPath, Buffer.from(glbBuffer));
        console.log(`[EXPORTED] ${filename} (${glbBuffer.byteLength} bytes) with animation '${clip.name}'`);
        resolve(outPath);
      },
      (err) => reject(err),
      {
        binary: true,
        animations: [clip]
      }
    );
  });
}

async function main() {
  console.log('Generating realistic 16-DOF articulated GLB models with animation tracks...');

  await exportModel('walk', 'humanoid_walk.glb');
  await exportModel('walk', 'humanoid_robot.glb'); // default
  await exportModel('jog', 'humanoid_jog.glb');
  await exportModel('idle', 'humanoid_idle.glb');
  await exportModel('wave', 'humanoid_wave.glb');
  await exportModel('scan', 'humanoid_scan.glb');
  await exportModel('crouch', 'humanoid_crouch.glb');
  await exportModel('celebrate', 'humanoid_celebrate.glb');
  await exportModel('crouch', 'humanoid_drop.glb');

  console.log('All 9 production-grade animated humanoid robot models successfully generated!');
}

main().catch((err) => {
  console.error('Fatal generator error:', err);
  process.exit(1);
});
