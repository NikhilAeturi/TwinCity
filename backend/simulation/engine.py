"""
RoboTwin Core Physics Simulation Engine
Runs the MuJoCo simulation loop, coordinates IK, locomotion, skills, and serializes state telemetry.
"""

import time
import threading
import numpy as np
import mujoco
from typing import Dict, Any, List, Optional
import os

from .scene_builder import SceneBuilder
from .robot_model import HumanoidRobot
from .ik_solver import IKSolver
from .locomotion import LocomotionController
from ..planner.skills import RobotSkillExecutor, SkillStatus

class SimulationEngine:
    def __init__(self, scenes_dir: str, robot_xml_path: str):
        self.scenes_dir = scenes_dir
        self.robot_xml_path = robot_xml_path
        self.builder = SceneBuilder(scenes_dir, robot_xml_path)
        self.ik_solver = IKSolver()
        self.locomotion = LocomotionController()

        self.model: Optional[mujoco.MjModel] = None
        self.data: Optional[mujoco.MjData] = None
        self.robot: Optional[HumanoidRobot] = None
        self.skill_executor: Optional[RobotSkillExecutor] = None

        self.scene_config: Dict[str, Any] = {}
        self.is_running = False
        self.is_paused = False
        self.speed_multiplier = 1.0
        self.sim_thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()

        # Attached object tracking for pick-and-place
        self.attached_object_id: Optional[str] = None
        self.attached_site_name: Optional[str] = None
        self.attached_relative_pos = np.array([0.0, 0.0, -0.05])

        # Active Task Execution state
        self.active_task_plan: Optional[Dict[str, Any]] = None
        self.current_step_index: int = -1
        self.task_completed: bool = False
        self.task_success: bool = False
        self.last_status_message: str = "Robot idle"

        # Initialize simulation
        self.load_scene("default_room.json")

    def load_scene(self, scene_filename: str = "default_room.json"):
        with self.lock:
            self.scene_config = self.builder.load_scene_config(scene_filename)
            xml_str = self.builder.build_full_scene_xml(self.scene_config)

            self.model = mujoco.MjModel.from_xml_string(xml_str)
            self.data = mujoco.MjData(self.model)
            self.robot = HumanoidRobot(self.model)
            self.skill_executor = RobotSkillExecutor(self)

            # Set initial home standing pose
            self.robot.set_home_pose(self.data)
            mujoco.mj_forward(self.model, self.data)

            # Reset task state
            self.active_task_plan = None
            self.current_step_index = -1
            self.task_completed = False
            self.task_success = False
            self.attached_object_id = None
            self.last_status_message = "Scene loaded and initialized"

    def reset_simulation(self):
        with self.lock:
            mujoco.mj_resetData(self.model, self.data)
            self.robot.set_home_pose(self.data)
            self.attached_object_id = None
            self.active_task_plan = None
            self.current_step_index = -1
            self.task_completed = False
            self.task_success = False
            self.last_status_message = "Simulation reset to spawn state"
            mujoco.mj_forward(self.model, self.data)

    def set_task_plan(self, task_plan: Dict[str, Any]):
        with self.lock:
            self.active_task_plan = task_plan
            self.current_step_index = 0
            self.task_completed = False
            self.task_success = False
            if task_plan.get("steps"):
                first_skill = task_plan["steps"][0]["skill"]
                self.skill_executor.reset_skill(first_skill)
                self.last_status_message = f"Starting step 1: {task_plan['steps'][0]['description']}"

    def step(self, dt: float = 0.005):
        with self.lock:
            if not self.model or not self.data:
                return

            # Execute active task step if available
            if self.active_task_plan and not self.task_completed:
                steps = self.active_task_plan.get("steps", [])
                if 0 <= self.current_step_index < len(steps):
                    step_info = steps[self.current_step_index]
                    skill_name = step_info["skill"]
                    params = step_info.get("params", {})

                    status, msg = self.skill_executor.step_skill(skill_name, params, dt)
                    self.last_status_message = msg

                    if status == SkillStatus.SUCCESS:
                        self.current_step_index += 1
                        if self.current_step_index < len(steps):
                            next_skill = steps[self.current_step_index]["skill"]
                            self.skill_executor.reset_skill(next_skill)
                            self.last_status_message = f"Starting step {self.current_step_index + 1}: {steps[self.current_step_index]['description']}"
                        else:
                            self.task_completed = True
                            self.task_success = True
                            self.last_status_message = "Task execution completed successfully! Object safely placed."
                    elif status == SkillStatus.FAILED:
                        self.task_completed = True
                        self.task_success = False
                        self.last_status_message = f"Task step failed: {msg}"

            # Synchronize attached object position if carried by hand
            if self.attached_object_id:
                hand_pos = self.robot.get_site_position(self.data, self.attached_site_name or "right_hand")
                obj_pos = hand_pos + self.attached_relative_pos
                self._set_freejoint_body_pos(self.attached_object_id, obj_pos)

            # Step physical dynamics
            mujoco.mj_step(self.model, self.data)

    def attach_object_to_hand(self, object_id: str, site_name: str = "right_hand"):
        self.attached_object_id = object_id
        self.attached_site_name = site_name

    def detach_object(self, object_id: str):
        if self.attached_object_id == object_id:
            self.attached_object_id = None

    def _set_freejoint_body_pos(self, body_name: str, pos: np.ndarray):
        bid = self.robot.body_map.get(body_name, -1)
        if bid >= 0 and self.model.body_jntnum[bid] > 0:
            jnt_adr = self.model.body_jntadr[bid]
            qpos_adr = self.model.jnt_qposadr[jnt_adr]
            self.data.qpos[qpos_adr : qpos_adr + 3] = pos
            # zero linear velocity
            dof_adr = self.model.jnt_dofadr[jnt_adr]
            self.data.qvel[dof_adr : dof_adr + 3] = 0.0

    def get_object_position(self, object_id: str) -> Optional[np.ndarray]:
        # Check if it's a known body
        bid = self.robot.body_map.get(object_id, -1)
        if bid >= 0:
            return self.data.xpos[bid].copy()

        # Check scene config for static definitions
        for obj in self.scene_config.get("objects", []):
            if obj.get("id") == object_id:
                return np.array(obj.get("position", [0, 0, 0]), dtype=np.float64)
        return None

    def set_mocap_pos(self, mocap_body_name: str, pos: np.ndarray):
        bid = self.robot.body_map.get(mocap_body_name, -1)
        if bid >= 0 and self.model.body_mocapid[bid] >= 0:
            mocap_id = self.model.body_mocapid[bid]
            self.data.mocap_pos[mocap_id] = pos

    def start_loop(self):
        if self.is_running:
            return
        self.is_running = True
        self.sim_thread = threading.Thread(target=self._run_loop, daemon=True)
        self.sim_thread.start()

    def stop_loop(self):
        self.is_running = False
        if self.sim_thread:
            self.sim_thread.join(timeout=1.0)

    def _run_loop(self):
        base_dt = 0.005
        while self.is_running:
            t0 = time.time()
            if not self.is_paused:
                steps_per_tick = max(1, int(self.speed_multiplier))
                for _ in range(steps_per_tick):
                    self.step(base_dt)

            elapsed = time.time() - t0
            sleep_time = max(0.001, (base_dt / max(0.1, self.speed_multiplier)) - elapsed)
            time.sleep(sleep_time)

    def get_telemetry_snapshot(self) -> Dict[str, Any]:
        """
        Extracts lightweight JSON serializable state for 3D visualization.
        """
        with self.lock:
            if not self.model or not self.data:
                return {"status": "uninitialized"}

            # Robot root position & rotation
            pelvis_bid = self.robot.body_map.get("pelvis", 0)
            pelvis_pos = self.data.xpos[pelvis_bid].tolist()
            pelvis_quat = self.data.xquat[pelvis_bid].tolist()

            # Key body segment positions for Three.js skeleton alignment
            body_poses = {}
            for bname in [
                "torso", "head", "right_shoulder", "right_upper_arm", "right_forearm", "right_wrist",
                "left_shoulder", "left_upper_arm", "left_forearm", "left_wrist",
                "right_hip", "right_knee", "right_ankle",
                "left_hip", "left_knee", "left_ankle"
            ]:
                if bname in self.robot.body_map:
                    bid = self.robot.body_map[bname]
                    body_poses[bname] = {
                        "pos": self.data.xpos[bid].tolist(),
                        "quat": self.data.xquat[bid].tolist()
                    }

            # Interactive Objects poses
            objects_state = {}
            for obj in self.scene_config.get("objects", []):
                oid = obj.get("id")
                if oid in self.robot.body_map:
                    bid = self.robot.body_map[oid]
                    objects_state[oid] = {
                        "pos": self.data.xpos[bid].tolist(),
                        "quat": self.data.xquat[bid].tolist(),
                        "movable": obj.get("movable", False)
                    }
                else:
                    objects_state[oid] = {
                        "pos": obj.get("position", [0, 0, 0]),
                        "quat": [1, 0, 0, 0],
                        "movable": False
                    }

            # Hand positions & contact
            r_hand_pos = self.robot.get_site_position(self.data, "right_hand").tolist()
            l_hand_pos = self.robot.get_site_position(self.data, "left_hand").tolist()
            has_bottle_contact = self.robot.check_gripper_contact(self.model, self.data, "water_bottle_1")

            # Task progress
            total_steps = len(self.active_task_plan["steps"]) if self.active_task_plan else 0
            curr_step = self.current_step_index + 1 if self.active_task_plan else 0
            progress = (curr_step / total_steps) if total_steps > 0 else 0.0

            return {
                "sim_time": float(self.data.time),
                "is_paused": self.is_paused,
                "speed_multiplier": self.speed_multiplier,
                "robot": {
                    "pelvis": {"pos": pelvis_pos, "quat": pelvis_quat},
                    "right_hand_pos": r_hand_pos,
                    "left_hand_pos": l_hand_pos,
                    "body_poses": body_poses,
                    "has_contact": has_bottle_contact,
                    "is_holding": self.attached_object_id is not None
                },
                "objects": objects_state,
                "task": {
                    "active": self.active_task_plan is not None,
                    "plan": self.active_task_plan,
                    "current_step": self.current_step_index,
                    "completed": self.task_completed,
                    "success": self.task_success,
                    "progress": progress,
                    "status_message": self.last_status_message
                }
            }
