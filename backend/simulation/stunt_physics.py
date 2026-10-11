"""
RoboTwin StuntStudio: Advanced Physics & Biomechanical Stunt Engine.
Calculates high-precision ballistic flight trajectories, angular momentum conservation
during mid-air tucks and flips, impact G-forces, safety rig deceleration dynamics,
and humanoid joint torque strain for action film stunt pre-visualization.
"""

import math
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

# Physical Constants
GRAVITY = 9.80665  # m/s^2
AIR_DENSITY = 1.225  # kg/m^3 (sea level standard)
HUMANOID_MASS = 75.0  # kg (standard adult stunt double / heavy humanoid)
DRAG_COEFFICIENT = 0.95  # Aerodynamic drag coefficient for humanoid body
CROSS_SECTION_OPEN = 0.65  # m^2 (limbs extended)
CROSS_SECTION_TUCK = 0.32  # m^2 (compact tuck)
INERTIA_OPEN = 12.8  # kg*m^2 (moment of inertia around pitch axis extended)
INERTIA_TUCK = 4.6   # kg*m^2 (moment of inertia tightly tucked)

# Stunt Presets
STUNT_PRESETS: Dict[str, Dict[str, Any]] = {
    "ROOFTOP_GAP_LEAP": {
        "id": "ROOFTOP_GAP_LEAP",
        "name": "Rooftop Gap Jump",
        "category": "Urban Parkour",
        "description": "Full-speed sprint off roof parapet, clearing an urban alley gap with forward tuck rotation onto an adjacent building.",
        "default_run_speed": 7.8,  # m/s
        "default_pitch_deg": 18.0,  # launch elevation angle
        "default_flips": 1,        # 1 complete forward rotation
        "safety_rig": "NONE",      # "NONE" | "AIRBAG" | "WIRE_HARNESS"
        "danger_level": "HIGH"
    },
    "HIGH_FALL_AIRBAG": {
        "id": "HIGH_FALL_AIRBAG",
        "name": "Multi-Story High Fall",
        "category": "Impact Stunt",
        "description": "Controlled vertical fall from high-rise roof or crane with mid-air posture stabilization into a high-volume stunt airbag.",
        "default_run_speed": 3.2,
        "default_pitch_deg": 5.0,
        "default_flips": 0,
        "safety_rig": "AIRBAG",
        "danger_level": "EXTREME"
    },
    "BASE_JUMP_WIRE_ARREST": {
        "id": "BASE_JUMP_WIRE_ARREST",
        "name": "Skyscraper Wire Arrest Dive",
        "category": "Rigged Aerial Stunt",
        "description": "Dramatic dive off a high skyscraper ledge arrested by a calibrated overhead decelerator cable rig before ground contact.",
        "default_run_speed": 5.5,
        "default_pitch_deg": 12.0,
        "default_flips": 0,
        "safety_rig": "WIRE_HARNESS",
        "danger_level": "EXTREME"
    },
    "PARKOUR_LEDGE_ROLL": {
        "id": "PARKOUR_LEDGE_ROLL",
        "name": "Parkour Ledge Vault & Shoulder Roll",
        "category": "Precision Acrobatics",
        "description": "Vault over an architectural parapet with parabolic drop and kinetic shoulder-roll impact dissipation.",
        "default_run_speed": 6.4,
        "default_pitch_deg": 14.0,
        "default_flips": 1,
        "safety_rig": "NONE",
        "danger_level": "MEDIUM"
    },
    "HERO_LANDING": {
        "id": "HERO_LANDING",
        "name": "Superhero Precision Drop",
        "category": "Cinematic Signature",
        "description": "Vertical drop with mid-air stabilization and dramatic three-point ground landing (fist and knee shock absorption).",
        "default_run_speed": 2.5,
        "default_pitch_deg": 2.0,
        "default_flips": 0,
        "safety_rig": "NONE",
        "danger_level": "MEDIUM"
    },
    "SUPERMAN_GLIDE_WIRE": {
        "id": "SUPERMAN_GLIDE_WIRE",
        "name": "Wire-Assisted Aerial Swoop",
        "category": "Cinematic Aerial",
        "description": "Horizontal high-speed glide over city corridors suspended on precision twin servo-controlled winch cables.",
        "default_run_speed": 9.2,
        "default_pitch_deg": 22.0,
        "default_flips": 0,
        "safety_rig": "WIRE_HARNESS",
        "danger_level": "HIGH"
    }
}


