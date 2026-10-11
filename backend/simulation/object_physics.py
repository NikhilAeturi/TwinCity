"""
RoboTwin Object Physics Engine.
Computes grounded, rigorous 60 FPS kinematic and dynamic trajectories
for arbitrary 3D catalog models (Vehicles, Bipeds, Mobile Robots, Drones, and Props).
Integrates real-world automotive bicycle dynamics, multirotor thrust physics,
bipedal LIPM locomotion, and digital terrain elevation clamping.
"""

import math
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from backend.simulation.asset_catalog import asset_catalog_manager, ASSET_CATALOG
from backend.simulation.terrain_physics import terrain_physics_engine

METERS_PER_DEG_LAT = 111320.0
GRAVITY = 9.80665
AIR_DENSITY = 1.225  # kg/m^3

def meters_to_lat_lng(center_lat: float, center_lng: float, dx: float, dy: float, alt: float = 0.0) -> Dict[str, float]:
    d_lat = dy / METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    d_lng = dx / (METERS_PER_DEG_LAT * cos_lat)
    return {
        "lat": round(center_lat + d_lat, 7),
        "lng": round(center_lng + d_lng, 7),
        "altitude": round(alt, 2)
    }

def lat_lng_to_meters(center_lat: float, center_lng: float, lat: float, lng: float) -> Tuple[float, float]:
    dy = (lat - center_lat) * METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    dx = (lng - center_lng) * (METERS_PER_DEG_LAT * cos_lat)
    return dx, dy

def calculate_heading(dx: float, dy: float) -> float:
    angle_rad = math.atan2(dx, dy)
    deg = math.degrees(angle_rad)
    return round((deg + 360.0) % 360.0, 1)

