"""
Generates production-grade 3D Humanoid Robot GLB assets for RoboTwin.
Creates articulated robot models with realistic anatomical poses for:
- idle: balanced upright stance
- walk: bipedal walking stride with arm counter-swing
- jog: athletic running posture with deep stride and high arm drive
- crouch: deep inspection squat with forward reach
- scan: tactical perimeter survey with panned sensor head
- wave: friendly greeting gesture with raised waving arm
- celebrate: double-arm victory pose
- drop: airborne drop and shock-absorption tuck
"""

import os
import math
import numpy as np
import trimesh
from trimesh.creation import cylinder, box, icosphere
from trimesh.transformations import rotation_matrix, translation_matrix

def create_humanoid_robot(pose: str = "idle"):
    meshes = []

    # Colors (RGBA)
    c_chassis = [50, 58, 72, 255]       # Dark Gunmetal Gray
    c_armor = [220, 226, 235, 255]      # Ceramic White Armor
    c_accent = [56, 189, 248, 255]      # Cyan Accent / Joints
    c_visor = [6, 182, 212, 255]        # Glowing Cyan Visor
    c_gold = [245, 158, 11, 255]        # Warning Gold Markings

    def colorize(mesh, color):
        mesh.visual.vertex_colors = np.tile(color, (len(mesh.vertices), 1))
        return mesh

    def rot_x(deg):
        return rotation_matrix(math.radians(deg), [1, 0, 0])

    def rot_y(deg):
        return rotation_matrix(math.radians(deg), [0, 1, 0])

    def rot_z(deg):
        return rotation_matrix(math.radians(deg), [0, 0, 1])

    # Pose configuration parameters
    pelvis_z = 0.95
    pelvis_pitch = 0.0
    spine_pitch = 0.0
    spine_yaw = 0.0
    head_pitch = 0.0
    head_yaw = 0.0

    # Arm angles (degrees): pitch (forward/back), roll (outward/abduct), elbow (flexion)
    r_arm = {"pitch": -5.0, "roll": -10.0, "elbow": 20.0}
    l_arm = {"pitch": -5.0, "roll": 10.0, "elbow": 20.0}

    # Leg angles (degrees): hip_pitch, knee_flex, ankle_pitch
    r_leg = {"hip_pitch": 0.0, "knee": 5.0, "ankle": 0.0}
    l_leg = {"hip_pitch": 0.0, "knee": 5.0, "ankle": 0.0}

    if pose == "walk":
        pelvis_pitch = 3.0
        spine_pitch = 4.0
        # Right leg forward, left leg back
        r_leg = {"hip_pitch": -22.0, "knee": 26.0, "ankle": -6.0}
        l_leg = {"hip_pitch": 18.0, "knee": 10.0, "ankle": 8.0}
        # Left arm forward, right arm back
        l_arm = {"pitch": 24.0, "roll": 12.0, "elbow": 35.0}
        r_arm = {"pitch": -24.0, "roll": -12.0, "elbow": 25.0}

    elif pose == "jog":
        pelvis_pitch = 8.0
        spine_pitch = 10.0
        # Deep running stride
        r_leg = {"hip_pitch": -36.0, "knee": 48.0, "ankle": -12.0}
        l_leg = {"hip_pitch": 32.0, "knee": 22.0, "ankle": 15.0}
        # Athletic high arm drive
        l_arm = {"pitch": 45.0, "roll": 15.0, "elbow": 75.0}
        r_arm = {"pitch": -40.0, "roll": -15.0, "elbow": 65.0}

    elif pose in ("crouch", "inspect"):
        pelvis_z = 0.68  # Drop pelvis into low squat
        pelvis_pitch = 18.0
        spine_pitch = 28.0
        head_pitch = -18.0  # Look down at target
        # Deep knee bend
        r_leg = {"hip_pitch": -48.0, "knee": 68.0, "ankle": -20.0}
        l_leg = {"hip_pitch": -45.0, "knee": 65.0, "ankle": -18.0}
        # Right arm reach forward to inspect latch
        r_arm = {"pitch": 42.0, "roll": -5.0, "elbow": 45.0}
        l_arm = {"pitch": 5.0, "roll": 20.0, "elbow": 40.0}

    elif pose == "scan":
        head_yaw = 48.0  # Head turned to survey environment
        head_pitch = 5.0
        spine_yaw = 15.0
        # Tactical balanced stance
        r_arm = {"pitch": 5.0, "roll": -15.0, "elbow": 35.0}
        l_arm = {"pitch": 5.0, "roll": 15.0, "elbow": 35.0}

    elif pose == "wave":
        head_pitch = 8.0
        head_yaw = -10.0
        # Right arm raised in friendly wave
        r_arm = {"pitch": 20.0, "roll": -115.0, "elbow": 85.0}
        l_arm = {"pitch": -5.0, "roll": 8.0, "elbow": 15.0}

    elif pose == "celebrate":
        pelvis_pitch = -4.0
        spine_pitch = -8.0  # Chest arched in victory
        head_pitch = 16.0  # Looking up at sky
        # Both arms raised in high victory 'V'
        r_arm = {"pitch": 15.0, "roll": -125.0, "elbow": 25.0}
        l_arm = {"pitch": 15.0, "roll": 125.0, "elbow": 25.0}

    elif pose in ("drop", "spawn"):
        pelvis_z = 0.82
        pelvis_pitch = 8.0
        spine_pitch = 12.0
        # Shock-absorption knee flexion
        r_leg = {"hip_pitch": -25.0, "knee": 42.0, "ankle": -10.0}
        l_leg = {"hip_pitch": -25.0, "knee": 42.0, "ankle": -10.0}
        # Outstretched balancing arms
        r_arm = {"pitch": 15.0, "roll": -35.0, "elbow": 30.0}
        l_arm = {"pitch": 15.0, "roll": 35.0, "elbow": 30.0}

    # 1. Pelvis
    pelvis = colorize(box(extents=[0.24, 0.16, 0.14]), c_chassis)
    pelvis_mat = np.dot(translation_matrix([0, 0, pelvis_z]), rot_x(pelvis_pitch))
    pelvis.apply_transform(pelvis_mat)
    meshes.append(pelvis)

    pelvis_armor = colorize(box(extents=[0.26, 0.17, 0.08]), c_armor)
    pelvis_armor.apply_transform(pelvis_mat)
    meshes.append(pelvis_armor)

    # 2. Spine & Torso (Parented above pelvis)
    spine_z_offset = 0.11
    spine_base_pos = [0, 0, pelvis_z + spine_z_offset]
    spine = colorize(cylinder(radius=0.07, height=0.12), c_accent)
    spine_mat = np.dot(
        translation_matrix(spine_base_pos),
        np.dot(rot_z(spine_yaw), rot_x(spine_pitch + pelvis_pitch))
    )
    spine.apply_transform(spine_mat)
    meshes.append(spine)

    torso = colorize(box(extents=[0.32, 0.20, 0.28]), c_chassis)
    torso_local = translation_matrix([0, 0, 0.18])
    torso.apply_transform(np.dot(spine_mat, torso_local))
    meshes.append(torso)

    chest_plate = colorize(box(extents=[0.30, 0.06, 0.22]), c_armor)
    chest_local = translation_matrix([0, 0.10, 0.19])
    chest_plate.apply_transform(np.dot(spine_mat, chest_local))
    meshes.append(chest_plate)

    # Arc Reactor Core Sensor
    chest_core = colorize(cylinder(radius=0.045, height=0.03), c_visor)
    core_local = np.dot(translation_matrix([0, 0.13, 0.20]), rot_x(90))
    chest_core.apply_transform(np.dot(spine_mat, core_local))
    meshes.append(chest_core)

    # 3. Neck & Head
    neck_local = translation_matrix([0, 0, 0.35])
    neck_mat = np.dot(spine_mat, neck_local)
    neck = colorize(cylinder(radius=0.045, height=0.08), c_accent)
    neck.apply_transform(neck_mat)
    meshes.append(neck)

    head_local = np.dot(
        translation_matrix([0, 0.02, 0.14]),
        np.dot(rot_z(head_yaw), rot_x(head_pitch))
    )
    head_mat = np.dot(neck_mat, head_local)
    head = colorize(box(extents=[0.18, 0.20, 0.20]), c_armor)
    head.apply_transform(head_mat)
    meshes.append(head)

    # Visor
    visor_local = translation_matrix([0, 0.10, 0.01])
    visor = colorize(box(extents=[0.16, 0.04, 0.07]), c_visor)
    visor.apply_transform(np.dot(head_mat, visor_local))
    meshes.append(visor)

    # Head Antenna
    antenna_local = translation_matrix([0.07, -0.05, 0.13])
    antenna = colorize(cylinder(radius=0.008, height=0.12), c_gold)
    antenna.apply_transform(np.dot(head_mat, antenna_local))
    meshes.append(antenna)

    # 4. Arms & Shoulders
    arm_configs = [("L", 1, l_arm), ("R", -1, r_arm)]
    for side, sign, cfg in arm_configs:
        # Shoulder anchor on torso
        shoulder_anchor = translation_matrix([sign * 0.22, 0, 0.27])
        shoulder_joint_mat = np.dot(spine_mat, shoulder_anchor)

        shoulder_ball = colorize(icosphere(subdivisions=2, radius=0.06), c_accent)
        shoulder_ball.apply_transform(shoulder_joint_mat)
        meshes.append(shoulder_ball)

        # Shoulder rotation (pitch + roll)
        arm_rot = np.dot(rot_x(cfg["pitch"]), rot_y(cfg["roll"]))
        upper_arm_frame = np.dot(shoulder_joint_mat, arm_rot)

        upper_arm = colorize(cylinder(radius=0.042, height=0.22), c_armor)
        upper_arm.apply_transform(np.dot(upper_arm_frame, translation_matrix([0, 0, -0.13])))
        meshes.append(upper_arm)

        # Elbow Joint
        elbow_frame = np.dot(upper_arm_frame, translation_matrix([0, 0, -0.26]))
        elbow_ball = colorize(icosphere(subdivisions=2, radius=0.045), c_accent)
        elbow_ball.apply_transform(elbow_frame)
        meshes.append(elbow_ball)

        # Forearm rotation (elbow flexion)
        forearm_rot = np.dot(elbow_frame, rot_x(cfg["elbow"]))
        forearm = colorize(cylinder(radius=0.038, height=0.22), c_chassis)
        forearm.apply_transform(np.dot(forearm_rot, translation_matrix([0, 0.02, -0.13])))
        meshes.append(forearm)

        # Hand / Gripper
        hand = colorize(box(extents=[0.05, 0.08, 0.08]), c_armor)
        hand.apply_transform(np.dot(forearm_rot, translation_matrix([0, 0.03, -0.26])))
        meshes.append(hand)

    # 5. Hips, Legs & Feet
    leg_configs = [("L", 1, l_leg), ("R", -1, r_leg)]
    for side, sign, cfg in leg_configs:
        # Hip anchor on pelvis
        hip_anchor = translation_matrix([sign * 0.11, 0, -0.06])
        hip_joint_mat = np.dot(pelvis_mat, hip_anchor)

        hip_ball = colorize(icosphere(subdivisions=2, radius=0.06), c_accent)
        hip_ball.apply_transform(hip_joint_mat)
        meshes.append(hip_ball)

        # Thigh rotation (hip pitch)
        thigh_rot = np.dot(hip_joint_mat, rot_x(cfg["hip_pitch"]))
        thigh = colorize(cylinder(radius=0.055, height=0.38), c_armor)
        thigh.apply_transform(np.dot(thigh_rot, translation_matrix([0, 0, -0.21])))
        meshes.append(thigh)

        # Knee Joint
        knee_frame = np.dot(thigh_rot, translation_matrix([0, 0.02, -0.42]))
        knee_ball = colorize(icosphere(subdivisions=2, radius=0.052), c_accent)
        knee_ball.apply_transform(knee_frame)
        meshes.append(knee_ball)

        # Shin rotation (knee flexion)
        shin_rot = np.dot(knee_frame, rot_x(cfg["knee"]))
        shin = colorize(cylinder(radius=0.048, height=0.36), c_chassis)
        shin.apply_transform(np.dot(shin_rot, translation_matrix([0, -0.01, -0.20])))
        meshes.append(shin)

        # Ankle & Foot
        ankle_frame = np.dot(shin_rot, translation_matrix([0, 0, -0.40]))
        foot_rot = np.dot(ankle_frame, rot_x(cfg["ankle"]))
        foot = colorize(box(extents=[0.09, 0.22, 0.07]), c_armor)
        foot.apply_transform(np.dot(foot_rot, translation_matrix([0, 0.04, 0.03])))
        meshes.append(foot)

    # Combine all parts
    combined = trimesh.util.concatenate(meshes)
    return combined

if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/public/models"))
    os.makedirs(out_dir, exist_ok=True)

    poses = [
        ("idle", "humanoid_robot.glb"),
        ("idle", "humanoid_idle.glb"),
        ("walk", "humanoid_walk.glb"),
        ("jog", "humanoid_jog.glb"),
        ("crouch", "humanoid_crouch.glb"),
        ("scan", "humanoid_scan.glb"),
        ("wave", "humanoid_wave.glb"),
        ("celebrate", "humanoid_celebrate.glb"),
        ("drop", "humanoid_drop.glb")
    ]

    for pose_name, filename in poses:
        out_path = os.path.join(out_dir, filename)
        robot = create_humanoid_robot(pose=pose_name)
        robot.export(out_path, file_type="glb")
        print(f"Generated [{pose_name.upper():9s}] GLB -> {filename} ({len(robot.vertices)} verts)")
