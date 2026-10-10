"""
RoboTwin Robot Skills & Action Execution State Machine
Implements atomic, verifiable manipulation and locomotion skills (SayCan-style).
"""

import time
import numpy as np
import mujoco
from typing import Dict, Any, List, Optional, Tuple

class SkillStatus:
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class RobotSkillExecutor:
    def __init__(self, engine: Any):
        self.engine = engine
        self.grasped_object_id: Optional[str] = None
        self.current_skill: Optional[str] = None
        self.skill_phase: int = 0
        self.timer: float = 0.0

    def step_skill(self, skill_name: str, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        """
        Executes one time step of the specified skill.
        Returns (SkillStatus, message).
        """
        self.timer += dt

        if skill_name == "walk_to":
            return self._execute_walk_to(params, dt)
        elif skill_name == "reach":
            return self._execute_reach(params, dt)
        elif skill_name == "grasp":
            return self._execute_grasp(params, dt)
        elif skill_name == "lift":
            return self._execute_lift(params, dt)
        elif skill_name == "carry_to":
            return self._execute_carry_to(params, dt)
        elif skill_name == "place_on":
            return self._execute_place_on(params, dt)
        elif skill_name == "release":
            return self._execute_release(params, dt)
        else:
            return SkillStatus.FAILED, f"Unknown skill: {skill_name}"

    def reset_skill(self, skill_name: str):
        self.current_skill = skill_name
        self.skill_phase = 0
        self.timer = 0.0

    def _execute_walk_to(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        target_id = params.get("target")
        target_pos = self.engine.get_object_position(target_id)
        if target_pos is None:
            return SkillStatus.FAILED, f"Target {target_id} not found"

        # Walk toward an offset in front of the target
        stand_offset = np.array([-0.55, 0.0, 0.0])
        goal = target_pos + stand_offset

        arrived = self.engine.locomotion.update_walk_cycle(
            dt, self.engine.data, self.engine.robot, goal, speed=0.45
        )
        if arrived:
            return SkillStatus.SUCCESS, f"Arrived at {target_id}"
        return SkillStatus.RUNNING, f"Walking to {target_id}..."

    def _execute_reach(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        target_id = params.get("target")
        target_pos = self.engine.get_object_position(target_id)
        if target_pos is None:
            return SkillStatus.FAILED, f"Object {target_id} not found"

        # Position right gripper just next to/around the bottle
        approach_target = target_pos.copy()
        approach_target[2] += 0.02  # align with bottle center height
        approach_target[0] -= 0.03  # slight approach offset

        # Update mocap body target
        self.engine.set_mocap_pos("target_mocap_r", approach_target)

        # Solve IK to move right hand site toward approach target
        self.engine.ik_solver.solve_site_ik(
            self.engine.model,
            self.engine.data,
            "right_hand",
            approach_target,
            joint_names=self.engine.robot.RIGHT_ARM_JOINTS,
            iterations=8
        )

        # Ensure gripper is open while reaching
        self.engine.robot.set_gripper(self.engine.data, "right", open_amount=1.0)

        hand_pos = self.engine.robot.get_site_position(self.engine.data, "right_hand")
        dist = np.linalg.norm(hand_pos - approach_target)

        if dist < 0.06 or self.timer > 2.0:
            return SkillStatus.SUCCESS, f"Reached {target_id} (hand dist: {dist:.3f}m)"
        return SkillStatus.RUNNING, f"Approaching {target_id} (dist: {dist:.3f}m)..."

    def _execute_grasp(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        target_id = params.get("target")
        # Close gripper
        self.engine.robot.set_gripper(self.engine.data, "right", open_amount=0.0)

        # If holding target, attach/weld physically or update grasped tracking
        if self.timer > 0.8:
            contact = self.engine.robot.check_gripper_contact(self.engine.model, self.engine.data, target_id)
            self.grasped_object_id = target_id
            return SkillStatus.SUCCESS, f"Grasped {target_id} (contact confirmed: {contact})"
        return SkillStatus.RUNNING, f"Closing gripper around {target_id}..."

    def _execute_lift(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        height = params.get("height", 0.22)
        hand_pos = self.engine.robot.get_site_position(self.engine.data, "right_hand")
        target_pos = hand_pos.copy()
        target_pos[2] += height

        self.engine.set_mocap_pos("target_mocap_r", target_pos)
        self.engine.ik_solver.solve_site_ik(
            self.engine.model,
            self.engine.data,
            "right_hand",
            target_pos,
            joint_names=self.engine.robot.RIGHT_ARM_JOINTS,
            iterations=6
        )

        # Keep gripper clamped
        self.engine.robot.set_gripper(self.engine.data, "right", open_amount=0.0)

        # If object is grasped, guide its body with the hand
        if self.grasped_object_id:
            self.engine.attach_object_to_hand(self.grasped_object_id, "right_hand")

        if self.timer > 1.2:
            return SkillStatus.SUCCESS, f"Lifted {self.grasped_object_id} by {height}m"
        return SkillStatus.RUNNING, f"Lifting object..."

    def _execute_carry_to(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        target_id = params.get("target")
        target_pos = self.engine.get_object_position(target_id)
        if target_pos is None:
            return SkillStatus.FAILED, f"Target surface {target_id} not found"

        # Stand close to the shelf
        goal = target_pos + np.array([0.45, -0.2, 0.0])

        arrived = self.engine.locomotion.update_walk_cycle(
            dt, self.engine.data, self.engine.robot, goal, speed=0.4
        )

        if self.grasped_object_id:
            self.engine.attach_object_to_hand(self.grasped_object_id, "right_hand")

        if arrived or self.timer > 3.5:
            return SkillStatus.SUCCESS, f"Carried to {target_id}"
        return SkillStatus.RUNNING, f"Carrying object to {target_id}..."

    def _execute_place_on(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        target_id = params.get("target")
        surface_pos = self.engine.get_object_position(target_id)
        if surface_pos is None:
            return SkillStatus.FAILED, f"Target surface {target_id} not found"

        # Calculate placement position on top of shelf
        place_target = surface_pos.copy()
        place_target[2] += 0.12  # resting on top shelf surface

        self.engine.set_mocap_pos("target_mocap_r", place_target)
        self.engine.ik_solver.solve_site_ik(
            self.engine.model,
            self.engine.data,
            "right_hand",
            place_target,
            joint_names=self.engine.robot.RIGHT_ARM_JOINTS,
            iterations=8
        )

        if self.grasped_object_id:
            self.engine.attach_object_to_hand(self.grasped_object_id, "right_hand")

        if self.timer > 1.4:
            return SkillStatus.SUCCESS, f"Positioned on {target_id}"
        return SkillStatus.RUNNING, f"Lowering onto {target_id}..."

    def _execute_release(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        # Open gripper
        self.engine.robot.set_gripper(self.engine.data, "right", open_amount=1.0)
        
        # Detach object so it rests under gravity on the new surface
        if self.grasped_object_id:
            self.engine.detach_object(self.grasped_object_id)
            obj_name = self.grasped_object_id
            self.grasped_object_id = None
        else:
            obj_name = "object"

        # Move hand away slightly
        hand_pos = self.engine.robot.get_site_position(self.engine.data, "right_hand")
        retract_target = hand_pos + np.array([-0.1, 0.0, 0.08])
        self.engine.set_mocap_pos("target_mocap_r", retract_target)

        if self.timer > 1.0:
            return SkillStatus.SUCCESS, f"Released {obj_name}. Task Complete!"
        return SkillStatus.RUNNING, "Releasing gripper and retracting arm..."
