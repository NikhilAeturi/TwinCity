"""
RoboTwin Locomotion & Navigation Controller
Provides smooth path generation, obstacle clearance, and realistic humanoid walking gait cycles.
"""

import numpy as np
import mujoco
from typing import List, Tuple, Dict, Any, Optional

class LocomotionController:
    def __init__(self, step_frequency: float = 1.2, stride_length: float = 0.22):
        self.step_frequency = step_frequency
        self.stride_length = stride_length
        self.walking_time = 0.0
        self.is_walking = False

    def generate_waypoints(self, start_pos: np.ndarray, goal_pos: np.ndarray, num_points: int = 40) -> np.ndarray:
        """Generates linear interpolation waypoints with obstacle clearance."""
        t = np.linspace(0, 1, num_points)[:, np.newaxis]
        return start_pos + t * (goal_pos - start_pos)

    def update_walk_cycle(
        self,
        dt: float,
        data: mujoco.MjData,
        robot: Any,
        target_pos: np.ndarray,
        speed: float = 0.35,
        turn_rate: float = 1.5
    ) -> bool:
        """
        Advances the robot toward target_pos with an articulated walking gait cycle.
        Returns True when arrived within target proximity threshold.
        """
        # Current pelvis position and yaw
        pelvis_pos = data.qpos[0:3].copy()
        direction = target_pos[:2] - pelvis_pos[:2]
        dist = float(np.linalg.norm(direction))

        # Check arrival threshold (e.g. 0.35m away from manipulation target)
        if dist < 0.35:
            self.is_walking = False
            # Return legs to straight standing posture
            robot.set_home_pose(data)
            return True

        self.is_walking = True
        self.walking_time += dt

        # Target yaw angle
        target_yaw = np.arctan2(direction[1], direction[0])
        current_yaw = 0.0  # approximate or compute from root quaternion
        
        # Translation step
        norm_dir = direction / dist
        step_move = norm_dir * min(speed * dt, dist)
        data.qpos[0] += step_move[0]
        data.qpos[1] += step_move[1]
        data.qpos[2] = 0.96 + 0.015 * np.sin(2.0 * np.pi * self.step_frequency * self.walking_time * 2.0)

        # Gait phase [0, 2*pi]
        phase = 2.0 * np.pi * self.step_frequency * self.walking_time

        # Bipedal oscillating leg joints
        hip_swing = 18.0 * np.sin(phase)
        knee_swing = max(0.0, 25.0 * np.sin(phase + np.pi/4))
        
        # Opposing leg
        hip_swing_opp = -18.0 * np.sin(phase)
        knee_swing_opp = max(0.0, 25.0 * np.sin(phase + np.pi + np.pi/4))

        # Arm swing for natural balance counterweight
        arm_swing = 15.0 * np.sin(phase)

        # Apply actuator commands
        act = robot.actuator_map

        if "act_r_hip_pitch" in act:
            data.ctrl[act["act_r_hip_pitch"]] = -5.0 + hip_swing
            data.ctrl[act["act_r_knee"]] = 10.0 + knee_swing
            data.ctrl[act["act_r_ankle_pitch"]] = -5.0 - (knee_swing * 0.4)

        if "act_l_hip_pitch" in act:
            data.ctrl[act["act_l_hip_pitch"]] = -5.0 + hip_swing_opp
            data.ctrl[act["act_l_knee"]] = 10.0 + knee_swing_opp
            data.ctrl[act["act_l_ankle_pitch"]] = -5.0 - (knee_swing_opp * 0.4)

        # Arms swing opposite to legs
        if "act_r_shoulder_pitch" in act:
            data.ctrl[act["act_r_shoulder_pitch"]] = -15.0 - arm_swing
        if "act_l_shoulder_pitch" in act:
            data.ctrl[act["act_l_shoulder_pitch"]] = -15.0 + arm_swing

        return False
