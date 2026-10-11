"""
RoboTwin AI Screenplay Physics & Scene Director Engine.
Simulates end-to-end photorealistic physical scenes from natural language prompts:
- Multi-Car Collisions (Head-on, T-bone, Rear-end, 3-car pileups, chain reactions)
- High-Speed Police Pursuits (Close chase, evasive maneuvers, banking turns, sirens)
- Extreme Drifts & Spinouts (Power slides, counter-steering, tire smoke, 180° rotation)
- Drag Racing (Dual vehicles accelerating side-by-side down the avenue)
- Heavy Truck vs Concrete Barrier Collisions
- Autonomous Multirotor Drone Flight (6-DoF aerial aerodynamics, corridor flybys, banked turns, hover)

Integrates Groq LLM (qwen/qwen3.8-27b & openai/gpt-oss-20b) with high-fidelity Newtonian
kinematic interpolation grounded physically at exact user-placed stage coordinates.
"""

import math
import time
import os
import json
import logging
import random
from typing import Dict, Any, List, Optional, Tuple

from backend.simulation.asset_catalog import asset_catalog_manager, ASSET_CATALOG
from backend.simulation.terrain_physics import terrain_physics_engine

logger = logging.getLogger(__name__)

METERS_PER_DEG_LAT = 111320.0
GRAVITY = 9.80665

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

CITY_STREET_GRIDS: Dict[str, Dict[str, float]] = {
    "san_francisco": {
        "avenue_heading": 350.5, # North-South corridor (Montgomery/Sansome)
        "street_heading": 80.5,  # East-West corridor (California/Clay)
        "max_corridor_len": 22.0
    },
    "manhattan": {
        "avenue_heading": 29.0,  # Uptown/Downtown avenues (8th Ave, Broadway)
        "street_heading": 119.0, # Crosstown streets (42nd St, 45th St)
        "max_corridor_len": 20.0
    },
    "chicago": {
        "avenue_heading": 0.0,
        "street_heading": 90.0,
        "max_corridor_len": 22.0
    },
    "tokyo": {
        "avenue_heading": 15.0,
        "street_heading": 105.0,
        "max_corridor_len": 18.0
    },
    "london": {
        "avenue_heading": 35.0,
        "street_heading": 125.0,
        "max_corridor_len": 18.0
    },
    "paris": {
        "avenue_heading": 40.0,
        "street_heading": 130.0,
        "max_corridor_len": 18.0
    }
}


def meters_to_lat_lng(center_lat: float, center_lng: float, dx: float, dy: float, alt: float = 0.0) -> Dict[str, float]:
    """Converts metric displacement (dx=East, dy=North) from origin into GPS coordinates."""
    d_lat = dy / METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    d_lng = dx / (METERS_PER_DEG_LAT * cos_lat)
    return {
        "lat": round(center_lat + d_lat, 7),
        "lng": round(center_lng + d_lng, 7),
        "altitude": round(alt, 2)
    }


def lat_lng_to_meters(center_lat: float, center_lng: float, lat: float, lng: float) -> Tuple[float, float]:
    """Converts GPS coordinates into metric offsets (dx, dy) relative to center origin."""
    dy = (lat - center_lat) * METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    dx = (lng - center_lng) * (METERS_PER_DEG_LAT * cos_lat)
    return dx, dy


def smooth_step(u: float) -> float:
    """Cubic Hermite smoothstep (0 to 1)."""
    u_clamped = max(0.0, min(1.0, u))
    return u_clamped * u_clamped * (3.0 - 2.0 * u_clamped)


def interpolate_heading(h0: float, h1: float, u: float) -> float:
    """Interpolates heading along shortest angular path with smoothstep."""
    s = smooth_step(u)
    dh = ((h1 - h0 + 180.0) % 360.0) - 180.0
    return (h0 + s * dh + 360.0) % 360.0


def get_stage_corridor_heading(stage_pos: Optional[Dict[str, float]], city_id: str = "san_francisco", is_cross_street: bool = False) -> float:
    """
    Dynamically resolves the roadway corridor heading for ANY location on Earth:
    1. If stage_pos specifies a heading (captured from viewport camera orientation, map pin heading, or user road dial),
       that exact angle is used for custom locations anywhere on Earth.
    2. If city_id is one of the predefined cities, looks up the surveyed avenue or cross-street heading.
    3. If cross-street is requested, returns perpendicular corridor (+90 deg).
    """
    if stage_pos and stage_pos.get("heading") is not None:
        base_h = float(stage_pos["heading"])
        return (base_h + 90.0) % 360.0 if is_cross_street else base_h % 360.0

    grid = CITY_STREET_GRIDS.get(city_id)
    if grid:
        return grid["street_heading"] if is_cross_street else grid["avenue_heading"]

    # Universal default if neither is provided
    return 90.0 if is_cross_street else 0.0


def rotate_to_corridor(lx: float, ly: float, corridor_hdg: float) -> Tuple[float, float]:
    """
    Transforms a local metric coordinate where:
      +X is along the corridor (local heading 90 deg)
      +Y is along cross-street (local heading 0 deg / North when corridor is East)
    into world metric coordinates (East=+X, North=+Y) along corridor_hdg (deg clockwise from North).
    """
    rad = math.radians(corridor_hdg)
    wx = lx * math.sin(rad) - ly * math.cos(rad)
    wy = lx * math.cos(rad) + ly * math.sin(rad)
    return wx, wy


def rotate_heading_to_corridor(local_heading: float, corridor_hdg: float) -> float:
    """
    Transforms a local heading (where 90 deg = corridor forward) into world geographic heading.
    """
    return (local_heading - 90.0 + corridor_hdg + 360.0) % 360.0


