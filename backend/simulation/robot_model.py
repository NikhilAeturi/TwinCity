"""
RoboTwin Humanoid Kinematic and Actuator Manager
Maintains joint mappings, default home postures, and actuator control interfaces.
"""

import numpy as np
import mujoco
from typing import Dict, List, Any, Optional

class HumanoidRobot:
    # Actuator and joint grouping constants
    RIGHT_ARM_JOINTS = [
        "r_shoulder_pitch", "r_shoulder_roll", "r_shoulder_yaw",
        "r_elbow", "r_wrist_pitch", "r_wrist_yaw", "r_wrist_roll"
    ]
    RIGHT_ARM_ACTUATORS = [
        "act_r_shoulder_pitch", "act_r_shoulder_roll", "act_r_shoulder_yaw",
        "act_r_elbow", "act_r_wrist_pitch", "act_r_wrist_yaw", "act_r_wrist_roll"
    ]

    LEFT_ARM_JOINTS = [
        "l_shoulder_pitch", "l_shoulder_roll", "l_shoulder_yaw",
        "l_elbow", "l_wrist_pitch", "l_wrist_yaw", "l_wrist_roll"
    ]
    LEFT_ARM_ACTUATORS = [
        "act_l_shoulder_pitch", "act_l_shoulder_roll", "act_l_shoulder_yaw",
        "act_l_elbow", "act_l_wrist_pitch", "act_l_wrist_yaw", "act_l_wrist_roll"
    ]

    RIGHT_GRIPPER_ACTUATORS = ["act_r_gripper_l", "act_r_gripper_r"]
    LEFT_GRIPPER_ACTUATORS = ["act_l_gripper_l", "act_l_gripper_r"]

    TORSO_ACTUATORS = ["act_spine_pitch", "act_spine_yaw", "act_neck_pitch", "act_neck_yaw"]
    LEG_ACTUATORS = [
        "act_r_hip_yaw", "act_r_hip_roll", "act_r_hip_pitch", "act_r_knee", "act_r_ankle_pitch", "act_r_ankle_roll",
        "act_l_hip_yaw", "act_l_hip_roll", "act_l_hip_pitch", "act_l_knee", "act_l_ankle_pitch", "act_l_ankle_roll"
    ]

    def __init__(self, model: mujoco.MjModel):
        self.model = model
        self.actuator_map = {
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_ACTUATOR, i): i
            for i in range(model.nu)
        }
        self.joint_map = {
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, i): i
            for i in range(model.njnt)
        }
        self.body_map = {
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, i): i
            for i in range(model.nbody)
        }
        self.site_map = {
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_SITE, i): i
            for i in range(model.nsite)
        }

    def set_home_pose(self, data: mujoco.MjData):
        """Sets default standing posture and arm relaxation."""
        data.qvel[:] = 0.0

        # Gentle natural arm rest angles (in degrees)
        default_angles = {
            "act_spine_pitch": 5.0,
            "act_spine_yaw": 0.0,
            "act_neck_pitch": 10.0,
            "act_neck_yaw": 0.0,
            # Right arm relaxed at side
            "act_r_shoulder_pitch": -15.0,
            "act_r_shoulder_roll": -10.0,
            "act_r_shoulder_yaw": 0.0,
            "act_r_elbow": 25.0,
            "act_r_wrist_pitch": 0.0,
            "act_r_wrist_yaw": 0.0,
            "act_r_wrist_roll": 0.0,
            # Left arm relaxed at side
            "act_l_shoulder_pitch": -15.0,
            "act_l_shoulder_roll": 10.0,
            "act_l_shoulder_yaw": 0.0,
            "act_l_elbow": 25.0,
            "act_l_wrist_pitch": 0.0,
            "act_l_wrist_yaw": 0.0,
            "act_l_wrist_roll": 0.0,
            # Grippers open
            "act_r_gripper_l": 0.003,
            "act_r_gripper_r": -0.003,
            "act_l_gripper_l": 0.003,
            "act_l_gripper_r": -0.003,
            # Legs straight standing
            "act_r_hip_pitch": -5.0,
            "act_r_knee": 10.0,
            "act_r_ankle_pitch": -5.0,
            "act_l_hip_pitch": -5.0,
            "act_l_knee": 10.0,
            "act_l_ankle_pitch": -5.0,
        }

        for act_name, val in default_angles.items():
            if act_name in self.actuator_map:
                act_id = self.actuator_map[act_name]
                data.ctrl[act_id] = val

    def set_gripper(self, data: mujoco.MjData, arm: str = "right", open_amount: float = 1.0):
        """
        open_amount: 1.0 (fully open) to 0.0 (fully closed/grasping)
        """
        # Linear slide gripper ranges: open is positive separation, closed is clamping
        l_act = f"act_{arm[0]}_gripper_l"
        r_act = f"act_{arm[0]}_gripper_r"

        if l_act in self.actuator_map and r_act in self.actuator_map:
            l_id = self.actuator_map[l_act]
            r_id = self.actuator_map[r_act]
            # open_amount: 0.0 -> -0.022 (closed), 1.0 -> 0.004 (open)
            stroke = -0.022 * (1.0 - open_amount) + 0.004 * open_amount
            data.ctrl[l_id] = stroke
            data.ctrl[r_id] = -stroke

    def get_site_position(self, data: mujoco.MjData, site_name: str) -> np.ndarray:
        if site_name in self.site_map:
            site_id = self.site_map[site_name]
            return data.site_xpos[site_id].copy()
        return np.zeros(3)

    def get_body_pose(self, data: mujoco.MjData, body_name: str) -> Dict[str, Any]:
        if body_name in self.body_map:
            bid = self.body_map[body_name]
            pos = data.xpos[bid].tolist()
            quat = data.xquat[bid].tolist()  # [w, x, y, z]
            return {"position": pos, "quaternion": quat}
        return {"position": [0, 0, 0], "quaternion": [1, 0, 0, 0]}

    def check_gripper_contact(self, model: mujoco.MjModel, data: mujoco.MjData, target_body_name: str = "water_bottle_1") -> bool:
        """
        Verifies if right gripper fingers have contact with target object.
        """
        target_bid = self.body_map.get(target_body_name, -1)
        r_finger_l_bid = self.body_map.get("r_finger_left", -1)
        r_finger_r_bid = self.body_map.get("r_finger_right", -1)

        if target_bid < 0:
            return False

        for i in range(data.ncon):
            con = data.contact[i]
            b1 = model.geom_bodyid[con.geom1]
            b2 = model.geom_bodyid[con.geom2]
            if (b1 == target_bid and b2 in [r_finger_l_bid, r_finger_r_bid]) or \
               (b2 == target_bid and b1 in [r_finger_l_bid, r_finger_r_bid]):
                return True
        return False
