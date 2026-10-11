import * as THREE from 'three';

/**
 * Creates and mounts a 16-DOF articulated humanoid robot digital twin rig
 * with metallic PBR shaders, articulated limbs, and real-time joint articulation.
 * Height: 1.76m (calibrated to real-life urban architecture scale).
 */
export function buildHumanoidRobotRig(options = {}) {
  const {
    armorColor = 0xe2e8f0,
    chassisColor = 0x334155,
    jointColor = 0x0284c7,
    visorColor = 0x06b6d4,
    coreColor = 0x38bdf8
  } = options;

  // Materials
  const matArmor = new THREE.MeshStandardMaterial({
    color: armorColor,
    metalness: 0.85,
    roughness: 0.22,
    envMapIntensity: 1.0
  });

  const matChassis = new THREE.MeshStandardMaterial({
    color: chassisColor,
    metalness: 0.9,
    roughness: 0.35
  });

  const matJoint = new THREE.MeshStandardMaterial({
    color: jointColor,
    metalness: 0.75,
    roughness: 0.25,
    emissive: jointColor,
    emissiveIntensity: 0.35
  });

  const matVisor = new THREE.MeshBasicMaterial({ color: visorColor });
  const matCore = new THREE.MeshBasicMaterial({ color: coreColor });

  // Root Group
  const robotRoot = new THREE.Group();
  robotRoot.name = 'AtlasG1_HumanoidRoot';

  const joints = {
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
  };

  // 1. Pelvis
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.95, 0);
  robotRoot.add(pelvisGroup);
  joints.pelvis = pelvisGroup;

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.14), matChassis);
  pelvisGroup.add(pelvisMesh);

  const pelvisArmor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.08), matArmor);
  pelvisArmor.position.set(0, 0.02, 0.01);
  pelvisGroup.add(pelvisArmor);

  // 2. Spine & Torso
  const spineJoint = new THREE.Group();
  spineJoint.position.set(0, 0.11, 0);
  pelvisGroup.add(spineJoint);
  joints.spine = spineJoint;

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
  joints.neck = neckJoint;

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), matJoint);
  neckJoint.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.14, 0.02);
  neckJoint.add(headGroup);
  joints.head = headGroup;

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.20), matArmor);
  headGroup.add(headMesh);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), matVisor);
  visorMesh.position.set(0, 0.01, 0.11);
  headGroup.add(visorMesh);

  const antennaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), matJoint);
  antennaMesh.position.set(0.07, 0.13, -0.05);
  headGroup.add(antennaMesh);

  // 4. Left Arm
  const lShoulderGroup = new THREE.Group();
  lShoulderGroup.position.set(0.22, 0.27, 0);
  spineJoint.add(lShoulderGroup);
  joints.lShoulder = lShoulderGroup;

  const lShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  lShoulderGroup.add(lShoulderBall);

  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16), matArmor);
  lUpperArm.position.set(0, -0.13, 0);
  lShoulderGroup.add(lUpperArm);

  const lElbowGroup = new THREE.Group();
  lElbowGroup.position.set(0, -0.26, 0);
  lShoulderGroup.add(lElbowGroup);
  joints.lElbow = lElbowGroup;

  const lElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), matJoint);
  lElbowGroup.add(lElbowBall);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 16), matChassis);
  lForearm.position.set(0, -0.13, 0.02);
  lElbowGroup.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matArmor);
  lHand.position.set(0, -0.26, 0.03);
  lElbowGroup.add(lHand);

  // 5. Right Arm
  const rShoulderGroup = new THREE.Group();
  rShoulderGroup.position.set(-0.22, 0.27, 0);
  spineJoint.add(rShoulderGroup);
  joints.rShoulder = rShoulderGroup;

  const rShoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  rShoulderGroup.add(rShoulderBall);

  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16), matArmor);
  rUpperArm.position.set(0, -0.13, 0);
  rShoulderGroup.add(rUpperArm);

  const rElbowGroup = new THREE.Group();
  rElbowGroup.position.set(0, -0.26, 0);
  rShoulderGroup.add(rElbowGroup);
  joints.rElbow = rElbowGroup;

  const rElbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), matJoint);
  rElbowGroup.add(rElbowBall);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 16), matChassis);
  rForearm.position.set(0, -0.13, 0.02);
  rElbowGroup.add(rForearm);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matArmor);
  rHand.position.set(0, -0.26, 0.03);
  rElbowGroup.add(rHand);

  // 6. Left Leg
  const lHipGroup = new THREE.Group();
  lHipGroup.position.set(0.11, -0.06, 0);
  pelvisGroup.add(lHipGroup);
  joints.lHip = lHipGroup;

  const lHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  lHipGroup.add(lHipBall);

  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
  lThigh.position.set(0, -0.21, 0);
  lHipGroup.add(lThigh);

  const lKneeGroup = new THREE.Group();
  lKneeGroup.position.set(0, -0.42, 0.02);
  lHipGroup.add(lKneeGroup);
  joints.lKnee = lKneeGroup;

  const lKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
  lKneeGroup.add(lKneeBall);

  const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
  lShin.position.set(0, -0.20, -0.01);
  lKneeGroup.add(lShin);

  const lAnkleGroup = new THREE.Group();
  lAnkleGroup.position.set(0, -0.40, 0);
  lKneeGroup.add(lAnkleGroup);
  joints.lAnkle = lAnkleGroup;

  const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
  lFoot.position.set(0, 0.03, 0.04);
  lAnkleGroup.add(lFoot);

  // 7. Right Leg
  const rHipGroup = new THREE.Group();
  rHipGroup.position.set(-0.11, -0.06, 0);
  pelvisGroup.add(rHipGroup);
  joints.rHip = rHipGroup;

  const rHipBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matJoint);
  rHipGroup.add(rHipBall);

  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 16), matArmor);
  rThigh.position.set(0, -0.21, 0);
  rHipGroup.add(rThigh);

  const rKneeGroup = new THREE.Group();
  rKneeGroup.position.set(0, -0.42, 0.02);
  rHipGroup.add(rKneeGroup);
  joints.rKnee = rKneeGroup;

  const rKneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), matJoint);
  rKneeGroup.add(rKneeBall);

  const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 16), matChassis);
  rShin.position.set(0, -0.20, -0.01);
  rKneeGroup.add(rShin);

  const rAnkleGroup = new THREE.Group();
  rAnkleGroup.position.set(0, -0.40, 0);
  rKneeGroup.add(rAnkleGroup);
  joints.rAnkle = rAnkleGroup;

  const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), matArmor);
  rFoot.position.set(0, 0.03, 0.04);
  rAnkleGroup.add(rFoot);

  // Ground contact ring
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.38, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.01;
  robotRoot.add(groundRing);

  return { robotRoot, joints };
}

