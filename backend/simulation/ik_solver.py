"""
RoboTwin Inverse Kinematics (IK) Solver
Implements Damped Least-Squares (DLS) Jacobian Inverse Kinematics using native MuJoCo routines.
"""

import numpy as np
import mujoco
from typing import Optional, Tuple, List

class IKSolver:
    def __init__(self, damping: float = 0.05, max_step: float = 0.08):
        self.damping = damping
        self.max_step = max_step

    def solve_site_ik(
        self,
        model: mujoco.MjModel,
        data: mujoco.MjData,
        site_name: str,
        target_pos: np.ndarray,
        joint_names: Optional[List[str]] = None,
        iterations: int = 15,
        tolerance: float = 0.005
    ) -> Tuple[bool, np.ndarray, float]:
        """
        Solves IK for a specified site to reach target_pos using Damped Least Squares.
        Returns (converged, delta_q, final_error_distance).
        """
        site_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, site_name)
        if site_id < 0:
            raise ValueError(f"Site '{site_name}' not found in MuJoCo model.")

        # If joint subset is specified, build a boolean mask for qvel/qpos DoFs
        dof_mask = np.ones(model.nv, dtype=bool)
        if joint_names:
            dof_mask = np.zeros(model.nv, dtype=bool)
            for jname in joint_names:
                jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, jname)
                if jid >= 0:
                    dof_adr = model.jnt_dofadr[jid]
                    dof_mask[dof_adr] = True

        target_pos = np.asarray(target_pos, dtype=np.float64)
        total_dq = np.zeros(model.nv, dtype=np.float64)

        for _ in range(iterations):
            current_pos = data.site_xpos[site_id].copy()
            error = target_pos - current_pos
            err_dist = np.linalg.norm(error)

            if err_dist < tolerance:
                return True, total_dq, err_dist

            # Compute translational Jacobian
            jacp = np.zeros((3, model.nv), dtype=np.float64)
            mujoco.mj_jacSite(model, data, jacp, None, site_id)

            # Apply DOF mask (restrict motion to specified arm joints)
            jac_active = jacp[:, dof_mask]

            # Damped Least Squares: J^T (J J^T + lambda^2 * I)^(-1) * error
            lambda_sq = self.damping ** 2
            a = jac_active @ jac_active.T + lambda_sq * np.eye(3)
            dq_active = jac_active.T @ np.linalg.solve(a, error)

            # Limit step magnitude
            dq_norm = np.linalg.norm(dq_active)
            if dq_norm > self.max_step:
                dq_active = dq_active * (self.max_step / dq_norm)

            # Map back to full DoF vector
            dq_step = np.zeros(model.nv, dtype=np.float64)
            dq_step[dof_mask] = dq_active
            total_dq += dq_step

            # Update joint positions in MuJoCo data
            mujoco.mj_integratePos(model, data.qpos, dq_step, 1.0)
            mujoco.mj_kinematics(model, data)

        final_err = float(np.linalg.norm(target_pos - data.site_xpos[site_id]))
        converged = final_err < tolerance
        return converged, total_dq, final_err

    def calculate_arm_ctrl_for_target(
        self,
        model: mujoco.MjModel,
        data: mujoco.MjData,
        site_name: str,
        target_pos: np.ndarray,
        arm_actuator_names: List[str],
        joint_names: List[str]
    ) -> np.ndarray:
        """
        Uses IK to determine the actuator target control values (ctrl) for the arm joints.
        """
        # Save temporary state
        qpos_backup = data.qpos.copy()

        # Solve IK on data copy
        self.solve_site_ik(model, data, site_name, target_pos, joint_names=joint_names, iterations=20)

        # Extract target positions for the specified actuators
        target_ctrl = []
        for act_name in arm_actuator_names:
            act_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, act_name)
            if act_id >= 0:
                joint_id = model.actuator_trnid[act_id, 0]
                qpos_adr = model.jnt_qposadr[joint_id]
                target_ctrl.append(data.qpos[qpos_adr])
            else:
                target_ctrl.append(0.0)

        # Restore state
        data.qpos[:] = qpos_backup
        mujoco.mj_kinematics(model, data)

        return np.array(target_ctrl, dtype=np.float64)