class ScreenplayPhysicsEngine:
    """
    Directs and simulates multi-actor physics scenarios (vehicles, drones, props, characters)
    for Google Earth 3D satellite visualization grounded at arbitrary user stage coordinates.
    """

    def __init__(self):
        pass

    def call_groq_scene_choreographer(
        self,
        prompt: str,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco"
    ) -> Optional[Dict[str, Any]]:
        """
        Calls Groq LLM API to translate user's natural language prompt into a custom stunt plan
        with chosen 3D actors, initial conditions, and keyframe trajectory waypoints.
        """
        if not GROQ_API_KEY:
            return None
        import requests
        models = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"]

        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)

        sys_prompt = """You are an expert Hollywood Stunt Coordinator & Physical Scene Choreographer for RoboTwin.
Given user prompt, output a unique multi-actor 3D stunt plan using certified 3D models:
Available models:
- vehicle_sedan (1500kg, max 45 m/s)
- vehicle_suv (2300kg, max 40 m/s)
- vehicle_sportscar (1350kg, max 65 m/s, agile drifter)
- vehicle_police (1750kg, max 50 m/s)
- vehicle_truck (5200kg, max 32 m/s)
- drone_quadcopter (4.5kg, max 25 m/s, altitude 5-45m)
- prop_barrier (Concrete Jersey Barrier, 2500kg)
- prop_debris_cluster (Collision wreckage)

Return valid JSON:
{
  "title": "Creative Scene Title",
  "scenario_type": "police_pursuit | high_speed_drift | drag_race | head_on_collision | t_bone_crash | rear_end | three_car_crash | truck_barrier_crash | drone_survey",
  "duration_sec": 6.0,
  "actors": [
    {
      "asset_id": "vehicle_police",
      "role": "pursuer",
      "keyframes": [
        {"time": 0.0, "dx": -18.0, "dy": -4.0, "alt": 0.0, "speed_mps": 22.0, "heading_deg": 45.0, "action": "ACCELERATE", "damaged": false, "smoke": false},
        {"time": 3.0, "dx": 0.0, "dy": 0.0, "alt": 0.0, "speed_mps": 26.0, "heading_deg": 60.0, "action": "DRIFT_CHASE", "damaged": false, "smoke": false},
        {"time": 6.0, "dx": 18.0, "dy": 6.0, "alt": 0.0, "speed_mps": 14.0, "heading_deg": 90.0, "action": "BRAKE", "damaged": false, "smoke": true}
      ]
    }
  ],
  "camera_shots": [
    {"start_time": 0.0, "end_time": 2.5, "angle": "3RD_PERSON", "label": "Opening Vector"},
    {"start_time": 2.5, "end_time": 6.0, "angle": "ACTION_CLOSEUP", "label": "Dynamic Action Framing"}
  ]
}"""

        user_content = (
            f"Scene description: {prompt}\n"
            f"Physical Street Corridor Heading: {corridor_hdg:.1f}° clockwise from North. "
            f"All vehicles must drive strictly along this heading ({corridor_hdg:.1f}°) or perpendicular cross-street ({(corridor_hdg + 90.0) % 360.0:.1f}°). "
            f"Keep all metric coordinates within 20m of (0,0) to stay on pavement."
        )

        for model_name in models:
            try:
                resp = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": sys_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 1400,
                        "temperature": 0.3
                    },
                    timeout=5.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw = data["choices"][0]["message"]["content"]
                    parsed = json.loads(raw)
                    if parsed.get("actors") and len(parsed["actors"]) > 0:
                        logger.info(f"Groq ({model_name}) generated stunt plan: {parsed.get('title')}")
                        return parsed
            except Exception as e:
                logger.debug(f"Groq model {model_name} note: {e}")
                continue

        return None

    def interpolate_ai_keyframes(
        self,
        ai_plan: Dict[str, Any],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Interpolates LLM stunt keyframes into dense 60 FPS multi-actor trajectories.
        """
        duration_sec = float(ai_plan.get("duration_sec", 6.0))
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = float(stage_pos.get("altitude", 0.0)) if stage_pos.get("altitude") is not None else terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)
        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)

        # Prepare actor structures
        actors_meta = []
        actor_kfs_map = {}

        for i, a_data in enumerate(ai_plan.get("actors", [])):
            asset_id = a_data.get("asset_id", "vehicle_sedan")
            cat_info = ASSET_CATALOG.get(asset_id, ASSET_CATALOG["vehicle_sedan"])
            actor_id = f"actor_{i}_{asset_id}"
            kfs = sorted(a_data.get("keyframes", []), key=lambda k: float(k.get("time", 0.0)))
            if not kfs:
                kfs = [
                    {"time": 0.0, "dx": 0.0, "dy": 0.0, "alt": 0.0, "speed_mps": 0.0, "heading_deg": 0.0},
                    {"time": duration_sec, "dx": 10.0, "dy": 10.0, "alt": 0.0, "speed_mps": 0.0, "heading_deg": 0.0}
                ]

            actors_meta.append({
                "id": actor_id,
                "name": cat_info["name"],
                "asset_id": asset_id,
                "model_src": cat_info["src"],
                "damaged_src": cat_info.get("damaged_src") or cat_info["src"],
                "category": cat_info.get("category", "vehicle"),
                "role": a_data.get("role", "actor"),
                "scale": 1.2 if cat_info.get("category") == "drone" else 1.0,
                "mass_kg": cat_info.get("mass_kg", 1500.0)
            })
            actor_kfs_map[actor_id] = kfs

        frames: List[Dict[str, Any]] = []

        for f_idx in range(total_frames):
            t = f_idx * dt
            frame_actors = []

            for act in actors_meta:
                kfs = actor_kfs_map[act["id"]]
                # Find bounding keyframes
                k_prev = kfs[0]
                k_next = kfs[-1]
                for k in kfs:
                    if float(k.get("time", 0.0)) <= t:
                        k_prev = k
                    if float(k.get("time", 0.0)) >= t:
                        k_next = k
                        break

                t0 = float(k_prev.get("time", 0.0))
                t1 = float(k_next.get("time", duration_sec))
                span = max(0.001, t1 - t0)
                u = smooth_step((t - t0) / span)

                raw_dx = k_prev.get("dx", 0.0) + u * (k_next.get("dx", 0.0) - k_prev.get("dx", 0.0))
                raw_dy = k_prev.get("dy", 0.0) + u * (k_next.get("dy", 0.0) - k_prev.get("dy", 0.0))
                rot_dx, rot_dy = rotate_to_corridor(raw_dx, raw_dy, corridor_hdg)
                x = xc + rot_dx
                y = yc + rot_dy
                alt = k_prev.get("alt", 0.0) + u * (k_next.get("alt", 0.0) - k_prev.get("alt", 0.0))
                delta_x = float(k_next.get("dx", 0.0)) - float(k_prev.get("dx", 0.0))
                delta_y = float(k_next.get("dy", 0.0)) - float(k_prev.get("dy", 0.0))
                dist_step = math.hypot(delta_x, delta_y)
                if dist_step > 0.5:
                    rot_vx, rot_vy = rotate_to_corridor(delta_x, delta_y, corridor_hdg)
                    heading = (math.degrees(math.atan2(rot_vx, rot_vy)) + 360.0) % 360.0
                else:
                    heading = rotate_heading_to_corridor(interpolate_heading(float(k_prev.get("heading_deg", 0.0)), float(k_next.get("heading_deg", 0.0)), u), corridor_hdg)
                speed = float(k_prev.get("speed_mps", 0.0)) + u * (float(k_next.get("speed_mps", 0.0)) - float(k_prev.get("speed_mps", 0.0)))

                is_damaged = bool(k_next.get("damaged", False) if u > 0.5 else k_prev.get("damaged", False))
                is_smoke = bool(k_next.get("smoke", False) if u > 0.5 else k_prev.get("smoke", False))

                # Pitch and roll dynamics
                accel = (float(k_next.get("speed_mps", 0.0)) - float(k_prev.get("speed_mps", 0.0))) / span
                pitch = max(-18.0, min(14.0, -0.4 * accel))
                dh = ((float(k_next.get("heading_deg", 0.0)) - float(k_prev.get("heading_deg", 0.0)) + 180.0) % 360.0) - 180.0
                roll = max(-25.0, min(25.0, 0.25 * (dh / span)))

                geo = meters_to_lat_lng(center_lat, center_lng, x, y, alt=alt)

                frame_actors.append({
                    "id": act["id"],
                    "name": act["name"],
                    "model_src": act["damaged_src"] if is_damaged else act["model_src"],
                    "category": act["category"],
                    "lat": geo["lat"],
                    "lng": geo["lng"],
                    "altitude": round(alt, 2),
                    "heading": round(heading, 2),
                    "pitch": round(pitch, 2),
                    "roll": round(roll, 2),
                    "speed_mps": round(speed, 2),
                    "damaged": is_damaged,
                    "smoke_active": is_smoke,
                    "scale": act.get("scale", 1.0)
                })

            lead_pos = frame_actors[0] if frame_actors else {"lat": stage_pos["lat"], "lng": stage_pos["lng"]}
            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": lead_pos["lat"],
                    "lng": lead_pos["lng"],
                    "altitude": lead_pos.get("altitude", 0.1),
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": lead_pos.get("heading", 0.0),
                "pitch": lead_pos.get("pitch", 0.0),
                "roll": lead_pos.get("roll", 0.0),
                "speed": lead_pos.get("speed_mps", 0.0),
                "action": "ACTION",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = ai_plan.get("camera_shots") or [
            {"shot_index": 1, "start_time": 0.0, "end_time": duration_sec * 0.45, "angle": "HERO_LOW", "label": "Ingress Tracking"},
            {"shot_index": 2, "start_time": duration_sec * 0.45, "end_time": duration_sec, "angle": "ACTION_CLOSEUP", "label": "Climax Action Shot"}
        ]

        return {
            "scenario_type": ai_plan.get("scenario_type", "ai_custom_scene"),
            "title": ai_plan.get("title", "AI Directed Action Scene"),
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors_meta,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Scene Ingress", "type": "INGRESS"},
                {"time": round(duration_sec * 0.5, 2), "label": "Climax Stunt Action", "type": "ACTION"},
                {"time": round(duration_sec, 2), "label": "Scene Rest / Hold", "type": "REST"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "START", "name": "Start", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 15.0},
                {"step": 1, "time": duration_sec, "action": "FINISH", "name": "Finish", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def resolve_screenplay_actors(self, prompt: str) -> Dict[str, Any]:
        """
        Robust semantic parser classifying prompt into tailored stunt scenarios.
        """
        p_lower = prompt.lower().strip()

        is_drone = any(k in p_lower for k in ["drone", "quadcopter", "uav", "aerial", "flies in air", "fly in air", "flying", "air corridor"])
        is_barrier = any(k in p_lower for k in ["barrier", "wall", "concrete", "guardrail", "block"])
        is_truck = any(k in p_lower for k in ["truck", "semi", "lorry", "delivery truck", "box truck", "cargo"])
        is_police = any(k in p_lower for k in ["police", "cop", "patrol", "pursuit", "siren", "interceptor", "chase", "chasing"])
        is_sports = any(k in p_lower for k in ["sports car", "supercar", "fast car", "race car", "apex", "ferrari"])
        is_drift = any(k in p_lower for k in ["drift", "drifting", "power slide", "spinout", "spins out", "burnout", "donut"])
        is_race = any(k in p_lower for k in ["race", "racing", "drag race", "side by side", "sprint"])
        is_head_on = any(k in p_lower for k in ["head on", "head-on", "facing each other", "opposing", "front to front"])
        is_rear_end = any(k in p_lower for k in ["rear end", "rear-end", "from behind", "tailgate", "rear"])
        is_three_cars = any(k in p_lower for k in [
            "two cars", "2 cars", "three cars", "3 cars", "pileup", "pile up",
            "car crash into two", "crash into two", "crashes into two", "multiple cars", "chain reaction"
        ])

        # 1. Drone Flight
        if is_drone and not ("hit by drone" in p_lower or "drone crashes" in p_lower):
            drone_asset = ASSET_CATALOG.get("drone_quadcopter")
            return {
                "scenario_type": "drone_flight",
                "title": "Autonomous Quadcopter Aerial Flight",
                "actors": [{
                    "id": "actor_drone",
                    "name": drone_asset["name"],
                    "asset_id": drone_asset["id"],
                    "model_src": drone_asset["src"],
                    "category": "drone",
                    "role": "aerial_flyer",
                    "scale": 1.2,
                    "mass_kg": drone_asset["mass_kg"]
                }],
                "duration_sec": 7.0
            }

        # 2. Police Pursuit (Chase)
        if is_police and not ("crash" in p_lower or "collision" in p_lower):
            lead = ASSET_CATALOG.get("vehicle_sportscar") if is_sports else ASSET_CATALOG.get("vehicle_sedan")
            cop = ASSET_CATALOG.get("vehicle_police")
            return {
                "scenario_type": "police_pursuit",
                "title": f"High-Speed Pursuit: Police Interceptor Chasing {lead['name']}",
                "actors": [
                    {"id": "actor_evader", "name": lead["name"], "asset_id": lead["id"], "model_src": lead["src"], "category": "vehicle", "role": "lead_evader", "scale": 1.0, "mass_kg": lead["mass_kg"]},
                    {"id": "actor_police", "name": cop["name"], "asset_id": cop["id"], "model_src": cop["src"], "category": "vehicle", "role": "pursuit_interceptor", "scale": 1.0, "mass_kg": cop["mass_kg"]}
                ],
                "duration_sec": 6.5
            }

        # 3. High-Speed Drift / Spinout
        if is_drift and not ("crash" in p_lower or "collision" in p_lower):
            car = ASSET_CATALOG.get("vehicle_sportscar") if is_sports else ASSET_CATALOG.get("vehicle_sedan")
            return {
                "scenario_type": "high_speed_drift",
                "title": f"Extreme Power Slide & 180° Drift: {car['name']}",
                "actors": [
                    {"id": "actor_drifter", "name": car["name"], "asset_id": car["id"], "model_src": car["src"], "category": "vehicle", "role": "drifter", "scale": 1.0, "mass_kg": car["mass_kg"]}
                ],
                "duration_sec": 6.0
            }

        # 4. Drag Race / Sprint
        if is_race and not ("crash" in p_lower or "collision" in p_lower):
            c1 = ASSET_CATALOG.get("vehicle_sportscar")
            c2 = ASSET_CATALOG.get("vehicle_sedan")
            return {
                "scenario_type": "drag_race",
                "title": f"Boulevard Drag Race: {c1['name']} vs {c2['name']}",
                "actors": [
                    {"id": "actor_racer1", "name": c1["name"], "asset_id": c1["id"], "model_src": c1["src"], "category": "vehicle", "role": "lane_left", "scale": 1.0, "mass_kg": c1["mass_kg"]},
                    {"id": "actor_racer2", "name": c2["name"], "asset_id": c2["id"], "model_src": c2["src"], "category": "vehicle", "role": "lane_right", "scale": 1.0, "mass_kg": c2["mass_kg"]}
                ],
                "duration_sec": 6.0
            }

        # 5. Truck vs Barrier
        if is_barrier and (is_truck or "crash" in p_lower or "hit" in p_lower):
            truck = ASSET_CATALOG.get("vehicle_truck") if is_truck else ASSET_CATALOG.get("vehicle_suv")
            barrier = ASSET_CATALOG.get("prop_barrier")
            debris = ASSET_CATALOG.get("prop_debris_cluster")
            return {
                "scenario_type": "truck_barrier_crash",
                "title": f"Heavy Impact: {truck['name']} vs Concrete Barrier",
                "actors": [
                    {"id": "actor_truck", "name": truck["name"], "asset_id": truck["id"], "model_src": truck["src"], "damaged_src": truck.get("damaged_src"), "category": "vehicle", "role": "collider", "scale": 1.0, "mass_kg": truck["mass_kg"]},
                    {"id": "actor_barrier", "name": barrier["name"], "asset_id": barrier["id"], "model_src": barrier["src"], "category": "prop", "role": "obstacle", "scale": 1.0, "mass_kg": barrier["mass_kg"]},
                    {"id": "actor_debris", "name": "Collision Debris", "asset_id": debris["id"], "model_src": debris["src"], "category": "prop", "role": "wreckage", "scale": 1.0, "mass_kg": 80.0}
                ],
                "duration_sec": 6.0
            }

        # 6. Head-On Collision
        if is_head_on:
            c1 = ASSET_CATALOG.get("vehicle_sedan")
            c2 = ASSET_CATALOG.get("vehicle_suv")
            debris = ASSET_CATALOG.get("prop_debris_cluster")
            return {
                "scenario_type": "head_on_collision",
                "title": f"Head-On Collision: {c1['name']} vs {c2['name']}",
                "actors": [
                    {"id": "actor_v1", "name": c1["name"], "asset_id": c1["id"], "model_src": c1["src"], "damaged_src": c1.get("damaged_src"), "category": "vehicle", "role": "eastbound_collider", "scale": 1.0, "mass_kg": c1["mass_kg"]},
                    {"id": "actor_v2", "name": c2["name"], "asset_id": c2["id"], "model_src": c2["src"], "damaged_src": c2.get("damaged_src"), "category": "vehicle", "role": "westbound_collider", "scale": 1.0, "mass_kg": c2["mass_kg"]},
                    {"id": "actor_debris", "name": "Collision Debris Scatter", "asset_id": debris["id"], "model_src": debris["src"], "category": "prop", "role": "wreckage", "scale": 1.0, "mass_kg": 80.0}
                ],
                "duration_sec": 6.0
            }

        # 7. Rear-End Collision
        if is_rear_end:
            c1 = ASSET_CATALOG.get("vehicle_suv")
            c2 = ASSET_CATALOG.get("vehicle_sportscar") if is_sports else ASSET_CATALOG.get("vehicle_sedan")
            debris = ASSET_CATALOG.get("prop_debris_cluster")
            return {
                "scenario_type": "rear_end_collision",
                "title": f"Rear-End Impact: High-Speed Tailgate into {c1['name']}",
                "actors": [
                    {"id": "actor_lead", "name": c1["name"], "asset_id": c1["id"], "model_src": c1["src"], "damaged_src": c1.get("damaged_src"), "category": "vehicle", "role": "lead_vehicle", "scale": 1.0, "mass_kg": c1["mass_kg"]},
                    {"id": "actor_ram", "name": c2["name"], "asset_id": c2["id"], "model_src": c2["src"], "damaged_src": c2.get("damaged_src"), "category": "vehicle", "role": "ramming_vehicle", "scale": 1.0, "mass_kg": c2["mass_kg"]},
                    {"id": "actor_debris", "name": "Bumper Debris", "asset_id": debris["id"], "model_src": debris["src"], "category": "prop", "role": "wreckage", "scale": 1.0, "mass_kg": 80.0}
                ],
                "duration_sec": 6.0
            }

        # 8. Three-Car Crash
        if is_three_cars or ("car" in p_lower and "crash" in p_lower and ("two" in p_lower or "three" in p_lower or "pileup" in p_lower)):
            a1 = ASSET_CATALOG.get("vehicle_sportscar") if is_sports else (ASSET_CATALOG.get("vehicle_police") if is_police else ASSET_CATALOG.get("vehicle_sedan"))
            a2 = ASSET_CATALOG.get("vehicle_suv")
            a3 = ASSET_CATALOG.get("vehicle_police") if not is_police else ASSET_CATALOG.get("vehicle_sedan")
            debris = ASSET_CATALOG.get("prop_debris_cluster")
            return {
                "scenario_type": "three_car_crash",
                "title": f"3-Car Pileup: {a1['name']} Crashes into Two Cars",
                "actors": [
                    {"id": "actor_lead", "name": a1["name"], "asset_id": a1["id"], "model_src": a1["src"], "damaged_src": a1.get("damaged_src"), "category": "vehicle", "role": "speeding_collider", "scale": 1.0, "mass_kg": a1["mass_kg"]},
                    {"id": "actor_target1", "name": a2["name"], "asset_id": a2["id"], "model_src": a2["src"], "damaged_src": a2.get("damaged_src"), "category": "vehicle", "role": "primary_target", "scale": 1.0, "mass_kg": a2["mass_kg"]},
                    {"id": "actor_target2", "name": a3["name"], "asset_id": a3["id"], "model_src": a3["src"], "damaged_src": a3.get("damaged_src"), "category": "vehicle", "role": "secondary_target", "scale": 1.0, "mass_kg": a3["mass_kg"]},
                    {"id": "actor_debris", "name": "Collision Debris Scatter", "asset_id": debris["id"], "model_src": debris["src"], "category": "prop", "role": "wreckage", "scale": 1.0, "mass_kg": 80.0}
                ],
                "duration_sec": 6.0
            }

        # 9. Two-Car Crash (T-Bone / Intersection)
        a1 = ASSET_CATALOG.get("vehicle_police") if is_police else (ASSET_CATALOG.get("vehicle_sportscar") if is_sports else ASSET_CATALOG.get("vehicle_sedan"))
        a2 = ASSET_CATALOG.get("vehicle_suv") if not is_truck else ASSET_CATALOG.get("vehicle_truck")
        debris = ASSET_CATALOG.get("prop_debris_cluster")
        return {
            "scenario_type": "two_car_crash",
            "title": f"Intersection T-Bone: {a1['name']} vs {a2['name']}",
            "actors": [
                {"id": "actor_lead", "name": a1["name"], "asset_id": a1["id"], "model_src": a1["src"], "damaged_src": a1.get("damaged_src"), "category": "vehicle", "role": "collider", "scale": 1.0, "mass_kg": a1["mass_kg"]},
                {"id": "actor_target1", "name": a2["name"], "asset_id": a2["id"], "model_src": a2["src"], "damaged_src": a2.get("damaged_src"), "category": "vehicle", "role": "target", "scale": 1.0, "mass_kg": a2["mass_kg"]},
                {"id": "actor_debris", "name": "Collision Debris", "asset_id": debris["id"], "model_src": debris["src"], "category": "prop", "role": "wreckage", "scale": 1.0, "mass_kg": 80.0}
            ],
            "duration_sec": 6.0
        }

    def simulate_police_pursuit(
        self,
        actors: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 6.5,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates dynamic police pursuit:
        - Lead car speeds down corridor at 25 m/s (~56 mph), drifts around corner with tire smoke.
        - Police interceptor follows 16m behind with high-g cornering, banking, and siren tracking.
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = float(stage_pos.get("altitude", 0.0)) if stage_pos.get("altitude") is not None else terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)

        evader = actors[0]
        police = actors[1]

        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)
        approach_dist = 20.0  # Clamped to 20m to stay on street and prevent clipping building walls

        frames: List[Dict[str, Any]] = []

        # Lead evader path: approaches down corridor, then sharp right turn onto cross street
        for f_idx in range(total_frames):
            t = f_idx * dt

            # Evader (Lead)
            if t < 2.5:
                # Approach phase: accelerating along corridor (local heading 90)
                u = t / 2.5
                e_lx = -approach_dist + u * approach_dist
                e_ly = 0.0
                e_lh = 90.0
                e_spd = 24.0 + 4.0 * u
                e_pitch = -1.2
                e_roll = 0.0
                e_smoke = False
            elif t < 4.2:
                # Corner drift phase: rotates 90 deg right
                u = (t - 2.5) / 1.7
                s = smooth_step(u)
                radius = 8.0
                e_lx = radius * (1.0 - math.cos(math.radians(s * 90.0)))
                e_ly = -radius * math.sin(math.radians(s * 90.0))
                e_lh = 90.0 + s * 90.0
                e_spd = 22.0
                e_pitch = 0.5
                e_roll = 8.5 * math.sin(u * math.pi)  # Body roll in turn
                e_smoke = (u > 0.2 and u < 0.9)  # Tire smoke during drift
            else:
                # Exit sprint down cross street
                u = (t - 4.2) / (duration_sec - 4.2)
                e_lx = 8.0
                e_ly = -8.0 - u * 20.0
                e_lh = 180.0
                e_spd = 26.0
                e_pitch = -1.5
                e_roll = 0.0
                e_smoke = False

            # Police (Follows ~0.65s behind)
            t_cop = max(0.0, t - 0.65)
            if t_cop < 2.5:
                u = t_cop / 2.5
                p_lx = -approach_dist + u * approach_dist
                p_ly = 0.0
                p_lh = 90.0
                p_spd = 25.0
                p_pitch = -1.0
                p_roll = 0.0
                p_smoke = False
            elif t_cop < 4.2:
                u = (t_cop - 2.5) / 1.7
                s = smooth_step(u)
                radius = 8.0
                p_lx = radius * (1.0 - math.cos(math.radians(s * 90.0)))
                p_ly = -radius * math.sin(math.radians(s * 90.0))
                p_lh = 90.0 + s * 90.0
                p_spd = 23.5
                p_pitch = 0.8
                p_roll = 10.0 * math.sin(u * math.pi)
                p_smoke = (u > 0.3)
            else:
                u = (t_cop - 4.2) / max(0.1, duration_sec - 4.2)
                p_lx = 8.0
                p_ly = -8.0 - u * 20.0
                p_lh = 180.0
                p_spd = 26.5
                p_pitch = -1.8
                p_roll = 0.0
                p_smoke = False

            # Transform from local road frame to world coordinates
            e_wx, e_wy = rotate_to_corridor(e_lx, e_ly, corridor_hdg)
            p_wx, p_wy = rotate_to_corridor(p_lx, p_ly, corridor_hdg)

            e_h = rotate_heading_to_corridor(e_lh, corridor_hdg)
            p_h = rotate_heading_to_corridor(p_lh, corridor_hdg)

            geo_e = meters_to_lat_lng(center_lat, center_lng, xc + e_wx, yc + e_wy, alt=0.0)
            geo_p = meters_to_lat_lng(center_lat, center_lng, xc + p_wx, yc + p_wy, alt=0.0)

            frame_actors = [
                {
                    "id": evader["id"],
                    "name": evader["name"],
                    "model_src": evader["model_src"],
                    "category": "vehicle",
                    "lat": geo_e["lat"],
                    "lng": geo_e["lng"],
                    "altitude": 0.1,
                    "heading": round(e_h, 2),
                    "pitch": round(e_pitch, 2),
                    "roll": round(e_roll, 2),
                    "speed_mps": round(e_spd, 2),
                    "damaged": False,
                    "smoke_active": e_smoke,
                    "scale": 1.0
                },
                {
                    "id": police["id"],
                    "name": police["name"],
                    "model_src": police["model_src"],
                    "category": "vehicle",
                    "lat": geo_p["lat"],
                    "lng": geo_p["lng"],
                    "altitude": 0.1,
                    "heading": round(p_h, 2),
                    "pitch": round(p_pitch, 2),
                    "roll": round(p_roll, 2),
                    "speed_mps": round(p_spd, 2),
                    "damaged": False,
                    "smoke_active": p_smoke,
                    "scale": 1.0
                }
            ]

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo_e["lat"],
                    "lng": geo_e["lng"],
                    "altitude": 0.1,
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": round(e_h, 2),
                "pitch": round(e_pitch, 2),
                "roll": round(e_roll, 2),
                "speed": round(e_spd, 2),
                "action": "PURSUIT_CHASE",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 2.4, "angle": "HERO_LOW", "label": "Corridor High-Speed Ingress"},
            {"shot_index": 2, "start_time": 2.4, "end_time": 4.5, "angle": "ACTION_CLOSEUP", "label": "Intersection Drift & Body Roll"},
            {"shot_index": 3, "start_time": 4.5, "end_time": duration_sec, "angle": "3RD_PERSON", "label": "High-Speed Exit Pursuit"}
        ]

        return {
            "scenario_type": "police_pursuit",
            "title": f"High-Speed Pursuit: Police Interceptor Chasing {evader['name']}",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Pursuit Commences at High Speed", "type": "INGRESS"},
                {"time": 2.8, "label": "🏎️ Aggressive 90° Intersection Drift Slide", "type": "DRIFT"},
                {"time": 4.5, "label": "🚔 Police Interceptor Accelerates into Lead", "type": "CHASE"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "START", "name": "Ingress", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 24.0},
                {"step": 1, "time": duration_sec, "action": "FINISH", "name": "Exit", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 26.0}
            ],
            "focal_point": stage_pos
        }

    def simulate_high_speed_drift(
        self,
        actors: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 6.0,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates extreme single-car power slide, tire smoke, 180° counter-steer rotation and brake.
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = float(stage_pos.get("altitude", 0.0)) if stage_pos.get("altitude") is not None else terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)

        car = actors[0]
        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)
        approach_dist = 20.0  # Clamped to 20m to stay on the pavement

        frames: List[Dict[str, Any]] = []

        for f_idx in range(total_frames):
            t = f_idx * dt

            if t < 2.2:
                # Full throttle acceleration along corridor (local heading 90)
                u = t / 2.2
                lx = -approach_dist + u * approach_dist
                ly = 0.0
                lh = 90.0
                spd = 18.0 + 12.0 * u
                pitch = -2.2
                roll = 0.0
                smoke = False
            elif t < 4.2:
                # 180-degree drift rotation slide across lane width
                u = (t - 2.2) / 2.0
                s = smooth_step(u)
                lx = s * 12.0
                ly = math.sin(u * math.pi) * 4.2
                lh = 90.0 + s * 180.0  # ends facing 270 (reverse)
                spd = max(6.0, 30.0 - 18.0 * u)
                pitch = 1.0
                roll = -9.5 * math.sin(u * math.pi)
                smoke = True
            else:
                # Emergency ABS brake to stop
                u = (t - 4.2) / 1.8
                lx = 12.0 + (1.0 - math.cos(u * math.pi * 0.5)) * 3.0
                ly = 0.0
                lh = 270.0
                spd = max(0.0, 6.0 * (1.0 - u))
                pitch = 1.8 * (1.0 - u)
                roll = 0.0
                smoke = (u < 0.4)

            wx, wy = rotate_to_corridor(lx, ly, corridor_hdg)
            h = rotate_heading_to_corridor(lh, corridor_hdg)

            geo = meters_to_lat_lng(center_lat, center_lng, xc + wx, yc + wy, alt=0.0)
            frame_actors = [{
                "id": car["id"],
                "name": car["name"],
                "model_src": car["model_src"],
                "category": "vehicle",
                "lat": geo["lat"],
                "lng": geo["lng"],
                "altitude": 0.1,
                "heading": round(h, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "speed_mps": round(spd, 2),
                "damaged": False,
                "smoke_active": smoke,
                "scale": 1.0
            }]

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo["lat"],
                    "lng": geo["lng"],
                    "altitude": 0.1,
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": round(h, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "speed": round(spd, 2),
                "action": "DRIFT_SPIN",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 2.2, "angle": "HERO_LOW", "label": "Full-Throttle Ingress"},
            {"shot_index": 2, "start_time": 2.2, "end_time": 4.5, "angle": "ACTION_CLOSEUP", "label": "180° Power Slide & Smoke"},
            {"shot_index": 3, "start_time": 4.5, "end_time": duration_sec, "angle": "3RD_PERSON", "label": "Resting Stance"}
        ]

        return {
            "scenario_type": "high_speed_drift",
            "title": f"Extreme Power Slide & 180° Drift: {car['name']}",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Full Throttle Launch", "type": "LAUNCH"},
                {"time": 2.4, "label": "🏎️ Lateral Breakout & Counter-Steer Drift", "type": "DRIFT"},
                {"time": 4.6, "label": "180° Spinout Completed & Stopped", "type": "REST"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "START", "name": "Start", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 18.0},
                {"step": 1, "time": duration_sec, "action": "REST", "name": "Halt", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def simulate_head_on_collision(
        self,
        actors: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 6.0,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates violent head-on frontal impact between two vehicles on opposing courses.
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)

        v1 = actors[0]
        v2 = actors[1]
        debris = actors[2] if len(actors) > 2 else {"id": "debris", "model_src": "/models/prop_debris_cluster.glb"}

        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)
        rad = math.radians(corridor_hdg)
        approach_dist = min(20.0, 22.0)

        impact_time = 2.2
        frames: List[Dict[str, Any]] = []

        for f_idx in range(total_frames):
            t = f_idx * dt
            is_imp = t >= impact_time
            dt_imp = max(0.0, t - impact_time)

            if not is_imp:
                u = t / impact_time
                disp1 = -approach_dist + u * (approach_dist - 1.5)
                disp2 = approach_dist - u * (approach_dist - 1.5)

                x1 = xc + disp1 * math.sin(rad)
                y1 = yc + disp1 * math.cos(rad)
                h1 = corridor_hdg
                spd1 = 18.0
                dmg1 = False

                x2 = xc + disp2 * math.sin(rad)
                y2 = yc + disp2 * math.cos(rad)
                h2 = (corridor_hdg + 180.0) % 360.0
                spd2 = 18.0
                dmg2 = False
                smoke = False
                p1 = -1.2 * u
                p2 = -1.2 * u
                r1 = 0.0
                r2 = 0.0
            else:
                # Post-impact rebound & spin
                decel = max(0.0, 1.0 - dt_imp * 1.5)
                disp1 = -1.5 - dt_imp * 2.5 * decel
                disp2 = 1.5 + dt_imp * 2.2 * decel

                # Lateral deflection across street
                lat_disp1 = -dt_imp * 1.8 * decel
                lat_disp2 = dt_imp * 1.8 * decel

                x1 = xc + disp1 * math.sin(rad) + lat_disp1 * math.cos(rad)
                y1 = yc + disp1 * math.cos(rad) - lat_disp1 * math.sin(rad)
                h1 = (corridor_hdg + min(45.0, dt_imp * 40.0)) % 360.0
                spd1 = 4.0 * decel
                dmg1 = True

                x2 = xc + disp2 * math.sin(rad) + lat_disp2 * math.cos(rad)
                y2 = yc + disp2 * math.cos(rad) - lat_disp2 * math.sin(rad)
                h2 = (corridor_hdg + 180.0 - min(45.0, dt_imp * 40.0)) % 360.0
                spd2 = 3.5 * decel
                dmg2 = True
                smoke = (dt_imp < 2.5)

                # Violent pitch rebound
                p1 = math.sin(dt_imp * 8.0) * 4.5 * decel
                p2 = math.sin(dt_imp * 8.0) * 4.2 * decel
                r1 = math.cos(dt_imp * 6.5) * 5.0 * decel
                r2 = -math.cos(dt_imp * 6.5) * 5.2 * decel

            geo1 = meters_to_lat_lng(center_lat, center_lng, x1, y1, alt=0.0)
            geo2 = meters_to_lat_lng(center_lat, center_lng, x2, y2, alt=0.0)

            frame_actors = [
                {
                    "id": v1["id"],
                    "name": v1["name"],
                    "model_src": v1.get("damaged_src") if dmg1 else v1["model_src"],
                    "category": "vehicle",
                    "lat": geo1["lat"],
                    "lng": geo1["lng"],
                    "altitude": 0.1,
                    "heading": round(h1, 2),
                    "pitch": round(p1, 2),
                    "roll": round(r1, 2),
                    "speed_mps": round(spd1, 2),
                    "damaged": dmg1,
                    "smoke_active": smoke,
                    "scale": 1.0
                },
                {
                    "id": v2["id"],
                    "name": v2["name"],
                    "model_src": v2.get("damaged_src") if dmg2 else v2["model_src"],
                    "category": "vehicle",
                    "lat": geo2["lat"],
                    "lng": geo2["lng"],
                    "altitude": 0.1,
                    "heading": round(h2, 2),
                    "pitch": round(p2, 2),
                    "roll": round(r2, 2),
                    "speed_mps": round(spd2, 2),
                    "damaged": dmg2,
                    "smoke_active": smoke,
                    "scale": 1.0
                }
            ]

            if is_imp:
                geo_deb = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
                frame_actors.append({
                    "id": "actor_debris",
                    "name": "Collision Debris",
                    "model_src": debris.get("model_src", "/models/prop_debris_cluster.glb"),
                    "category": "prop",
                    "lat": geo_deb["lat"],
                    "lng": geo_deb["lng"],
                    "altitude": 0.1,
                    "heading": 45.0,
                    "pitch": 0.0,
                    "roll": 0.0,
                    "scale": 1.0
                })

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo1["lat"],
                    "lng": geo1["lng"],
                    "altitude": 0.1,
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": round(h1, 2),
                "pitch": round(p1, 2),
                "roll": round(r1, 2),
                "speed": round(spd1, 2),
                "action": "HEAD_ON_CRASH" if is_imp else "HEAD_ON_APPROACH",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 2.0, "angle": "HERO_LOW", "label": "Opposing High-Speed Ingress"},
            {"shot_index": 2, "start_time": 2.0, "end_time": 3.8, "angle": "ACTION_CLOSEUP", "label": "💥 Frontal Head-On Impact"},
            {"shot_index": 3, "start_time": 3.8, "end_time": duration_sec, "angle": "DRONE_WIDE", "label": "Wreckage Debris Survey"}
        ]

        return {
            "scenario_type": "head_on_collision",
            "title": f"Head-On Collision: {v1['name']} vs {v2['name']}",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Opposing Lanes Approach (40 mph)", "type": "INGRESS"},
                {"time": 2.2, "label": "💥 Massive Head-On Frontal Collision", "type": "IMPACT"},
                {"time": 4.5, "label": "Vehicles Settle at Impact Origin", "type": "REST"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "START", "name": "Start", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 18.0},
                {"step": 1, "time": duration_sec, "action": "REST", "name": "Halt", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def simulate_drone_flight(
        self,
        actor: Dict[str, Any],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 7.0,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates 6-DoF multirotor drone aerodynamics:
        1. Vertical takeoff climb (0.0s - 1.2s)
        2. Forward corridor pitch dive & high-speed acceleration (1.2s - 3.8s)
        3. Banking dynamic turn (3.8s - 5.4s)
        4. Aerodynamic deceleration flare & stable hover (5.4s - 7.0s)
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        origin_lat = stage_pos["lat"]
        origin_lng = stage_pos["lng"]
        base_ground_alt = float(stage_pos.get("altitude", 0.0)) if stage_pos.get("altitude") is not None else terrain_physics_engine.get_elevation(origin_lat, origin_lng, city_id)
        xc, yc = lat_lng_to_meters(center_lat, center_lng, origin_lat, origin_lng)
        flight_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)

        frames: List[Dict[str, Any]] = []
        x = xc
        y = yc
        alt_rel = 0.2

        for f_idx in range(total_frames):
            t = f_idx * dt

            if t < 1.2:
                progress = t / 1.2
                smooth_p = 0.5 * (1.0 - math.cos(progress * math.pi))
                alt_rel = 0.2 + 15.0 * smooth_p
                heading = flight_hdg
                pitch = 0.0
                roll = 0.8 * math.sin(t * 8.0)
                speed = 4.5 * (1.0 - smooth_p)
                action_name = "TAKEOFF_CLIMB"
            elif t < 3.8:
                t_sub = t - 1.2
                progress = t_sub / 2.6
                speed = 22.0 * math.sin(progress * (math.pi / 2.0))
                dist = speed * dt
                x += dist * math.sin(math.radians(flight_hdg))
                y += dist * math.cos(math.radians(flight_hdg))
                pitch = -22.0 * min(1.0, progress * 1.8)
                roll = 1.5 * math.sin(t * 6.0)
                alt_rel = 15.0 + 5.0 * progress
                heading = flight_hdg
                action_name = "CORRIDOR_FLYBY"
            elif t < 5.4:
                t_sub = t - 3.8
                progress = t_sub / 1.6
                speed = max(12.0, 22.0 - 8.0 * progress)
                heading = (flight_hdg + 150.0 * (0.5 * (1.0 - math.cos(progress * math.pi)))) % 360.0
                dist = speed * dt
                x += dist * math.sin(math.radians(heading))
                y += dist * math.cos(math.radians(heading))
                bank_envelope = math.sin(progress * math.pi)
                roll = 28.0 * bank_envelope
                pitch = -12.0 * (1.0 - progress)
                alt_rel = 20.0 + 4.5 * bank_envelope
                action_name = "BANKED_CURVE"
            else:
                t_sub = t - 5.4
                progress = t_sub / 1.6
                speed = max(0.0, 12.0 * (1.0 - min(1.0, progress * 1.5)))
                dist = speed * dt
                end_hdg = (flight_hdg + 150.0) % 360.0
                x += dist * math.sin(math.radians(end_hdg))
                y += dist * math.cos(math.radians(end_hdg))
                if progress < 0.5:
                    pitch = 16.0 * (1.0 - progress * 2.0)
                    roll = 0.0
                else:
                    pitch = 1.2 * math.sin(t * 3.5)
                    roll = 1.8 * math.cos(t * 4.2)
                alt_rel = 24.0 + 0.35 * math.sin(t * 2.8)
                heading = end_hdg
                action_name = "HOVER_STABILIZE"

            geo = meters_to_lat_lng(center_lat, center_lng, x, y, alt=round(alt_rel, 2))
            actor_state = {
                "id": actor["id"],
                "name": actor["name"],
                "model_src": actor["model_src"],
                "category": "drone",
                "lat": geo["lat"],
                "lng": geo["lng"],
                "altitude": round(alt_rel, 2),
                "heading": round(heading, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "speed_mps": round(speed, 2),
                "scale": 1.2
            }

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo["lat"],
                    "lng": geo["lng"],
                    "altitude": round(alt_rel, 2),
                    "altitude_offset": round(alt_rel, 2),
                    "ground_altitude": base_ground_alt
                },
                "heading": round(heading, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "speed": round(speed, 2),
                "action": action_name,
                "actors": [actor_state]
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 1.8, "angle": "HERO_LOW", "label": "Vertical Takeoff Lift"},
            {"shot_index": 2, "start_time": 1.8, "end_time": 4.5, "angle": "ACTION_CLOSEUP", "label": "Corridor High-Speed Dive"},
            {"shot_index": 3, "start_time": 4.5, "end_time": duration_sec, "angle": "DRONE_WIDE", "label": "Aerodynamic Flare & Hover"}
        ]

        return {
            "scenario_type": "drone_flight",
            "title": "Autonomous Quadcopter Aerial Flight",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": [actor],
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Vertical Takeoff Climb (0 - 15m)", "type": "TAKEOFF"},
                {"time": 2.2, "label": "High-Speed Corridor Pitch Dive (49 mph)", "type": "FLYBY"},
                {"time": 5.4, "label": "Aerodynamic Flare & Stable Hover", "type": "HOVER"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "TAKEOFF", "name": "Launch Pad", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.2, "speed": 4.5},
                {"step": 1, "time": duration_sec, "action": "HOVER", "name": "Hover Stance", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 24.0, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def simulate_truck_barrier_crash(
        self,
        actors: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 6.0,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates heavy freight truck colliding with concrete barrier.
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)

        truck_data = actors[0]
        barrier_data = actors[1]
        debris_data = actors[2] if len(actors) > 2 else {"id": "debris", "model_src": "/models/prop_debris_cluster.glb"}

        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)
        rad = math.radians(corridor_hdg)

        impact_time = 2.1
        speed_init = 14.0
        approach_dist = min(20.0, speed_init * impact_time)

        # Ingress path strictly aligned along street corridor (parallel to building facades)
        x_truck_start = xc - approach_dist * math.sin(rad)
        y_truck_start = yc - approach_dist * math.cos(rad)
        x_barrier = xc
        y_barrier = yc

        frames: List[Dict[str, Any]] = []

        for f_idx in range(total_frames):
            t = f_idx * dt
            is_imp = t >= impact_time
            dt_imp = max(0.0, t - impact_time)

            if not is_imp:
                prog = t / impact_time
                x_t = x_truck_start + prog * (xc - x_truck_start)
                y_t = y_truck_start + prog * (yc - y_truck_start)
                t_spd = speed_init
                t_pitch = -0.8 * prog
                t_dmg = False
                b_tilt = 0.0
                b_disp = 0.0
            else:
                decel = max(0.0, 1.0 - (dt_imp * 1.8))
                post_disp = min(5.5, dt_imp * 3.2 * decel)
                x_t = xc + post_disp * math.sin(rad)
                y_t = yc + post_disp * math.cos(rad)
                t_spd = speed_init * 0.45 * decel
                t_pitch = math.sin(dt_imp * 6.0) * 3.0 * decel
                t_dmg = True
                b_tilt = min(75.0, dt_imp * 65.0)
                b_disp = min(3.8, dt_imp * 2.4)

            geo_truck = meters_to_lat_lng(center_lat, center_lng, x_t, y_t, alt=0.0)
            x_b = x_barrier + 0.3 * math.cos(rad) + b_disp * math.sin(rad)
            y_b = y_barrier - 0.3 * math.sin(rad) + b_disp * math.cos(rad)
            geo_bar = meters_to_lat_lng(center_lat, center_lng, x_b, y_b, alt=0.0)

            frame_actors = [
                {
                    "id": truck_data["id"],
                    "name": truck_data["name"],
                    "model_src": truck_data.get("damaged_src") if t_dmg else truck_data["model_src"],
                    "category": "vehicle",
                    "lat": geo_truck["lat"],
                    "lng": geo_truck["lng"],
                    "altitude": 0.1,
                    "heading": round(corridor_hdg, 2),
                    "pitch": round(t_pitch, 2),
                    "roll": 0.0,
                    "speed_mps": round(t_spd, 2),
                    "damaged": t_dmg,
                    "smoke_active": is_imp and dt_imp < 2.5,
                    "scale": 1.0
                },
                {
                    "id": barrier_data["id"],
                    "name": barrier_data["name"],
                    "model_src": barrier_data["model_src"],
                    "category": "prop",
                    "lat": geo_bar["lat"],
                    "lng": geo_bar["lng"],
                    "altitude": 0.1,
                    "heading": round((corridor_hdg + 90.0) % 360.0, 2),
                    "pitch": round(b_tilt, 2),
                    "roll": 0.0,
                    "speed_mps": round(t_spd * 0.4, 2),
                    "scale": 1.0
                }
            ]

            if is_imp:
                geo_deb = meters_to_lat_lng(center_lat, center_lng, xc + 1.2, yc + min(2.5, dt_imp * 2.0), alt=0.0)
                frame_actors.append({
                    "id": "actor_debris",
                    "name": "Concrete Debris",
                    "model_src": debris_data.get("model_src", "/models/prop_debris_cluster.glb"),
                    "category": "prop",
                    "lat": geo_deb["lat"],
                    "lng": geo_deb["lng"],
                    "altitude": 0.1,
                    "heading": 45.0,
                    "pitch": 0.0,
                    "roll": 0.0,
                    "scale": 0.9
                })

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo_truck["lat"],
                    "lng": geo_truck["lng"],
                    "altitude": 0.1,
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": 0.0,
                "pitch": round(t_pitch, 2),
                "roll": 0.0,
                "speed": round(t_spd, 2),
                "action": "BARRIER_CRASH" if is_imp else "TRUCK_APPROACH",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 2.0, "angle": "HERO_LOW", "label": "Low-Angle Roadbed Approach"},
            {"shot_index": 2, "start_time": 2.0, "end_time": 3.4, "angle": "ACTION_CLOSEUP", "label": "Concrete Barrier Kinetic Impact"},
            {"shot_index": 3, "start_time": 3.4, "end_time": duration_sec, "angle": "DRONE_WIDE", "label": "Overhead Crane Debris Survey"}
        ]

        return {
            "scenario_type": "truck_barrier_crash",
            "title": f"Heavy Impact: {truck_data['name']} vs Concrete Barrier",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "Truck Approaches Barrier (36 mph)", "type": "APPROACH"},
                {"time": round(impact_time, 2), "label": "💥 Massive Impact! Jersey Barrier Topples", "type": "IMPACT"},
                {"time": round(duration_sec - 0.5, 2), "label": "Truck Comes to Full Stop", "type": "REST"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "APPROACH", "name": "Approach", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": speed_init},
                {"step": 1, "time": duration_sec, "action": "REST", "name": "Halt", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def simulate_three_car_crash(
        self,
        actors: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        stage_pos: Dict[str, float],
        city_id: str = "san_francisco",
        duration_sec: float = 6.0,
        fps: int = 60
    ) -> Dict[str, Any]:
        """
        Simulates 3-car pileup collision at intersection origin.
        """
        total_frames = int(duration_sec * fps)
        dt = 1.0 / fps

        xc, yc = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
        base_ground_alt = float(stage_pos.get("altitude", 0.0)) if stage_pos.get("altitude") is not None else terrain_physics_engine.get_elevation(stage_pos["lat"], stage_pos["lng"], city_id)

        v1 = actors[0]
        v2 = actors[1]
        v3 = actors[2]
        debris = actors[3] if len(actors) > 3 else {"id": "debris", "model_src": "/models/prop_debris_cluster.glb"}

        corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)

        impact1_time = 2.15
        impact2_time = 2.55

        # Approach clamped to 20m so cars don't spawn inside building facades
        speed1_init = 16.0
        approach1 = min(20.0, speed1_init * impact1_time)
        lx1_start = -approach1
        ly1_start = 0.0

        speed2_init = 12.0
        approach2 = min(18.0, speed2_init * impact1_time)
        lx2_start = 0.0
        ly2_start = -approach2

        speed3_init = 2.5
        lx3_start = 8.5 + speed3_init * impact2_time
        ly3_start = 2.5

        frames: List[Dict[str, Any]] = []

        for f_idx in range(total_frames):
            t = f_idx * dt
            is_imp1 = t >= impact1_time
            is_imp2 = t >= impact2_time
            dt_imp1 = max(0.0, t - impact1_time)
            dt_imp2 = max(0.0, t - impact2_time)

            if not is_imp1:
                u1 = t / impact1_time
                lx1 = lx1_start + u1 * (0.0 - lx1_start)
                ly1 = ly1_start
                lh1 = 90.0
                spd1 = speed1_init
                dmg1 = False

                u2 = t / impact1_time
                lx2 = lx2_start
                ly2 = ly2_start + u2 * (0.0 - ly2_start)
                lh2 = 0.0
                spd2 = speed2_init
                dmg2 = False
                smoke = False
            else:
                decel1 = max(0.0, 1.0 - dt_imp1 * 1.6)
                lx1 = dt_imp1 * 4.5 * decel1
                ly1 = dt_imp1 * 3.2 * decel1
                lh1 = 90.0 - min(85.0, dt_imp1 * 75.0)
                spd1 = 8.0 * decel1
                dmg1 = True

                if not is_imp2:
                    decel2 = max(0.0, 1.0 - dt_imp1 * 1.4)
                    lx2 = dt_imp1 * 12.0 * decel2
                    ly2 = dt_imp1 * 6.5 * decel2
                    lh2 = min(140.0, dt_imp1 * 160.0)
                    spd2 = 12.0 * decel2
                    dmg2 = True
                    smoke = True
                else:
                    decel2 = max(0.0, 1.0 - dt_imp2 * 2.2)
                    lx2 = 5.0 + dt_imp2 * 3.0 * decel2
                    ly2 = 2.5 + dt_imp2 * 1.8 * decel2
                    lh2 = 140.0 + dt_imp2 * 45.0
                    spd2 = 4.0 * decel2
                    dmg2 = True
                    smoke = True

            if not is_imp2:
                lx3 = lx3_start - (speed3_init * t)
                ly3 = ly3_start
                lh3 = 270.0
                spd3 = speed3_init
                dmg3 = False
            else:
                decel3 = max(0.0, 1.0 - dt_imp2 * 2.0)
                lx3 = 8.5 + dt_imp2 * 4.5 * decel3
                ly3 = 2.5 + dt_imp2 * 3.2 * decel3
                lh3 = 270.0 + min(65.0, dt_imp2 * 60.0)
                spd3 = 6.0 * decel3
                dmg3 = True

            # Transform from local intersection frame to world coordinates
            wx1, wy1 = rotate_to_corridor(lx1, ly1, corridor_hdg)
            wx2, wy2 = rotate_to_corridor(lx2, ly2, corridor_hdg)
            wx3, wy3 = rotate_to_corridor(lx3, ly3, corridor_hdg)

            wh1 = rotate_heading_to_corridor(lh1, corridor_hdg)
            wh2 = rotate_heading_to_corridor(lh2, corridor_hdg)
            wh3 = rotate_heading_to_corridor(lh3, corridor_hdg)

            geo1 = meters_to_lat_lng(center_lat, center_lng, xc + wx1, yc + wy1, alt=0.0)
            geo2 = meters_to_lat_lng(center_lat, center_lng, xc + wx2, yc + wy2, alt=0.0)
            geo3 = meters_to_lat_lng(center_lat, center_lng, xc + wx3, yc + wy3, alt=0.0)

            frame_actors = [
                {
                    "id": v1["id"],
                    "name": v1["name"],
                    "model_src": v1.get("damaged_src") if dmg1 else v1["model_src"],
                    "category": "vehicle",
                    "lat": geo1["lat"],
                    "lng": geo1["lng"],
                    "altitude": 0.1,
                    "heading": round(wh1, 2),
                    "pitch": 0.0,
                    "roll": 0.0,
                    "speed_mps": round(spd1, 2),
                    "damaged": dmg1,
                    "smoke_active": smoke,
                    "scale": 1.0
                },
                {
                    "id": v2["id"],
                    "name": v2["name"],
                    "model_src": v2.get("damaged_src") if dmg2 else v2["model_src"],
                    "category": "vehicle",
                    "lat": geo2["lat"],
                    "lng": geo2["lng"],
                    "altitude": 0.1,
                    "heading": round(wh2, 2),
                    "pitch": 0.0,
                    "roll": 0.0,
                    "speed_mps": round(spd2, 2),
                    "damaged": dmg2,
                    "smoke_active": smoke,
                    "scale": 1.0
                },
                {
                    "id": v3["id"],
                    "name": v3["name"],
                    "model_src": v3.get("damaged_src") if dmg3 else v3["model_src"],
                    "category": "vehicle",
                    "lat": geo3["lat"],
                    "lng": geo3["lng"],
                    "altitude": 0.1,
                    "heading": round(wh3, 2),
                    "pitch": 0.0,
                    "roll": 0.0,
                    "speed_mps": round(spd3, 2),
                    "damaged": dmg3,
                    "smoke_active": smoke and is_imp2,
                    "scale": 1.0
                }
            ]

            if is_imp1:
                wxd, wyd = rotate_to_corridor(1.5, 0.0, corridor_hdg)
                geo_deb = meters_to_lat_lng(center_lat, center_lng, xc + wxd, yc + wyd, alt=0.0)
                frame_actors.append({
                    "id": "actor_debris",
                    "name": "Collision Debris",
                    "model_src": debris.get("model_src", "/models/prop_debris_cluster.glb"),
                    "category": "prop",
                    "lat": geo_deb["lat"],
                    "lng": geo_deb["lng"],
                    "altitude": 0.1,
                    "heading": round((corridor_hdg + 45.0) % 360.0, 2),
                    "pitch": 0.0,
                    "roll": 0.0,
                    "scale": 1.0
                })

            frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                "pos": {
                    "lat": geo1["lat"],
                    "lng": geo1["lng"],
                    "altitude": 0.1,
                    "altitude_offset": 0.1,
                    "ground_altitude": base_ground_alt
                },
                "heading": round(wh1, 2),
                "pitch": 0.0,
                "roll": 0.0,
                "speed": round(spd1, 2),
                "action": "MULTI_CAR_CRASH" if is_imp1 else "APPROACH",
                "actors": frame_actors
            })

        geo_stage = meters_to_lat_lng(center_lat, center_lng, xc, yc, alt=0.0)
        camera_shots = [
            {"shot_index": 1, "start_time": 0.0, "end_time": 2.0, "angle": "HERO_LOW", "label": "Multi-Ingress Intersection Approach"},
            {"shot_index": 2, "start_time": 2.0, "end_time": 3.6, "angle": "ACTION_CLOSEUP", "label": "Primary T-Bone Collision & Ricochet"},
            {"shot_index": 3, "start_time": 3.6, "end_time": duration_sec, "angle": "DRONE_WIDE", "label": "3-Car Pileup Wreckage Rest"}
        ]

        return {
            "scenario_type": "three_car_crash",
            "title": f"3-Car Pileup: {v1['name']} Crashes into Two Cars",
            "duration_sec": duration_sec,
            "total_frames": len(frames),
            "fps": fps,
            "actors": actors,
            "frames": frames,
            "camera_shots": camera_shots,
            "timeline_events": [
                {"time": 0.0, "label": "3 Vehicles Approach Intersection", "type": "INGRESS"},
                {"time": 2.15, "label": "💥 Impact 1: T-Bone Collision", "type": "IMPACT"},
                {"time": 2.55, "label": "💥 Impact 2: Ricochet Secondary Pileup", "type": "IMPACT"}
            ],
            "waypoints": [
                {"step": 0, "time": 0.0, "action": "START", "name": "Start", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": speed1_init},
                {"step": 1, "time": duration_sec, "action": "REST", "name": "Halt", "lat": geo_stage["lat"], "lng": geo_stage["lng"], "altitude": 0.1, "speed": 0.0}
            ],
            "focal_point": stage_pos
        }

    def plan_screenplay(
        self,
        prompt: str,
        city_id: str = "san_francisco",
        center_lat: float = 37.7952,
        center_lng: float = -122.4028,
        custom_stage_pos: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Main Screenplay Director entrypoint:
        1. Attempts to synthesize a tailored stunt choreography from Groq LLM.
        2. Falls back seamlessly to procedural semantic physics choreographer.
        3. Returns fully verified 60 FPS multi-actor frames, camera shots, and timeline.
        """
        stage_pos = custom_stage_pos or {
            "lat": center_lat,
            "lng": center_lng,
            "altitude": terrain_physics_engine.get_elevation(center_lat, center_lng, city_id)
        }

        # 1. Try Groq AI Stunt Choreographer
        ai_plan = self.call_groq_scene_choreographer(prompt, stage_pos, city_id=city_id)
        if ai_plan:
            try:
                sim_data = self.interpolate_ai_keyframes(
                    ai_plan=ai_plan,
                    center_lat=center_lat,
                    center_lng=center_lng,
                    stage_pos=stage_pos,
                    city_id=city_id,
                    fps=60
                )
                scene_id = f"screenplay_{int(time.time() * 1000)}"
                return {
                    "status": "success",
                    "scene_id": scene_id,
                    "is_screenplay": True,
                    "scenario_type": sim_data["scenario_type"],
                    "title": sim_data["title"],
                    "prompt": prompt,
                    "city_id": city_id,
                    "stage_pos": stage_pos,
                    "duration": sim_data["duration_sec"],
                    "total_duration_sec": sim_data["duration_sec"],
                    "total_frames": sim_data["total_frames"],
                    "fps": sim_data["fps"],
                    "actors": sim_data["actors"],
                    "frames": sim_data["frames"],
                    "waypoints": sim_data["waypoints"],
                    "camera_shots": sim_data["camera_shots"],
                    "timeline_events": sim_data["timeline_events"],
                    "summary": {
                        "scenario_type": sim_data["scenario_type"],
                        "total_actors": len(sim_data["actors"]),
                        "actors_list": [a["name"] for a in sim_data["actors"]],
                        "source": "groq_ai"
                    }
                }
            except Exception as e:
                logger.warning(f"AI keyframe interpolation fallback: {e}")

        # 2. Semantic Procedural Choreographer
        resolution = self.resolve_screenplay_actors(prompt)
        scenario_type = resolution["scenario_type"]
        actors = resolution["actors"]

        if scenario_type == "drone_flight":
            sim_data = self.simulate_drone_flight(
                actor=actors[0],
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 7.0),
                fps=60
            )
        elif scenario_type == "police_pursuit":
            sim_data = self.simulate_police_pursuit(
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 6.5),
                fps=60
            )
        elif scenario_type == "high_speed_drift":
            sim_data = self.simulate_high_speed_drift(
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 6.0),
                fps=60
            )
        elif scenario_type == "head_on_collision":
            sim_data = self.simulate_head_on_collision(
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 6.0),
                fps=60
            )
        elif scenario_type == "truck_barrier_crash":
            sim_data = self.simulate_truck_barrier_crash(
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 6.0),
                fps=60
            )
        elif scenario_type == "three_car_crash":
            sim_data = self.simulate_three_car_crash(
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                stage_pos=stage_pos,
                city_id=city_id,
                duration_sec=resolution.get("duration_sec", 6.0),
                fps=60
            )
        else:
            # Default to 2-car collision
            from backend.simulation.crash_physics import crash_physics_engine
            dx, dy = lat_lng_to_meters(center_lat, center_lng, stage_pos["lat"], stage_pos["lng"])
            corridor_hdg = get_stage_corridor_heading(stage_pos, city_id, is_cross_street=False)
            crash_res = crash_physics_engine.plan_crash_scenario(
                prompt=prompt,
                actors=actors,
                center_lat=center_lat,
                center_lng=center_lng,
                impact_offset=(dx, dy),
                corridor_heading=corridor_hdg,
                duration_sec=6.0,
                fps=60
            )
            sim_data = {
                "scenario_type": "two_car_crash",
                "title": crash_res["title"],
                "duration_sec": crash_res["duration_sec"],
                "total_frames": crash_res["total_frames"],
                "fps": crash_res["fps"],
                "actors": actors,
                "frames": crash_res["frames"],
                "camera_shots": [
                    {"shot_index": 1, "start_time": 0.0, "end_time": 2.0, "angle": "HERO_LOW", "label": "Overhead Approach"},
                    {"shot_index": 2, "start_time": 2.0, "end_time": 3.4, "angle": "ACTION_CLOSEUP", "label": "T-Bone Crash Cut"},
                    {"shot_index": 3, "start_time": 3.4, "end_time": 6.0, "angle": "DRONE_WIDE", "label": "Resting Positions"}
                ],
                "timeline_events": crash_res["timeline_events"],
                "waypoints": [
                    {"step": 0, "time": 0.0, "action": "APPROACH", "name": "Approach", "lat": stage_pos["lat"], "lng": stage_pos["lng"], "altitude": 0.1, "speed": 18.0},
                    {"step": 1, "time": 6.0, "action": "REST", "name": "Rest", "lat": stage_pos["lat"], "lng": stage_pos["lng"], "altitude": 0.1, "speed": 0.0}
                ],
                "focal_point": stage_pos
            }

        scene_id = f"screenplay_{int(time.time() * 1000)}"

        return {
            "status": "success",
            "scene_id": scene_id,
            "is_screenplay": True,
            "scenario_type": sim_data["scenario_type"],
            "title": sim_data["title"],
            "prompt": prompt,
            "city_id": city_id,
            "stage_pos": stage_pos,
            "duration": sim_data["duration_sec"],
            "total_duration_sec": sim_data["duration_sec"],
            "total_frames": sim_data["total_frames"],
            "fps": sim_data["fps"],
            "actors": sim_data["actors"],
            "frames": sim_data["frames"],
            "waypoints": sim_data["waypoints"],
            "camera_shots": sim_data["camera_shots"],
            "timeline_events": sim_data["timeline_events"],
            "summary": {
                "scenario_type": sim_data["scenario_type"],
                "total_actors": len(actors),
                "actors_list": [a["name"] for a in actors],
                "source": "semantic_choreographer"
            }
        }


screenplay_physics_engine = ScreenplayPhysicsEngine()
