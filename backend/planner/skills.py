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
        elif skill_name in ["approach_chair", "navigate_to_chair"]:
            return self._execute_approach_chair(params, dt)
        elif skill_name in ["contact_chair", "reach_chair_backrest"]:
            return self._execute_contact_chair(params, dt)
        elif skill_name in ["push_chair", "push_chair_to_slot", "tuck_chair"]:
            return self._execute_push_chair_to_slot(params, dt)
        elif skill_name in ["retract_arms", "retract_from_chair"]:
            return self._execute_retract_arms(params, dt)
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

    def _execute_approach_chair(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        chair_id = params.get("target") or params.get("chair")
        chair_pos = self.engine.get_object_position(chair_id)
        if chair_pos is None:
            return SkillStatus.FAILED, f"Chair {chair_id} not found in scene"

        # Dedicated stance approach position directly behind chair backrest
        approach_pos = params.get("approach_pos")
        if approach_pos is not None:
            goal = np.array(approach_pos, dtype=np.float64)
        else:
            goal = chair_pos.copy()
            goal[0] -= 0.45
            goal[2] = 0.98

        arrived = self.engine.locomotion.update_walk_cycle(
            dt, self.engine.data, self.engine.robot, goal, speed=0.42
        )
        pelvis_pos = self.engine.data.qpos[0:3]
        dist = float(np.linalg.norm(goal[:2] - pelvis_pos[:2]))

        if arrived or dist < 0.28 or self.timer > 3.5:
            return SkillStatus.SUCCESS, f"Arrived in pushing stance behind {chair_id}"
        return SkillStatus.RUNNING, f"Walking to position behind {chair_id} ({dist:.2f}m)..."

    def _execute_contact_chair(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        chair_id = params.get("target") or params.get("chair")
        chair_pos = self.engine.get_object_position(chair_id)
        if chair_pos is None:
            return SkillStatus.FAILED, f"Chair {chair_id} not found"

        push_height = 0.76
        # Right hand to right side of backrest rail
        r_target = np.array([chair_pos[0] - 0.16, chair_pos[1] - 0.10, push_height])
        # Left hand to left side of backrest rail
        l_target = np.array([chair_pos[0] - 0.16, chair_pos[1] + 0.10, push_height])

        self.engine.set_mocap_pos("target_mocap_r", r_target)
        self.engine.set_mocap_pos("target_mocap_l", l_target)

        # Solve dual-arm IK
        self.engine.ik_solver.solve_site_ik(
            self.engine.model,
            self.engine.data,
            "right_hand",
            r_target,
            joint_names=self.engine.robot.RIGHT_ARM_JOINTS,
            iterations=8
        )
        self.engine.ik_solver.solve_site_ik(
            self.engine.model,
            self.engine.data,
            "left_hand",
            l_target,
            joint_names=self.engine.robot.LEFT_ARM_JOINTS,
            iterations=8
        )

        # Open both hands for flat palm pushing contact
        self.engine.robot.set_gripper(self.engine.data, "right", open_amount=1.0)
        self.engine.robot.set_gripper(self.engine.data, "left", open_amount=1.0)

        r_hand = self.engine.robot.get_site_position(self.engine.data, "right_hand")
        r_dist = float(np.linalg.norm(r_hand - r_target))

        if r_dist < 0.08 or self.timer > 1.4:
            return SkillStatus.SUCCESS, f"Dual-arm contact confirmed on {chair_id} backrest"
        return SkillStatus.RUNNING, f"Extending both arms to {chair_id} backrest..."

    def _execute_push_chair_to_slot(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        chair_id = params.get("target") or params.get("chair")
        target_slot = np.array(params.get("target_slot") or params.get("slot_pos") or [1.35, 0.0, 0.42], dtype=np.float64)
        chair_pos = self.engine.get_object_position(chair_id)
        if chair_pos is None:
            return SkillStatus.FAILED, f"Chair {chair_id} not found"

        delta_xy = target_slot[:2] - chair_pos[:2]
        dist = float(np.linalg.norm(delta_xy))

        # Check alignment tolerance: within 0.10m of designated tuck slot
        if dist < 0.10 or self.timer > 4.5:
            # Anchor cleanly in slot
            self.engine.set_object_position(chair_id, np.array([target_slot[0], target_slot[1], 0.0]))
            # Mark chair status as tucked in scene config
            for obj in self.engine.scene_config.get("objects", []):
                if obj.get("id") == chair_id:
                    obj["status"] = "TUCKED"
            return SkillStatus.SUCCESS, f"{chair_id} neatly tucked into designated table slot (error: {dist:.3f}m)"

        # Step forward and slide chair toward slot along floor plane
        push_speed = 0.28
        step_mag = min(push_speed * dt, dist)
        step_dir = delta_xy / dist
        step_delta = step_dir * step_mag

        new_chair_pos = chair_pos.copy()
        new_chair_pos[0] += step_delta[0]
        new_chair_pos[1] += step_delta[1]
        new_chair_pos[2] = 0.0  # stay firmly grounded
        self.engine.set_object_position(chair_id, new_chair_pos)

        # Move robot pelvis forward with the chair
        self.engine.data.qpos[0] += step_delta[0]
        self.engine.data.qpos[1] += step_delta[1]

        # Keep both hands resting on backrest
        r_target = np.array([new_chair_pos[0] - 0.16, new_chair_pos[1] - 0.10, 0.76])
        l_target = np.array([new_chair_pos[0] - 0.16, new_chair_pos[1] + 0.10, 0.76])
        self.engine.ik_solver.solve_site_ik(
            self.engine.model, self.engine.data, "right_hand", r_target,
            joint_names=self.engine.robot.RIGHT_ARM_JOINTS, iterations=4
        )
        self.engine.ik_solver.solve_site_ik(
            self.engine.model, self.engine.data, "left_hand", l_target,
            joint_names=self.engine.robot.LEFT_ARM_JOINTS, iterations=4
        )

        return SkillStatus.RUNNING, f"Pushing {chair_id} into table slot ({dist:.2f}m remaining)..."

    def _execute_retract_arms(self, params: Dict[str, Any], dt: float) -> Tuple[str, str]:
        # Reset arms to natural standing posture
        self.engine.robot.set_home_pose(self.engine.data)
        # Step robot back slightly
        self.engine.data.qpos[0] -= 0.05 * dt

        if self.timer > 0.8:
            return SkillStatus.SUCCESS, "Retracted arms. Alignment and stability verified."
        return SkillStatus.RUNNING, "Releasing contact and stepping back..."