/**
 * Updates all 16 joint rotations and posture from 60 FPS frame telemetry data.
 */
export function applyHumanoidKinematics(joints, frame) {
  if (!joints || !joints.pelvis || !frame) return;

  const j = frame.joints || {};
  const d2r = THREE.MathUtils.degToRad;

  // Pelvis vertical bobbing & terrain offset
  const vertOffset = frame.pos?.altitude_offset !== undefined ? frame.pos.altitude_offset : 0.0;
  joints.pelvis.position.y = 0.95 + vertOffset;

  // Body pitch and roll
  const pitch = frame.pitch || 0.0;
  const roll = frame.roll || 0.0;
  joints.pelvis.rotation.x = d2r(pitch);
  joints.pelvis.rotation.z = d2r(roll);

  // Spine
  if (joints.spine) {
    joints.spine.rotation.x = d2r(j.spine_pitch || 0.0);
    joints.spine.rotation.y = d2r(j.spine_yaw || 0.0);
  }

  // Neck & Head
  if (joints.neck) {
    joints.neck.rotation.x = d2r(j.neck_pitch || 0.0);
    joints.neck.rotation.y = d2r(j.neck_yaw || 0.0);
  }

  // Left Arm (Shoulder pitch, roll, elbow flexion)
  if (joints.lShoulder) {
    joints.lShoulder.rotation.x = d2r(j.l_shoulder_pitch || 0.0);
    joints.lShoulder.rotation.z = d2r(j.l_shoulder_roll || 10.0);
  }
  if (joints.lElbow) {
    joints.lElbow.rotation.x = d2r(j.l_elbow || 20.0);
  }

  // Right Arm
  if (joints.rShoulder) {
    joints.rShoulder.rotation.x = d2r(j.r_shoulder_pitch || 0.0);
    joints.rShoulder.rotation.z = d2r(j.r_shoulder_roll || -10.0);
  }
  if (joints.rElbow) {
    joints.rElbow.rotation.x = d2r(j.r_elbow || 20.0);
  }

  // Left Leg (Hip pitch, Knee flexion, Ankle pitch)
  if (joints.lHip) {
    joints.lHip.rotation.x = d2r(j.l_hip_pitch || 0.0);
  }
  if (joints.lKnee) {
    // Knee bends backward -> negative X rotation in Three.js
    joints.lKnee.rotation.x = d2r(-(j.l_knee || 5.0));
  }
  if (joints.lAnkle) {
    joints.lAnkle.rotation.x = d2r(j.l_ankle_pitch || 0.0);
  }

  // Right Leg
  if (joints.rHip) {
    joints.rHip.rotation.x = d2r(j.r_hip_pitch || 0.0);
  }
  if (joints.rKnee) {
    joints.rKnee.rotation.x = d2r(-(j.r_knee || 5.0));
  }
  if (joints.rAnkle) {
    joints.rAnkle.rotation.x = d2r(j.r_ankle_pitch || 0.0);
  }
}