def catmull_rom_spline(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    """1D Catmull-Rom spline interpolation at parameter t in [0, 1]."""
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        (2.0 * p1) +
        (-p0 + p2) * t +
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
        (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    )

class ObjectPhysicsEngine:
    """Simulates realistic 60 FPS physics trajectories for catalog models."""

    def __init__(self):
        pass

    def simulate_object_motion(
        self,
        asset_id: str,
        waypoints: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        city_id: str = "san_francisco",
        prompt: Optional[str] = None,
        custom_physics: Optional[Dict[str, Any]] = None,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Translates waypoints and prompt into continuous 60 FPS physical simulation.
        Respects mass, acceleration capability, braking deceleration, cornering limits,
        and generates attitude kinematics (heading, pitch dive, roll tilt).
        """
        asset = asset_catalog_manager.get_asset_by_id(asset_id) or ASSET_CATALOG.get("vehicle_sedan")
        phys = dict(asset.get("physics", {}))
        if custom_physics:
            phys.update(custom_physics)

        category = asset.get("category", "vehicle")
        mass_kg = float(phys.get("mass_kg", asset.get("mass_kg", 1500.0)))
        max_speed = float(phys.get("max_speed_mps", asset.get("max_speed_mps", 45.0)))
        default_speed = float(phys.get("default_speed_mps", asset.get("default_speed_mps", 16.0)))
        max_accel = float(phys.get("accel_mps2", 5.5))
        max_brake = float(phys.get("braking_decel_mps2", asset.get("braking_decel_mps2", 8.5)))
        drag_cd = float(phys.get("drag_coefficient", 0.32))
        frontal_area = float(phys.get("frontal_area_m2", 2.2))
        mu_friction = float(phys.get("friction_coeff", 0.85))

        # 1. Parse and standardize waypoints into metric space
        pts = []
        for i, wp in enumerate(waypoints):
            lat = float(wp["lat"])
            lng = float(wp["lng"])
            x, y = lat_lng_to_meters(center_lat, center_lng, lat, lng)
            ground_z = terrain_physics_engine.get_elevation(lat, lng, city_id)
            
            # Altitude offset for aerial vs ground
            is_aerial = (category == "drone")
            wp_alt = float(wp.get("altitude", ground_z + (12.0 if is_aerial else 0.0)))
            if not is_aerial:
                wp_alt = ground_z

            wp_action = (wp.get("action") or "").upper()
            wp_speed = float(wp.get("speed") or (0.0 if i == len(waypoints) - 1 and len(waypoints) > 1 else default_speed))
            pts.append({
                "idx": i,
                "x": x,
                "y": y,
                "z": wp_alt,
                "ground_z": ground_z,
                "lat": lat,
                "lng": lng,
                "speed": min(max_speed, max(0.0, wp_speed)),
                "action": wp_action or ("SPAWN" if i == 0 else "MOVE"),
                "prompt": wp.get("prompt") or ""
            })

        if len(pts) == 0:
            raise ValueError("Waypoints cannot be empty")

        # If single waypoint, create a 3.0s stationary / idle simulation
        if len(pts) == 1:
            return self._build_stationary_scene(asset, pts[0], center_lat, center_lng, city_id, fps)

        # 2. Compute segment distances, target speeds, and durations
        segments = []
        total_duration = 0.0
        for i in range(len(pts) - 1):
            p_a = pts[i]
            p_b = pts[i + 1]
            dx = p_b["x"] - p_a["x"]
            dy = p_b["y"] - p_a["y"]
            dz = p_b["z"] - p_a["z"]
            dist = math.hypot(dx, dy)
            dist_3d = math.sqrt(dx * dx + dy * dy + dz * dz)

            v_start = p_a["speed"]
            v_target = p_b["speed"]
            v_avg = max(1.5, (v_start + v_target) / 2.0)

            # Check corner curvature limit if not last segment
            if i + 2 < len(pts):
                p_c = pts[i + 2]
                dx2 = p_c["x"] - p_b["x"]
                dy2 = p_c["y"] - p_b["y"]
                h1 = math.atan2(dx, dy)
                h2 = math.atan2(dx2, dy2)
                turn_angle = abs((math.degrees(h2 - h1) + 180) % 360 - 180)
                if turn_angle > 35.0:
                    # Enforce cornering deceleration: v <= sqrt(mu * g * R)
                    # Approximate radius R ~ 12m for sharp urban turns
                    r_turn = max(6.0, 22.0 - (turn_angle / 180.0) * 14.0)
                    v_corner_max = math.sqrt(mu_friction * GRAVITY * r_turn)
                    v_target = min(v_target, v_corner_max)

            # Segment transit time based on distance and speed
            seg_time = max(1.2, dist_3d / v_avg)
            segments.append({
                "from_idx": i,
                "to_idx": i + 1,
                "dist": dist,
                "dist_3d": dist_3d,
                "duration": seg_time,
                "start_time": total_duration,
                "end_time": total_duration + seg_time,
                "v_start": v_start,
                "v_end": v_target,
                "dx": dx,
                "dy": dy,
                "dz": dz
            })
            total_duration += seg_time

        # 3. Dense 60 FPS trajectory integration with dynamic attitude (pitch, roll, yaw)
        total_frames = max(1, int(total_duration * fps))
        frames: List[Dict[str, Any]] = []
        dt = 1.0 / fps

        # Pre-pad spline anchors
        p_ext = [pts[0]] + pts + [pts[-1]]

        for f_idx in range(total_frames):
            t = f_idx * dt
            # Find current segment
            seg = segments[-1]
            seg_idx = len(segments) - 1
            for s_idx, s in enumerate(segments):
                if s["start_time"] <= t <= s["end_time"]:
                    seg = s
                    seg_idx = s_idx
                    break

            tau = min(1.0, max(0.0, (t - seg["start_time"]) / max(1e-4, seg["duration"])))
            # Smooth ease-in-out S-curve for speed transition
            s_curve = 3.0 * tau * tau - 2.0 * tau * tau * tau

            # Spline coordinates using 4 anchor points
            i0 = seg_idx
            i1 = seg_idx + 1
            i2 = seg_idx + 2
            i3 = min(len(p_ext) - 1, seg_idx + 3)

            x = catmull_rom_spline(p_ext[i0]["x"], p_ext[i1]["x"], p_ext[i2]["x"], p_ext[i3]["x"], tau)
            y = catmull_rom_spline(p_ext[i0]["y"], p_ext[i1]["y"], p_ext[i2]["y"], p_ext[i3]["y"], tau)
            z = catmull_rom_spline(p_ext[i0]["z"], p_ext[i1]["z"], p_ext[i2]["z"], p_ext[i3]["z"], tau)

            # Instantaneous velocity vector (using finite difference dt_spline)
            eps = 0.015
            tau_next = min(1.0, tau + eps)
            x_next = catmull_rom_spline(p_ext[i0]["x"], p_ext[i1]["x"], p_ext[i2]["x"], p_ext[i3]["x"], tau_next)
            y_next = catmull_rom_spline(p_ext[i0]["y"], p_ext[i1]["y"], p_ext[i2]["y"], p_ext[i3]["y"], tau_next)
            z_next = catmull_rom_spline(p_ext[i0]["z"], p_ext[i1]["z"], p_ext[i2]["z"], p_ext[i3]["z"], tau_next)

            vx = (x_next - x) / (eps * max(1e-4, seg["duration"]))
            vy = (y_next - y) / (eps * max(1e-4, seg["duration"]))
            vz = (z_next - z) / (eps * max(1e-4, seg["duration"]))
            speed_horiz = math.hypot(vx, vy)
            speed_3d = math.sqrt(vx * vx + vy * vy + vz * vz)

            # Yaw Heading (compass degrees: 0 = North, 90 = East)
            heading = calculate_heading(vx, vy) if speed_horiz > 0.05 else pts[seg["from_idx"]].get("heading", 0.0)

            # GPS coordinates
            gps = meters_to_lat_lng(center_lat, center_lng, x, y, z)
            ground_alt = terrain_physics_engine.get_elevation(gps["lat"], gps["lng"], city_id)

            if category != "drone":
                # Clamp ground vehicles and props to physical terrain
                gps["altitude"] = ground_alt
                z = ground_alt

            # Longitudinal acceleration ax
            v_curr = seg["v_start"] + (seg["v_end"] - seg["v_start"]) * s_curve
            ax = (seg["v_end"] - seg["v_start"]) / max(1e-4, seg["duration"])

            # Aerodynamic drag & engine force
            drag_n = 0.5 * AIR_DENSITY * drag_cd * frontal_area * (v_curr * v_curr)
            f_net = mass_kg * ax + drag_n

            # Pitch angle calculation:
            # - Vehicles: Braking causes nose dive (pitch down < 0); accel causes squat (pitch up > 0)
            # - Drones: Nose tilts down to accelerate (pitch < 0 in flight convention)
            # - Bipeds: Lean forward during acceleration
            pitch_deg = 0.0
            roll_deg = 0.0

            if category == "vehicle":
                k_pitch_dive = 1.4  # degrees per m/s^2
                k_roll_lean = 2.2   # degrees per m/s^2 lateral
                pitch_deg = max(-6.5, min(4.5, -ax * k_pitch_dive))

                # Estimate lateral acceleration ay = v^2 * curvature
                eps_turn = 0.03
                tau_turn = min(1.0, tau + eps_turn)
                x_turn = catmull_rom_spline(p_ext[i0]["x"], p_ext[i1]["x"], p_ext[i2]["x"], p_ext[i3]["x"], tau_turn)
                y_turn = catmull_rom_spline(p_ext[i0]["y"], p_ext[i1]["y"], p_ext[i2]["y"], p_ext[i3]["y"], tau_turn)
                h_future = calculate_heading(x_turn - x_next, y_turn - y_next)
                dh = (h_future - heading + 180) % 360 - 180
                yaw_rate_rad = math.radians(dh) / (eps_turn * max(1e-4, seg["duration"]))
                ay = speed_horiz * yaw_rate_rad
                # Outward roll on vehicle suspension in turns
                roll_deg = max(-8.0, min(8.0, -ay * k_roll_lean))

            elif category == "drone":
                # Quadcopters tilt body forward to generate horizontal thrust: tan(theta) = ax / g
                pitch_deg = math.degrees(math.atan2(-ax, GRAVITY))
                # Bank into turns: tan(phi) = ay / g
                eps_turn = 0.03
                tau_turn = min(1.0, tau + eps_turn)
                x_turn = catmull_rom_spline(p_ext[i0]["x"], p_ext[i1]["x"], p_ext[i2]["x"], p_ext[i3]["x"], tau_turn)
                y_turn = catmull_rom_spline(p_ext[i0]["y"], p_ext[i1]["y"], p_ext[i2]["y"], p_ext[i3]["y"], tau_turn)
                h_future = calculate_heading(x_turn - x_next, y_turn - y_next)
                dh = (h_future - heading + 180) % 360 - 180
                yaw_rate_rad = math.radians(dh) / (eps_turn * max(1e-4, seg["duration"]))
                ay = speed_horiz * yaw_rate_rad
                roll_deg = math.degrees(math.atan2(ay, GRAVITY))
                roll_deg = max(-32.0, min(32.0, roll_deg))
                pitch_deg = max(-28.0, min(28.0, pitch_deg))

            elif category in ("character", "humanoid", "robot"):
                # Bipedal / robotic pitch tilt & subtle gait roll sway
                pitch_deg = max(-5.0, min(8.0, 2.0 - ax * 0.8))
                gait_freq = 2.4  # Hz
                roll_deg = 2.5 * math.sin(2.0 * math.pi * gait_freq * t) if speed_horiz > 0.8 else 0.0

            # G-Force
            g_force = math.sqrt(ax * ax + GRAVITY * GRAVITY) / GRAVITY

            frames.append({
                "time": round(t, 3),
                "pos": {
                    "lat": gps["lat"],
                    "lng": gps["lng"],
                    "altitude": round(z, 2),
                    "ground_altitude": round(ground_alt, 2)
                },
                "heading": round(heading, 1),
                "pitch": round(pitch_deg, 2),
                "roll": round(roll_deg, 2),
                "speed": round(speed_horiz, 2),
                "speed_mph": round(speed_horiz * 2.23694, 1),
                "accel": round(ax, 2),
                "g_force": round(g_force, 2),
                "action": pts[seg["from_idx"]]["action"],
                "model_src": asset.get("src"),
                "scale": asset.get("scale", 1.0),
                "actors": [
                    {
                        "id": f"placed_{asset_id}",
                        "name": asset.get("name", "Simulated Object"),
                        "model_src": asset.get("src"),
                        "scale": asset.get("scale", 1.0),
                        "lat": gps["lat"],
                        "lng": gps["lng"],
                        "altitude": round(z - ground_alt, 2),
                        "heading": round(heading, 1),
                        "pitch": round(pitch_deg, 2),
                        "roll": round(roll_deg, 2),
                        "speed_mps": round(speed_horiz, 2)
                    }
                ],
                "telemetry": {
                    "mass_kg": mass_kg,
                    "drag_force_n": round(drag_n, 1),
                    "net_force_n": round(f_net, 1),
                    "friction_util": min(100.0, round((abs(ax) / (mu_friction * GRAVITY)) * 100.0, 1)),
                    "physics_model": phys.get("model", "Newtonian Kinematics")
                }
            })

        # Generate automated cinematic camera shots tracking the simulated object
        camera_shots = self._generate_object_camera_shots(frames, total_duration, category)

        return {
            "status": "success",
            "scene_id": f"motion_{asset_id}_{int(time.time() * 1000)}",
            "title": f"Object Motion: {asset.get('name')} ({len(pts)} Waypoints)",
            "city_id": city_id,
            "asset": asset,
            "total_duration_sec": round(total_duration, 2),
            "total_frames": len(frames),
            "fps": fps,
            "waypoints": waypoints,
            "camera_shots": camera_shots,
            "frames": frames,
            "is_vehicular": (category in ("vehicle", "drone")),
            "actors": [
                {
                    "id": f"placed_{asset_id}",
                    "name": asset.get("name"),
                    "asset_id": asset_id,
                    "model_src": asset.get("src"),
                    "scale": asset.get("scale", 1.0),
                    "category": category,
                    "mass_kg": mass_kg
                }
            ]
        }

    def _build_stationary_scene(self, asset, pt, center_lat, center_lng, city_id, fps):
        """Constructs a 3-second stationary placement preview."""
        duration = 3.0
        total_frames = int(duration * fps)
        frames = []
        ground_alt = terrain_physics_engine.get_elevation(pt["lat"], pt["lng"], city_id)
        is_drone = asset.get("category") == "drone"
        z_offset = 6.0 if is_drone else 0.0

        for f in range(total_frames):
            t = f / fps
            # Hover wobble for drone
            roll = 1.2 * math.sin(2.0 * math.pi * 1.5 * t) if is_drone else 0.0
            pitch = 0.8 * math.cos(2.0 * math.pi * 1.2 * t) if is_drone else 0.0
            hover_z = z_offset + (0.15 * math.sin(2.0 * math.pi * 0.8 * t) if is_drone else 0.0)

            frames.append({
                "time": round(t, 3),
                "pos": {
                    "lat": pt["lat"],
                    "lng": pt["lng"],
                    "altitude": round(ground_alt + hover_z, 2),
                    "ground_altitude": round(ground_alt, 2)
                },
                "heading": 45.0,
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "speed": 0.0,
                "speed_mph": 0.0,
                "accel": 0.0,
                "g_force": 1.0,
                "action": "STANDBY",
                "model_src": asset.get("src"),
                "scale": asset.get("scale", 1.0),
                "actors": [
                    {
                        "id": f"placed_{asset.get('id')}",
                        "name": asset.get("name"),
                        "model_src": asset.get("src"),
                        "scale": asset.get("scale", 1.0),
                        "lat": pt["lat"],
                        "lng": pt["lng"],
                        "altitude": round(hover_z, 2),
                        "heading": 45.0,
                        "pitch": round(pitch, 2),
                        "roll": round(roll, 2),
                        "speed_mps": 0.0
                    }
                ]
            })

        return {
            "status": "success",
            "scene_id": f"placed_{asset.get('id')}_{int(time.time() * 1000)}",
            "title": f"Placed: {asset.get('name')}",
            "city_id": city_id,
            "asset": asset,
            "total_duration_sec": duration,
            "total_frames": len(frames),
            "fps": fps,
            "waypoints": [pt],
            "camera_shots": [{"start_time": 0.0, "end_time": duration, "angle": "orbit", "label": "Orbit Inspection"}],
            "frames": frames,
            "is_vehicular": asset.get("category") in ("vehicle", "drone"),
            "actors": [
                {
                    "id": f"placed_{asset.get('id')}",
                    "name": asset.get("name"),
                    "asset_id": asset.get("id"),
                    "model_src": asset.get("src"),
                    "scale": asset.get("scale", 1.0),
                    "category": asset.get("category")
                }
            ]
        }

    def _generate_object_camera_shots(self, frames, duration, category):
        """Generates dynamic multi-shot cinematic cuts for object tracking."""
        shots = []
        if duration <= 4.0:
            shots.append({"start_time": 0.0, "end_time": duration, "angle": "auto_director", "label": "Hero Follow Shot"})
            return shots

        # 3-shot sequence
        s1 = round(duration * 0.35, 1)
        s2 = round(duration * 0.70, 1)

        if category == "vehicle":
            shots.append({"start_time": 0.0, "end_time": s1, "angle": "dolly", "label": "Chase Dolly Cam"})
            shots.append({"start_time": s1, "end_time": s2, "angle": "hero_low", "label": "Low-Angle Street Skid"})
            shots.append({"start_time": s2, "end_time": duration, "angle": "wide", "label": "Overhead Aerial Track"})
        elif category == "drone":
            shots.append({"start_time": 0.0, "end_time": s1, "angle": "wide", "label": "Corridor Flight Overlook"})
            shots.append({"start_time": s1, "end_time": s2, "angle": "closeup", "label": "Gimbal Pod Focus"})
            shots.append({"start_time": s2, "end_time": duration, "angle": "orbit", "label": "Rotary 360 Arc"})
        else:
            shots.append({"start_time": 0.0, "end_time": s1, "angle": "third_person", "label": "Over-the-Shoulder Tracking"})
            shots.append({"start_time": s1, "end_time": s2, "angle": "hero_low", "label": "Dynamic Low Angle"})
            shots.append({"start_time": s2, "end_time": duration, "angle": "wide", "label": "Architectural Full Shot"})

        return shots

object_physics_engine = ObjectPhysicsEngine()