class StuntTrajectorySolver:
    """
    High-fidelity physics solver for humanoid stunt acrobatics,
    aerodynamic free-fall, mid-air angular momentum, and landing impact forces.
    """

    def __init__(self, mass: float = HUMANOID_MASS):
        self.mass = mass

    def solve_trajectory(
        self,
        stunt_type: str,
        takeoff_pos: Tuple[float, float, float],
        target_pos: Tuple[float, float, float],
        run_speed: float,
        pitch_deg: float,
        flips: int = 0,
        safety_rig: str = "NONE",
        wire_catch_height: float = 8.0,
        airbag_height: float = 2.4,
        dt: float = 0.016  # ~60 FPS physics integration
    ) -> Dict[str, Any]:
        """
        Solves the complete 3D stunt trajectory from takeoff to landing/arrest.
        """
        x0, y0, z0 = takeoff_pos
        tx, ty, tz = target_pos

        # Compute horizontal azimuth heading towards target
        dx = tx - x0
        dy = ty - y0
        horiz_dist = math.hypot(dx, dy)
        yaw_rad = math.atan2(dy, dx) if horiz_dist > 1e-4 else 0.0

        # Launch velocity vector
        pitch_rad = math.radians(pitch_deg)
        v_horiz = run_speed * math.cos(pitch_rad)
        vx0 = v_horiz * math.cos(yaw_rad)
        vy0 = v_horiz * math.sin(yaw_rad)
        vz0 = run_speed * math.sin(pitch_rad)

        # Simulation state tracking
        pos = np.array([x0, y0, z0], dtype=np.float64)
        vel = np.array([vx0, vy0, vz0], dtype=np.float64)

        # Normalize safety rig string
        norm_rig = safety_rig.upper()
        if "AIRBAG" in norm_rig:
            rig_mode = "AIRBAG"
            landing_surface_z = tz + airbag_height
        elif "WIRE" in norm_rig:
            rig_mode = "WIRE_HARNESS"
            landing_surface_z = tz + wire_catch_height
        else:
            rig_mode = "NONE"
            landing_surface_z = tz

        # Trajectory integration structures
        time_elapsed = 0.0
        trajectory_points = []
        velocities = []
        accelerations = []
        rotations_pitch = []  # pitch rotation in radians
        stunt_phases = []     # ["TAKEOFF", "ASCENT", "APEX", "DESCENT", "TUCK", "ARREST", "IMPACT", "REST"]

        max_alt = z0
        apex_time = 0.0
        reached_apex = False

        # In-flight angular momentum parameters
        # Total desired rotation = flips * 2*PI + landing pitch adjustment
        total_target_rotation = flips * 2.0 * math.pi
        current_rotation = 0.0
        angular_vel = 0.0

        # Numerical integration loop
        max_duration = 15.0  # safety timeout (seconds)
        while time_elapsed < max_duration:
            speed = float(np.linalg.norm(vel))

            # Phase detection
            if time_elapsed < 0.15:
                phase = "TAKEOFF"
            elif not reached_apex and vel[2] > 0.0:
                phase = "ASCENT"
            elif not reached_apex and vel[2] <= 0.0:
                reached_apex = True
                apex_time = time_elapsed
                phase = "APEX"
            elif pos[2] > landing_surface_z + 3.0:
                phase = "TUCK" if flips > 0 else "DESCENT"
            elif pos[2] > landing_surface_z:
                phase = "UNFURL"
            else:
                phase = "IMPACT"

            # Check if entering wire harness deceleration zone
            if safety_rig == "WIRE_HARNESS" and pos[2] <= (landing_surface_z + 2.5) and vel[2] < 0:
                phase = "WIRE_ARREST"

            # Aerodynamic Drag Calculation
            is_tucked = (phase == "TUCK")
            area = CROSS_SECTION_TUCK if is_tucked else CROSS_SECTION_OPEN
            drag_force = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * area * (speed ** 2)
            drag_accel = (drag_force / self.mass) * (-vel / (speed + 1e-6))

            # Net acceleration (Gravity + Drag)
            accel = np.array([0.0, 0.0, -GRAVITY]) + drag_accel

            # Wire Rig dynamic arrest force
            if phase == "WIRE_ARREST":
                # Upward arrest deceleration: limits body to ~4.5G deceleration
                wire_stopping_dist = max(1.5, wire_catch_height * 0.4)
                arrest_accel = min(55.0, (vel[2] ** 2) / (2.0 * wire_stopping_dist))
                accel[2] += arrest_accel

            # Record state
            trajectory_points.append(pos.tolist())
            velocities.append(vel.tolist())
            accelerations.append(accel.tolist())
            stunt_phases.append(phase)
            rotations_pitch.append(float(current_rotation))

            if pos[2] > max_alt:
                max_alt = float(pos[2])

            # Angular rotation integration
            # Tuck speeds up spin; unfurl brakes spin
            current_inertia = INERTIA_TUCK if is_tucked else INERTIA_OPEN
            spin_rate = (total_target_rotation / max(0.8, horiz_dist / max(1.0, v_horiz))) * (INERTIA_OPEN / current_inertia)
            if flips > 0:
                current_rotation += spin_rate * dt
                if phase == "UNFURL" and current_rotation >= total_target_rotation:
                    current_rotation = total_target_rotation

            # Ground or safety rig collision check
            if pos[2] <= landing_surface_z:
                break

            # Euler-Cromer Symplectic Integration
            vel += accel * dt
            pos += vel * dt
            time_elapsed += dt

        impact_speed = float(np.linalg.norm(vel))
        impact_velocity_vec = vel.copy()
        flight_time = time_elapsed

        # Post-Impact Biomechanical & Safety Calculations
        telemetry = self._calculate_impact_telemetry(
            impact_speed=impact_speed,
            impact_vel_z=float(vel[2]),
            flight_time=flight_time,
            drop_height=float(z0 - landing_surface_z),
            safety_rig=rig_mode,
            airbag_height=airbag_height,
            wire_catch_height=wire_catch_height
        )

        # Generate smooth 60 FPS humanoid skeletal joint poses
        frames = self._generate_skeletal_frames(
            trajectory_points=trajectory_points,
            velocities=velocities,
            rotations=rotations_pitch,
            phases=stunt_phases,
            stunt_type=stunt_type,
            safety_rig=rig_mode
        )

        return {
            "stunt_type": stunt_type,
            "safety_rig": safety_rig,
            "flight_time": round(flight_time, 2),
            "apex_altitude": round(max_alt, 2),
            "apex_time": round(apex_time, 2),
            "horizontal_distance": round(float(np.hypot(pos[0] - x0, pos[1] - y0)), 2),
            "target_gap": round(horiz_dist, 2),
            "landing_coords": [round(float(p), 2) for p in pos],
            "landing_miss_distance": round(float(np.hypot(pos[0] - tx, pos[1] - ty)), 2),
            "telemetry": telemetry,
            "total_frames": len(frames),
            "frames": frames
        }

    def _calculate_impact_telemetry(
        self,
        impact_speed: float,
        impact_vel_z: float,
        flight_time: float,
        drop_height: float,
        safety_rig: str,
        airbag_height: float,
        wire_catch_height: float
    ) -> Dict[str, Any]:
        """
        Calculates deceleration G-forces, kinetic energy dissipation,
        joint torque strains, and safety certification verdict.
        """
        kinetic_energy_kj = round((0.5 * self.mass * (impact_speed ** 2)) / 1000.0, 2)
        speed_mph = round(impact_speed * 2.23694, 1)

        norm_rig = safety_rig.upper()
        if "AIRBAG" in norm_rig:
            rig_mode = "AIRBAG"
        elif "WIRE" in norm_rig:
            rig_mode = "WIRE_HARNESS"
        else:
            rig_mode = "NONE"

        # Impact Deceleration & G-Force Physics
        if rig_mode == "AIRBAG":
            # Controlled continuous deflation over 1.8m compression stroke
            stroke = max(0.8, airbag_height * 0.75)
            decel_m_s2 = (impact_speed ** 2) / (2.0 * stroke)
            peak_g = round(decel_m_s2 / GRAVITY, 1)
            stopping_time_s = round((2.0 * stroke) / max(0.1, impact_speed), 3)
            peak_force_kn = round((self.mass * decel_m_s2) / 1000.0, 1)
            required_rig_spec = f"Heavy-Duty Dual-Chamber Stunt Airbag ({airbag_height}m height, minimum 5.5m x 5.5m footprint)"

        elif safety_rig == "WIRE_HARNESS":
            # Constant-tension magnetic/hydraulic decelerator stroke
            stroke = max(1.5, wire_catch_height * 0.45)
            decel_m_s2 = (impact_speed ** 2) / (2.0 * stroke)
            peak_g = round(decel_m_s2 / GRAVITY, 1)
            stopping_time_s = round((2.0 * stroke) / max(0.1, impact_speed), 3)
            peak_force_kn = round((self.mass * decel_m_s2) / 1000.0, 1)
            required_rig_spec = f"Twin 8mm Aircraft Cable Rig with 6kN Constant-Tension Inertia Brake"

        else:
            # Unassisted Rigid Concrete / Roof Impact
            # Bio-elastic deformation of humanoid chassis + footwear ~0.04m
            stroke = 0.04
            decel_m_s2 = (impact_speed ** 2) / (2.0 * stroke)
            peak_g = round(decel_m_s2 / GRAVITY, 1)
            stopping_time_s = round((2.0 * stroke) / max(0.1, impact_speed), 3)
            peak_force_kn = round((self.mass * decel_m_s2) / 1000.0, 1)
            required_rig_spec = "None (Bare Hard Surface)"

        # Joint Torque Strains (Percentage of structural limit)
        # Spine limit: ~450 Nm, Knee limit: ~650 Nm, Ankle limit: ~380 Nm
        strain_multiplier = min(3.5, peak_g / 12.0)
        spine_strain = round(min(100.0, 22.0 * strain_multiplier), 1)
        hip_strain = round(min(100.0, 28.0 * strain_multiplier), 1)
        knee_strain = round(min(100.0, 34.0 * strain_multiplier), 1)
        ankle_strain = round(min(100.0, 38.0 * strain_multiplier), 1)

        # Survivability Index & Stunt Safety Certification
        if safety_rig in ("AIRBAG", "WIRE_HARNESS") and peak_g <= 16.0:
            survivability = 98.0
            verdict = "CLEARED (SAFE STUNT EXECUTION)"
            verdict_color = "#10b981"  # Emerald green
            verdict_notes = f"Impact deceleration smoothly arrested by {safety_rig.lower()}. Structural loads well within safety tolerances."
        elif peak_g <= 12.0 and drop_height <= 5.0:
            survivability = 92.0
            verdict = "CLEARED (SURVIVABLE PARKOUR DROP)"
            verdict_color = "#10b981"
            verdict_notes = "Landing forces safely absorbed through leg flexion and shoulder roll. No safety rig mandatory."
        elif peak_g <= 28.0:
            survivability = round(max(35.0, 100.0 - (peak_g - 12.0) * 3.5), 1)
            verdict = "SAFETY RIG MANDATORY (SEVERE CHASSIS DAMAGE)"
            verdict_color = "#f59e0b"  # Amber warning
            verdict_notes = f"Landing forces ({peak_g}G) will cause severe actuator and structural failure without an airbag or deceleration harness."
        else:
            survivability = round(max(0.0, 100.0 - (peak_g * 2.2)), 1)
            verdict = "CATASTROPHIC IMPACT (FATAL / TOTAL FRAME DESTRUCTION)"
            verdict_color = "#f43f5e"  # Crimson danger
            verdict_notes = f"Catastrophic impact shock ({peak_g}G, {peak_force_kn}kN peak force). Total structural destruction of the robot upon contact."

        return {
            "impact_velocity_mps": round(impact_speed, 2),
            "impact_velocity_mph": speed_mph,
            "kinetic_energy_kj": kinetic_energy_kj,
            "peak_g_force": peak_g,
            "peak_impact_force_kn": peak_force_kn,
            "stopping_duration_s": stopping_time_s,
            "survivability_pct": survivability,
            "verdict": verdict,
            "verdict_color": verdict_color,
            "verdict_notes": verdict_notes,
            "required_rig_spec": required_rig_spec,
            "joint_strains": {
                "spine": spine_strain,
                "hips": hip_strain,
                "knees": knee_strain,
                "ankles": ankle_strain
            }
        }

    def _generate_skeletal_frames(
        self,
        trajectory_points: List[List[float]],
        velocities: List[List[float]],
        rotations: List[float],
        phases: List[str],
        stunt_type: str,
        safety_rig: str
    ) -> List[Dict[str, Any]]:
        """
        Generates 60 FPS articulated humanoid skeletal poses
        synchronized with the 3D ballistic trajectory and stunt maneuvers.
        """
        frames = []
        n_pts = len(trajectory_points)

        for i in range(n_pts):
            t_norm = i / max(1, n_pts - 1)
            pos = trajectory_points[i]
            vel = velocities[i]
            rot = rotations[i]
            phase = phases[i]

            # Procedural articulated joint angles based on stunt phase
            if phase in ("TAKEOFF", "ASCENT"):
                # Extended launch push pose
                spine_p = -12.0
                knee_bend = 15.0
                arm_reach = 45.0
            elif phase in ("TUCK", "APEX"):
                # Tight acrobatic tuck
                spine_p = 32.0
                knee_bend = 75.0
                arm_reach = 10.0
            elif phase == "UNFURL":
                # Pre-landing extension
                spine_p = 5.0
                knee_bend = 30.0
                arm_reach = 30.0
            elif phase in ("IMPACT", "WIRE_ARREST"):
                # Deep shock absorbing flexion
                spine_p = 28.0
                knee_bend = 80.0
                arm_reach = -15.0
            else:
                spine_p = 0.0
                knee_bend = 10.0
                arm_reach = 0.0

            # Convert body rotation to quaternion [w, x, y, z] around pitch axis
            half_rot = rot / 2.0
            quat = [round(math.cos(half_rot), 4), 0.0, round(math.sin(half_rot), 4), 0.0]

            frames.append({
                "frame_idx": i,
                "time": round(i * 0.016, 3),
                "time_s": round(i * 0.016, 3),
                "phase": phase,
                "pos": [round(float(p), 3) for p in pos],
                "pelvis_pos": [round(float(p), 3) for p in pos],
                "rot": [round(float(rot), 3), 0.0, 0.0],
                "pelvis_quat": quat,
                "speed": round(float(np.linalg.norm(vel)), 2),
                "vel": [round(float(v), 3) for v in vel],
                "joints": {
                    "spine_pitch": round(math.radians(spine_p), 3),
                    "knee_flex_left": round(math.radians(knee_bend), 3),
                    "knee_flex_right": round(math.radians(knee_bend), 3),
                    "hip_flex_left": round(math.radians(knee_bend * 0.5), 3),
                    "hip_flex_right": round(math.radians(knee_bend * 0.5), 3),
                    "shoulder_pitch_left": round(math.radians(arm_reach), 3),
                    "shoulder_pitch_right": round(math.radians(arm_reach), 3),
                    "elbow_flex_left": round(math.radians(arm_reach * 0.6), 3),
                    "elbow_flex_right": round(math.radians(arm_reach * 0.6), 3),
                },
                "joint_angles": {
                    "spine_pitch": round(spine_p, 1),
                    "knee_flexion": round(knee_bend, 1),
                    "arm_reach": round(arm_reach, 1)
                }
            })

        return frames


# Singleton solver instance
stunt_solver = StuntTrajectorySolver()
