"""
RoboTwin AI Scene Director & Urban Humanoid Choreography Engine.
Translates natural language scene descriptions and urban landmarks into fully grounded,
executable 3D humanoid action timelines, trajectory waypoints, and 60 FPS simulation frames.
"""

import os
import math
import time
import json
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

from backend.simulation.terrain_physics import (
    TerrainElevationModel,
    HumanoidBiomechanicalLocomotion,
    terrain_physics_engine,
    biomechanical_locomotion
)
from backend.simulation.sidewalk_navmesh import urban_sidewalk_navmesh
from backend.simulation.asset_catalog import asset_catalog_manager
from backend.simulation.crash_physics import crash_physics_engine
from backend.simulation.camera_director import camera_director
from backend.simulation.screenplay_physics import screenplay_physics_engine

# Geodesic conversion constants
METERS_PER_DEG_LAT = 111320.0

def meters_to_lat_lng(center_lat: float, center_lng: float, dx_meters: float, dy_meters: float, alt: float = 20.0) -> Dict[str, float]:
    """Converts metric offsets (dx = East, dy = North) from origin into GPS coordinates."""
    d_lat = dy_meters / METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    d_lng = dx_meters / (METERS_PER_DEG_LAT * cos_lat)
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

def calculate_heading(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """Calculates compass heading (0 = North, 90 = East, 180 = South, 270 = West) between two GPS points."""
    dy = (p2["lat"] - p1["lat"]) * METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians((p1["lat"] + p2["lat"]) / 2.0)))
    dx = (p2["lng"] - p1["lng"]) * (METERS_PER_DEG_LAT * cos_lat)
    angle_rad = math.atan2(dx, dy)
    deg = math.degrees(angle_rad)
    return round((deg + 360.0) % 360.0, 1)

# Canonical Urban Landmark database for supported cities
CITY_SCENE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "san_francisco": {
        "city_name": "San Francisco, CA (Financial District)",
        "center": {"lat": 37.7952, "lng": -122.4028, "groundAltitude": 20.0},
        "landmarks": [
            {
                "id": "sf_transamerica",
                "name": "Transamerica Pyramid Plaza",
                "category": "skyscraper",
                "dx": 8.0,
                "dy": 80.0,
                "height": 260.0,
                "description": "Iconic futuristic pyramid tower with ground promenade walkway."
            },
            {
                "id": "sf_bofa_555",
                "name": "555 California St (Carnelian Tower)",
                "category": "commercial",
                "dx": 45.0,
                "dy": -36.0,
                "height": 237.0,
                "description": "Dark carnelian granite skyscraper with entrance plaza on California St sidewalk."
            },
            {
                "id": "sf_sansome_475",
                "name": "475 Sansome Street",
                "category": "office",
                "dx": 84.0,
                "dy": 15.0,
                "height": 42.0,
                "description": "Brutalist concrete architecture with sidewalk entrance along Sansome West."
            },
            {
                "id": "sf_bank_405",
                "name": "405 Sansome Historic Bank",
                "category": "bank",
                "dx": 84.0,
                "dy": -25.0,
                "height": 38.5,
                "description": "Classic limestone building with sidewalk threshold facing heavy bronze doors."
            },
            {
                "id": "sf_artisan_cafe",
                "name": "Blue Bottle Artisan Cafe",
                "category": "cafe",
                "dx": -6.0,
                "dy": -25.0,
                "height": 12.0,
                "description": "Corner cafe patio with glass storefront and outdoor sidewalk tables."
            },
            {
                "id": "sf_brick_apartments",
                "name": "Montgomery Brick Lofts",
                "category": "residential",
                "dx": -6.0,
                "dy": 15.0,
                "height": 24.0,
                "description": "Classic San Francisco red brick residential building with sidewalk archway."
            },
            {
                "id": "sf_central_crosswalk",
                "name": "Sansome & California Crosswalk",
                "category": "intersection",
                "dx": 84.0,
                "dy": -10.0,
                "height": 0.0,
                "description": "Major pedestrian signal crossing with textured curb ramps."
            },
            {
                "id": "sf_park_plaza",
                "name": "Redwood Park Sunken Plaza",
                "category": "park",
                "dx": 25.0,
                "dy": 65.0,
                "height": 0.0,
                "description": "Tranquil urban redwood tree grove with stone benches and walkway."
            }
        ]
    },
    "manhattan": {
        "city_name": "New York, NY (Midtown)",
        "center": {"lat": 40.7580, "lng": -73.9855, "groundAltitude": 20.0},
        "landmarks": [
            {
                "id": "ny_empire_state",
                "name": "Empire State Building",
                "category": "skyscraper",
                "dx": 0.0,
                "dy": -150.0,
                "height": 381.0,
                "description": "Art deco landmark with gilded art-deco entrance lobby."
            },
            {
                "id": "ny_broadway_crosswalk",
                "name": "Times Square Pedestrian Plaza",
                "category": "intersection",
                "dx": -30.0,
                "dy": 20.0,
                "height": 0.0,
                "description": "High-traffic neon lit pedestrian avenue with street seating."
            },
            {
                "id": "ny_corner_cafe",
                "name": "Manhattan Roast Cafe",
                "category": "cafe",
                "dx": 40.0,
                "dy": -25.0,
                "height": 14.0,
                "description": "Avenue cafe with outdoor awning and sidewalk seating."
            },
            {
                "id": "ny_glass_tower",
                "name": "Midtown Glass Atrium",
                "category": "office",
                "dx": -60.0,
                "dy": -40.0,
                "height": 160.0,
                "description": "Polished mirrored curtain-wall skyscraper with revolving doors."
            }
        ]
    },
    "chicago": {
        "city_name": "Chicago, IL (The Loop & River)",
        "center": {"lat": 41.8887, "lng": -87.6264, "groundAltitude": 182.0},
        "landmarks": [
            {
                "id": "chi_river_esplanade",
                "name": "Chicago Riverwalk Promenade",
                "category": "park",
                "dx": 0.0,
                "dy": 60.0,
                "height": 0.0,
                "description": "Sunken riverfront promenade with concrete walkways and railings."
            },
            {
                "id": "chi_michigan_ave",
                "name": "Michigan Avenue Bridge",
                "category": "intersection",
                "dx": 45.0,
                "dy": 30.0,
                "height": 0.0,
                "description": "Historic double-deck trunnion bascule bridge."
            },
            {
                "id": "chi_loop_cafe",
                "name": "Loop Coffee Roastery",
                "category": "cafe",
                "dx": -35.0,
                "dy": -20.0,
                "height": 18.0,
                "description": "Artisanal espresso bar on Wacker Drive."
            }
        ]
    },
    "tokyo": {
        "city_name": "Tokyo (Shinjuku Skyline)",
        "center": {"lat": 35.6895, "lng": 139.6917, "groundAltitude": 35.0},
        "landmarks": [
            {
                "id": "tyo_tocho_plaza",
                "name": "Tokyo Metropolitan Government Plaza",
                "category": "skyscraper",
                "dx": 0.0,
                "dy": 80.0,
                "height": 243.0,
                "description": "Grand granite civic plaza connecting twin towers."
            },
            {
                "id": "tyo_shinjuku_crossing",
                "name": "Shinjuku West Scramble Crossing",
                "category": "intersection",
                "dx": 60.0,
                "dy": -40.0,
                "height": 0.0,
                "description": "Dense pedestrian crossing with digital neon signboards."
            },
            {
                "id": "tyo_convenience_store",
                "name": "24/7 Shinjuku Mart",
                "category": "store",
                "dx": -40.0,
                "dy": -15.0,
                "height": 10.0,
                "description": "Bright modern convenience store entrance."
            }
        ]
    }
}

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

def call_groq_choreographer(waypoints_input: List[Dict[str, Any]], city_name: str = "San Francisco") -> Optional[List[Dict[str, Any]]]:
    """
    Calls Groq API (qwen/qwen3.8-27b with openai/gpt-oss-20b fallback) to translate
    user-drawn waypoint locations and text directives into AI-synthesized action states,
    calibrated speeds, physical durations, camera angles, and descriptions.
    """
    if not GROQ_API_KEY:
        return None
    import requests
    models_to_try = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"]

    sys_prompt = """You are an expert AI Robotics Director and Humanoid Choreographer for RoboTwin.
Analyze the user-directed path waypoints on the satellite city map and synthesize a robotics choreography timeline.
For each waypoint in the input list, return a JSON object with:
- step: 0-indexed integer corresponding to the waypoint index
- action: one of ["SPAWN", "WALK", "JOG", "SPRINT", "INSPECT", "SCAN", "LOOK_UP", "CROUCH", "WAVE", "CELEBRATE", "JUMP"]
- speed: realistic velocity in m/s (0.0 for stationary actions, 1.2-1.4 for WALK, 2.4-2.8 for JOG, 4.0-4.5 for SPRINT, 0.8 for STEALTH/INSPECT)
- duration: realistic physical execution time in seconds (e.g. 2.0 to 5.0s, proportional to physical distance if moving)
- camera_angle: one of ["3rd_person", "1st_person_pov", "hero_low", "action_closeup", "drone_wide"] matching the drama of the action
- description: concise, cinematic description of the humanoid robot executing this movement in the environment
Return JSON format: {"steps": [...]}"""

    user_payload = json.dumps({
        "environment": city_name,
        "waypoints": [
            {
                "step": i,
                "lat": float(w.get("lat", 0)),
                "lng": float(w.get("lng", 0)),
                "prompt": (w.get("prompt") or w.get("action") or f"Waypoint {i+1}").strip()
            }
            for i, w in enumerate(waypoints_input)
        ]
    })

    for model_name in models_to_try:
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
                        {"role": "user", "content": user_payload}
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1200,
                    "temperature": 0.4
                },
                timeout=8.0
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["choices"][0]["message"]["content"]
                parsed = json.loads(raw_text)
                steps = parsed.get("steps") or parsed.get("choreography") or parsed.get("waypoints")
                if isinstance(steps, list) and len(steps) > 0:
                    logger.info(f"Groq API ({model_name}) successfully generated choreography for {len(steps)} waypoints")
                    return steps
        except Exception as err:
            logger.warning(f"Groq model {model_name} notice: {err}")
            continue

    return None


class SceneDirector:
    """
    Intelligent Scene Director that translates natural language prompts into
    grounded 3D urban trajectories, actions, camera choreography, and telemetry.
    """

    def __init__(self):
        pass

    def get_city_landmarks(self, city_id: str, center_lat: float, center_lng: float) -> List[Dict[str, Any]]:
        """Returns fully positioned 3D landmarks for the given city."""
        reg = CITY_SCENE_REGISTRY.get(city_id, CITY_SCENE_REGISTRY["san_francisco"])
        base_alt = reg["center"].get("groundAltitude", 20.0)
        landmarks = []
        for lm in reg["landmarks"]:
            pos = meters_to_lat_lng(center_lat, center_lng, lm["dx"], lm["dy"], base_alt)
            # Sample continuous topographic ground elevation for each urban landmark
            ground_elev = terrain_physics_engine.get_elevation(pos["lat"], pos["lng"], city_id)
            landmarks.append({
                "id": lm["id"],
                "name": lm["name"],
                "category": lm["category"],
                "description": lm["description"],
                "lat": pos["lat"],
                "lng": pos["lng"],
                "altitude": ground_elev,
                "height": lm.get("height", 20.0),
                "dx": lm["dx"],
                "dy": lm["dy"]
            })
        return landmarks

    def find_matching_landmark(self, text: str, landmarks: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Matches landmarks based on name, category, or semantic keyword."""
        q = text.lower()
        for lm in landmarks:
            name_lower = lm["name"].lower()
            cat_lower = lm["category"].lower()
            # Direct match
            if lm["id"] in q or cat_lower in q or any(part in q for part in name_lower.split()):
                return lm
            # Synonyms
            if ("cafe" in q or "coffee" in q or "restaurant" in q or "food" in q) and "cafe" in cat_lower:
                return lm
            if ("crosswalk" in q or "intersection" in q or "street" in q or "road" in q) and "intersection" in cat_lower:
                return lm
            if ("apartment" in q or "brick" in q or "lofts" in q or "house" in q or "residential" in q) and "residential" in cat_lower:
                return lm
            if ("bank" in q or "bofa" in q or "vault" in q or "limestone" in q) and "bank" in cat_lower:
                return lm
            if ("pyramid" in q or "transamerica" in q or "spire" in q or "tower" in q) and ("skyscraper" in cat_lower or "pyramid" in name_lower):
                return lm
            if ("park" in q or "trees" in q or "plaza" in q or "bench" in q) and "park" in cat_lower:
                return lm
        return None

    def plan_scene_from_prompt(
        self,
        prompt: str,
        city_id: str = "san_francisco",
        center_lat: float = 37.7952,
        center_lng: float = -122.4028,
        custom_spawn: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Main AI Scene Director pipeline.
        Deconstructs prompt into structured scene waypoints, timings, actions,
        interpolated 60 FPS frames, and camera choreography.
        """
        landmarks = self.get_city_landmarks(city_id, center_lat, center_lng)
        p_lower = prompt.lower().strip()
        reg = CITY_SCENE_REGISTRY.get(city_id, CITY_SCENE_REGISTRY["san_francisco"])
        base_alt = reg["center"].get("groundAltitude", 20.0)

        # Detect if prompt is a vehicular collision / stunt scene
        is_vehicular = any(k in p_lower for k in [
            "crash", "car crash", "collision", "accident", "t-bone", "hit each other",
            "rear-end", "head-on", "smash", "vehicular", "police chase", "speeding car",
            "car", "suv", "truck", "automobile", "drift"
        ]) and not any(k in p_lower for k in ["humanoid robot", "biped", "robot starts near", "walks to the brick", "humanoid"])

        if is_vehicular:
            return self.plan_vehicular_crash_scene(
                prompt=prompt,
                city_id=city_id,
                center_lat=center_lat,
                center_lng=center_lng,
                custom_spawn=custom_spawn
            )

        # 1. Determine Starting / Spawn Location
        start_landmark = None
        if "start" in p_lower or "spawn" in p_lower or "from" in p_lower or "at" in p_lower:
            start_landmark = self.find_matching_landmark(p_lower, landmarks)

        if not start_landmark and landmarks:
            start_landmark = landmarks[4] if len(landmarks) > 4 else landmarks[0]  # Default to cafe or first

        if custom_spawn:
            # Snap custom spawn to nearest certified sidewalk node
            cs_dx, cs_dy = lat_lng_to_meters(center_lat, center_lng, custom_spawn["lat"], custom_spawn["lng"])
            snapped = urban_sidewalk_navmesh.snap_to_nearest_sidewalk(cs_dx, cs_dy, city_id)
            snapped_geo = meters_to_lat_lng(center_lat, center_lng, snapped["x"], snapped["y"], base_alt)
            start_pos = {
                "lat": snapped_geo["lat"],
                "lng": snapped_geo["lng"],
                "altitude": snapped_geo["altitude"]
            }
            start_name = f"Sidewalk: {snapped['name']}"
        elif start_landmark:
            start_pos = {"lat": start_landmark["lat"], "lng": start_landmark["lng"], "altitude": start_landmark["altitude"]}
            start_name = start_landmark["name"]
        else:
            start_pos = {"lat": center_lat, "lng": center_lng, "altitude": base_alt}
            start_name = "City Center Origin"

        # 2. Extract Destination Targets and Action Directives
        # Parse actions mentioned in user description
        has_walk = any(w in p_lower for w in ["walk", "patrol", "go", "move", "transit", "navigate", "travel", "head to"])
        has_jog = any(w in p_lower for w in ["jog", "run", "hurry", "sprint", "fast"])
        has_inspect = any(w in p_lower for w in ["inspect", "check", "examine", "door", "entrance", "investigate", "look closely"])
        has_scan = any(w in p_lower for w in ["look around", "looks around", "looking around", "scan", "survey", "perim", "search", "security", "threat"])
        has_wave = any(w in p_lower for w in ["wave", "signal", "greet", "hello", "hi", "gesture"])
        has_point = any(w in p_lower for w in ["point", "indicate", "aim", "direct"])
        has_celebrate = any(w in p_lower for w in ["celebrate", "cheer", "victory", "success", "cheers"])

        # Default action sequence if user provided a brief description
        if not (has_walk or has_jog or has_inspect or has_scan or has_wave or has_point or has_celebrate):
            has_walk = True
            has_inspect = True
            has_scan = True
            has_wave = True

        # Find target destinations (different from start)
        dest_candidates = [lm for lm in landmarks if start_landmark and lm["id"] != start_landmark["id"]]
        if not dest_candidates:
            dest_candidates = landmarks

        # Try to find target landmark from prompt text
        target_landmark = None
        for lm in dest_candidates:
            if lm["name"].lower() in p_lower or lm["category"] in p_lower:
                target_landmark = lm
                break

        if not target_landmark and dest_candidates:
            # Pick a natural urban destination (e.g. brick apartments or bank)
            target_landmark = dest_candidates[0]

        # 3. Build Ordered Waypoints Timeline
        waypoints: List[Dict[str, Any]] = []
        cur_pos = dict(start_pos)
        cur_time = 0.0

        # Waypoint 0: Spawn & Drop onto Sidewalk
        waypoints.append({
            "step": 0,
            "action": "SPAWN",
            "name": f"Spawn & Drop at {start_name}",
            "lat": cur_pos["lat"],
            "lng": cur_pos["lng"],
            "altitude": cur_pos["altitude"],
            "heading": 45.0,
            "duration": 2.0,
            "speed": 0.0,
            "description": f"Humanoid robot drops onto sidewalk pavement, absorbs landing kinetic shock with compliant knee dampening, and stabilizes postural balance at {start_name}."
        })
        cur_time += 2.0

        # Waypoint 1+: Locomotion strictly along sidewalk corridors avoiding buildings
        if target_landmark:
            dx1, dy1 = lat_lng_to_meters(center_lat, center_lng, cur_pos["lat"], cur_pos["lng"])
            dx2, dy2 = lat_lng_to_meters(center_lat, center_lng, target_landmark["lat"], target_landmark["lng"])

            # Compute collision-free sidewalk corridor path via NavMesh
            sidewalk_nodes = urban_sidewalk_navmesh.plan_sidewalk_path(dx1, dy1, dx2, dy2, city_id)
            gait = "JOG" if has_jog else "WALK"
            speed = 2.4 if has_jog else 1.3

            # Add each path step along the sidewalk corridor
            for node_idx, s_node in enumerate(sidewalk_nodes[1:], start=1):
                node_pos = meters_to_lat_lng(center_lat, center_lng, s_node["x"], s_node["y"], base_alt)
                seg_head = calculate_heading(cur_pos, node_pos)
                seg_dist = math.hypot(s_node["x"] - dx1, s_node["y"] - dy1)
                seg_dur = max(2.5, round(max(2.0, seg_dist) / speed, 1))

                is_last_node = (node_idx == len(sidewalk_nodes) - 1)
                if is_last_node:
                    wp_name = f"Arrive at {target_landmark['name']}"
                    wp_desc = f"Approaches street-facing entrance of {target_landmark['name']} on the sidewalk."
                else:
                    wp_name = f"Sidewalk: {s_node['name'].split(' ')[0]}"
                    wp_desc = f"Navigates along {s_node['name']} conforming to pedestrian street corridor."

                waypoints.append({
                    "step": len(waypoints),
                    "action": gait,
                    "name": wp_name,
                    "lat": node_pos["lat"],
                    "lng": node_pos["lng"],
                    "altitude": node_pos["altitude"],
                    "heading": seg_head,
                    "duration": seg_dur,
                    "speed": speed,
                    "description": wp_desc
                })
                cur_time += seg_dur
                cur_pos = dict(node_pos)
                dx1, dy1 = s_node["x"], s_node["y"]

            if len(waypoints) == 1:
                # Direct step to target landmark
                dest_pos = meters_to_lat_lng(center_lat, center_lng, dx2, dy2, base_alt)
                seg_head = calculate_heading(cur_pos, dest_pos)
                seg_dist = math.hypot(dx2 - dx1, dy2 - dy1)
                seg_dur = max(3.0, round(max(3.0, seg_dist) / speed, 1))
                waypoints.append({
                    "step": 1,
                    "action": gait,
                    "name": f"Arrive at {target_landmark['name']}",
                    "lat": dest_pos["lat"],
                    "lng": dest_pos["lng"],
                    "altitude": dest_pos["altitude"],
                    "heading": seg_head,
                    "duration": seg_dur,
                    "speed": speed,
                    "description": f"Approaches entrance threshold of {target_landmark['name']} on the sidewalk."
                })
                cur_time += seg_dur
                cur_pos = dict(dest_pos)

        # Waypoint 3: Inspection Action
        if has_inspect:
            waypoints.append({
                "step": len(waypoints),
                "action": "INSPECT",
                "name": "Doorway & Entrance Inspection",
                "lat": cur_pos["lat"],
                "lng": cur_pos["lng"],
                "altitude": cur_pos["altitude"],
                "heading": round((waypoints[-1]["heading"] + 35) % 360, 1),
                "duration": 4.0,
                "speed": 0.0,
                "description": "Crouches down, activating optical sensors to inspect ground entryway and latch."
            })
            cur_time += 4.0

        # Waypoint 4: Scan / Perimeter Look Around
        if has_scan:
            waypoints.append({
                "step": len(waypoints),
                "action": "SCAN",
                "name": "360° Perimeter Security Scan",
                "lat": cur_pos["lat"],
                "lng": cur_pos["lng"],
                "altitude": cur_pos["altitude"],
                "heading": round((waypoints[-1]["heading"] + 180) % 360, 1),
                "duration": 3.5,
                "speed": 0.0,
                "description": "Stands erect and slowly swivels head sensors 360 degrees to verify area safety."
            })
            cur_time += 3.5

        # Waypoint 5: Wave to Camera / Drone
        if has_wave:
            waypoints.append({
                "step": len(waypoints),
                "action": "WAVE",
                "name": "Acknowledge Drone Camera",
                "lat": cur_pos["lat"],
                "lng": cur_pos["lng"],
                "altitude": cur_pos["altitude"],
                "heading": round((waypoints[-1]["heading"] + 45) % 360, 1),
                "duration": 3.0,
                "speed": 0.0,
                "description": "Raises right forearm, waves palm to aerial monitoring drone, signaling task completion."
            })
            cur_time += 3.0

        # Waypoint 6: Celebrate / Victory
        if has_celebrate:
            waypoints.append({
                "step": len(waypoints),
                "action": "CELEBRATE",
                "name": "Mission Accomplished Celebration",
                "lat": cur_pos["lat"],
                "lng": cur_pos["lng"],
                "altitude": cur_pos["altitude"],
                "heading": waypoints[-1]["heading"],
                "duration": 3.0,
                "speed": 0.0,
                "description": "Raises both arms in celebratory victory gesture."
            })
            cur_time += 3.0

        # 4. Synthesize Multi-Angle Camera Shots (Hollywood Director Shot List)
        camera_shots = self.synthesize_camera_shots(waypoints)

        # 5. Synthesize 60 FPS Simulation Timeline Frames with Biomechanical Locomotion & Terrain Physics
        frames = self._interpolate_scene_frames(waypoints, center_lat, center_lng, base_alt, fps=60, camera_shots=camera_shots, city_id=city_id)

        scene_title = self._generate_scene_title(prompt, start_name, target_landmark["name"] if target_landmark else "Downtown")

        return {
            "status": "success",
            "scene_id": f"scene_{int(time.time() * 1000)}",
            "title": scene_title,
            "prompt": prompt,
            "city_id": city_id,
            "city_name": reg["city_name"],
            "center": {"lat": center_lat, "lng": center_lng, "altitude": base_alt},
            "total_duration_sec": round(cur_time, 2),
            "duration": round(cur_time, 2),
            "total_frames": len(frames),
            "fps": 60,
            "waypoints": waypoints,
            "landmarks": landmarks,
            "camera_shots": camera_shots,
            "frames": frames,
            "summary": {
                "start_location": start_name,
                "destination": target_landmark["name"] if target_landmark else "Plaza",
                "total_actions": len(waypoints),
                "actions_list": [wp["action"] for wp in waypoints],
                "total_camera_shots": len(camera_shots)
            }
        }

    def plan_vehicular_crash_scene(
        self,
        prompt: str,
        city_id: str = "san_francisco",
        center_lat: float = 37.7952,
        center_lng: float = -122.4028,
        custom_spawn: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Plans a dynamic multi-vehicle crash or chase scene with physical rigid-body collisions,
        plastic deformation, debris scatter, and multi-angle cinematic director cameras.
        """
        landmarks = self.get_city_landmarks(city_id, center_lat, center_lng)
        reg = CITY_SCENE_REGISTRY.get(city_id, CITY_SCENE_REGISTRY["san_francisco"])
        base_alt = reg["center"].get("groundAltitude", 20.0)

        # Impact location: custom spawn or nearest intersection landmark
        impact_offset = (0.0, 0.0)
        target_name = "Downtown Intersection"
        if custom_spawn:
            dx, dy = lat_lng_to_meters(center_lat, center_lng, custom_spawn["lat"], custom_spawn["lng"])
            impact_offset = (dx, dy)
            target_name = f"Coordinate ({custom_spawn['lat']:.4f}, {custom_spawn['lng']:.4f})"
        else:
            intersection_lms = [lm for lm in landmarks if lm.get("category") == "intersection"]
            if intersection_lms:
                lm = intersection_lms[0]
                impact_offset = (lm["dx"], lm["dy"])
                target_name = lm["name"]

        # Resolve participating actors
        actors = asset_catalog_manager.resolve_actors_for_scene(prompt)

        # Run Newtonian crash simulation
        crash_res = crash_physics_engine.plan_crash_scenario(
            prompt=prompt,
            actors=actors,
            center_lat=center_lat,
            center_lng=center_lng,
            impact_offset=impact_offset,
            duration_sec=6.0,
            fps=60
        )

        impact_coords = crash_res["impact_coords"]

        # Hollywood multi-angle camera shots
        camera_shots = [
            {
                "shot_index": 1,
                "start_time": 0.0,
                "end_time": 2.0,
                "angle": "DRONE_WIDE",
                "label": "Overhead Drone Approach",
                "focal_point": impact_coords,
                "description": "High altitude satellite surveillance tracking speeding approach to intersection."
            },
            {
                "shot_index": 2,
                "start_time": 2.0,
                "end_time": 3.2,
                "angle": "ACTION_CLOSEUP",
                "label": "Impact Collision Cut",
                "focal_point": impact_coords,
                "description": "Ground-level high-speed impact closeup capturing metal deformation and kinetic shock."
            },
            {
                "shot_index": 3,
                "start_time": 3.2,
                "end_time": 4.8,
                "angle": "HERO_LOW",
                "label": "Tire Skid & Spinout",
                "focal_point": impact_coords,
                "description": "Low curb tracking shot framing rotational vehicle spin and smoke plume."
            },
            {
                "shot_index": 4,
                "start_time": 4.8,
                "end_time": 6.0,
                "angle": "3RD_PERSON",
                "label": "Rest & Debris Aftermath",
                "focal_point": impact_coords,
                "description": "Slow crane pullback surveying vehicle rest positions and scattered debris field."
            }
        ]

        # Convert timeline events into waypoints format for unified player compatibility
        waypoints = []
        for i, ev in enumerate(crash_res["timeline_events"]):
            waypoints.append({
                "step": i,
                "time": ev["time"],
                "action": ev["type"],
                "name": ev["label"],
                "lat": impact_coords["lat"],
                "lng": impact_coords["lng"],
                "altitude": impact_coords["altitude"],
                "duration": 1.5,
                "speed": 18.0 if i == 0 else 0.0,
                "description": f"Vehicular stunt milestone: {ev['label']}"
            })

        scene_id = f"scene_{int(time.time() * 1000)}"
        return {
            "status": "success",
            "scene_id": scene_id,
            "scene_type": "vehicular_collision",
            "crash_type": crash_res["crash_type"],
            "title": f"Stunt Scene: {crash_res['title']}",
            "prompt": prompt,
            "city_id": city_id,
            "city_name": reg["city_name"],
            "center": {"lat": center_lat, "lng": center_lng, "altitude": base_alt},
            "total_duration_sec": crash_res["duration_sec"],
            "duration": crash_res["duration_sec"],
            "total_frames": crash_res["total_frames"],
            "fps": crash_res["fps"],
            "impact_time": crash_res["impact_time"],
            "impact_coords": impact_coords,
            "actors": crash_res["actors"],
            "waypoints": waypoints,
            "camera_shots": camera_shots,
            "frames": crash_res["frames"],
            "timeline_events": crash_res["timeline_events"],
            "summary": {
                "scene_type": "vehicular_collision",
                "target_location": target_name,
                "total_actors": len(actors),
                "actors_list": [a["name"] for a in actors],
                "impact_timestamp": crash_res["impact_time"],
                "total_camera_shots": len(camera_shots)
            }
        }

    def plan_scene_from_custom_directed_path(
        self,
        waypoints_input: List[Dict[str, Any]],
        city_id: str = "san_francisco",
        center_lat: float = 37.7952,
        center_lng: float = -122.4028
    ) -> Dict[str, Any]:
        """
        Directs a 3D scene directly from user-drawn path waypoints and custom natural language prompts.
        Translates each waypoint's prompt into action states, speeds, kinematic profiles,
        and generates the full 60 FPS trajectory with multi-angle cinematic shots.
        """
        if not waypoints_input:
            raise ValueError("Direct path waypoints list cannot be empty")

        reg = CITY_SCENE_REGISTRY.get(city_id, CITY_SCENE_REGISTRY["san_francisco"])
        base_alt = reg["center"].get("groundAltitude", 20.0)
        landmarks = self.get_city_landmarks(city_id, center_lat, center_lng)

        # Call Groq API for intelligent robotic choreography
        groq_steps = call_groq_choreographer(waypoints_input, reg["city_name"])
        groq_by_step = {}
        if groq_steps:
            for s in groq_steps:
                if isinstance(s, dict) and "step" in s:
                    groq_by_step[int(s["step"])] = s

        compiled_waypoints: List[Dict[str, Any]] = []
        cur_time = 0.0

        for idx, wp in enumerate(waypoints_input):
            raw_prompt_text = (wp.get("prompt") or "").strip()
            prompt = raw_prompt_text.lower()
            lat = float(wp["lat"])
            lng = float(wp["lng"])

            # Ground elevation lookup
            ground_z = terrain_physics_engine.get_elevation(lat, lng, city_id)

            # Check if Groq synthesized this step
            groq_step = groq_by_step.get(idx)

            action = None
            speed = 1.3
            duration = 3.0
            camera_angle = "3rd_person"
            description = raw_prompt_text

            # CRITICAL FIX: Direct action matching from prompt or explicit user selection
            user_action = (wp.get("action") or "").upper()
            prompt_action = None
            if prompt:
                if any(w in prompt for w in ["wave", "greet", "hello", "hi", "signal", "gesture", "salute", "hail"]):
                    prompt_action = "WAVE"
                elif any(w in prompt for w in ["celebrate", "cheer", "victory", "success", "triumph", "flex", "arms up"]):
                    prompt_action = "CELEBRATE"
                elif any(w in prompt for w in ["drop", "land", "spawn", "fall", "touchdown", "descend", "appear", "arrive"]):
                    prompt_action = "SPAWN"
                elif any(w in prompt for w in ["look up", "gaze", "sky", "skyscraper", "tall building", "roof", "clouds"]):
                    prompt_action = "LOOK_UP"
                elif any(w in prompt for w in ["inspect", "examine", "latch", "door", "entrance", "investigate", "check"]):
                    prompt_action = "INSPECT"
                elif any(w in prompt for w in ["scan", "look around", "survey", "perim", "search", "security", "threat", "360"]):
                    prompt_action = "SCAN"
                elif any(w in prompt for w in ["crouch", "duck", "kneel", "stoop", "bend down", "low"]):
                    prompt_action = "CROUCH"
                elif any(w in prompt for w in ["jog", "run", "sprint", "fast", "hurry", "dash"]):
                    prompt_action = "JOG"
                elif any(w in prompt for w in ["walk", "patrol", "stride", "navigate", "go", "march", "move", "stroll", "advance"]):
                    prompt_action = "WALK"
                elif raw_prompt_text:
                    # Support ANY arbitrary custom action prompt!
                    words = [w.upper() for w in raw_prompt_text.split() if w.lower() not in ("a", "the", "an", "to", "at", "in", "on", "and", "of", "with")]
                    prompt_action = words[0] if words else "ACTION"

            # Prompt action takes strict precedence over stale default 'WALK'
            if prompt_action:
                action = prompt_action
            elif user_action in ("SPAWN", "WALK", "JOG", "SPRINT", "INSPECT", "SCAN", "LOOK_UP", "CROUCH", "WAVE", "CELEBRATE", "JUMP"):
                action = user_action
            elif groq_step:
                action = str(groq_step.get("action", "")).upper()
            else:
                action = "SPAWN" if idx == 0 else "WALK"

            # Auto-align camera angle to match dramatic choreography of the action
            if action == "WAVE":
                camera_angle = "action_closeup"
            elif action == "CELEBRATE":
                camera_angle = "hero_low"
            elif action == "INSPECT":
                camera_angle = "action_closeup"
            elif action == "SCAN":
                camera_angle = "first_person_pov"
            elif action == "SPAWN":
                camera_angle = "drone_wide"
            elif not camera_angle:
                camera_angle = "3rd_person"

            # Compute heading
            heading = float(wp.get("heading", 0.0))
            if idx + 1 < len(waypoints_input):
                next_wp = waypoints_input[idx + 1]
                heading = calculate_heading({"lat": lat, "lng": lng}, {"lat": float(next_wp["lat"]), "lng": float(next_wp["lng"])})
            elif idx > 0 and compiled_waypoints:
                heading = compiled_waypoints[-1]["heading"]

            # Physical speed and distance-based duration calculation
            # Brisk, responsive transit so movement along the set is energetic and immediately visible
            if idx + 1 < len(waypoints_input):
                next_wp = waypoints_input[idx + 1]
                dist_m = math.hypot(
                    (float(next_wp["lat"]) - lat) * METERS_PER_DEG_LAT,
                    (float(next_wp["lng"]) - lng) * (METERS_PER_DEG_LAT * math.cos(math.radians(lat)))
                )
                target_speed = speed if speed > 0 else (3.2 if action in ("JOG", "RUN", "SPRINT") else 2.2)
                transit_dur = min(8.0, max(2.5, round(dist_m / target_speed, 1))) if dist_m > 2.0 else 0.0

                if action in ("WALK", "JOG", "SPRINT", "RUN", "PATROL"):
                    duration = max(2.5, transit_dur)
                elif action in ("SPAWN", "DROP"):
                    duration = 2.0 + transit_dur
                elif action in ("WAVE", "CELEBRATE", "CROUCH"):
                    duration = 3.0 + transit_dur
                elif action in ("INSPECT", "SCAN"):
                    duration = 3.0 + transit_dur
                else:
                    duration = 2.5 + transit_dur
            else:
                if action in ("SPAWN", "DROP"):
                    speed = 0.0
                    duration = 2.0
                elif action in ("INSPECT", "SCAN"):
                    speed = 0.0
                    duration = max(2.5, float(wp.get("duration", 3.5)))
                elif action in ("WAVE", "CELEBRATE", "CROUCH"):
                    speed = 0.0
                    duration = max(2.0, float(wp.get("duration", 3.0)))
                else:
                    speed = 0.0
                    duration = 2.5

            if not description:
                description = raw_prompt_text or f"{action.capitalize()} directive at waypoint {idx + 1}"

            compiled_waypoints.append({
                "step": idx,
                "action": action,
                "name": f"Step {idx + 1}: {action.capitalize()}",
                "lat": lat,
                "lng": lng,
                "altitude": ground_z,
                "heading": heading,
                "duration": duration,
                "speed": speed,
                "camera_angle": camera_angle,
                "description": description,
                "user_prompt": raw_prompt_text or description
            })
            cur_time += duration

        # Synthesize multi-angle camera shots
        camera_shots = self.synthesize_camera_shots(compiled_waypoints)

        # Synthesize dense 60 FPS trajectory frames with joint kinematics and physics
        frames = self._interpolate_scene_frames(
            waypoints=compiled_waypoints,
            center_lat=center_lat,
            center_lng=center_lng,
            base_alt=base_alt,
            fps=60,
            camera_shots=camera_shots,
            city_id=city_id
        )

        scene_title = f"Directed Scene: {len(compiled_waypoints)} Waypoint Mission"

        return {
            "status": "success",
            "scene_id": f"directed_scene_{int(time.time() * 1000)}",
            "title": scene_title,
            "city_id": city_id,
            "city_name": reg["city_name"],
            "center": {"lat": center_lat, "lng": center_lng, "altitude": base_alt},
            "total_duration_sec": round(cur_time, 2),
            "duration": round(cur_time, 2),
            "total_frames": len(frames),
            "fps": 60,
            "waypoints": compiled_waypoints,
            "landmarks": landmarks,
            "camera_shots": camera_shots,
            "frames": frames,
            "summary": {
                "start_location": f"Waypoint 1 ({compiled_waypoints[0]['action']})",
                "destination": f"Waypoint {len(compiled_waypoints)} ({compiled_waypoints[-1]['action']})",
                "total_actions": len(compiled_waypoints),
                "actions_list": [wp["action"] for wp in compiled_waypoints],
                "total_camera_shots": len(camera_shots)
            },
            "json_protocol": {
                "input_waypoints": waypoints_input,
                "compiled_timeline": [
                    {
                        "step": wp["step"],
                        "action": wp["action"],
                        "prompt": wp["description"],
                        "speed_mps": wp["speed"],
                        "duration_sec": wp["duration"],
                        "coordinates": {"lat": wp["lat"], "lng": wp["lng"], "altitude": wp["altitude"]}
                    }
                    for wp in compiled_waypoints
                ],
                "execution_engine": "60FPS_LIPM_BIOMECHANICAL_KINEMATICS",
                "active_joints_count": 16,
                "telemetry_stream_ready": True
            }
        }

    def _generate_scene_title(self, prompt: str, start: str, dest: str) -> str:
        words = [w.capitalize() for w in prompt.strip().split()[:5]]
        if len(words) >= 3:
            return " ".join(words)
        return f"Autonomous Mission: {start} to {dest}"

    def synthesize_camera_shots(self, waypoints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Synthesizes an intelligent, multi-angle cinematic shot list.
        Stitches establishing wide shots, third-person tracking, low-angle hero shots,
        close-up action framings, first-person robot optical POVs, and orbital sweeps.
        """
        shots: List[Dict[str, Any]] = []
        cur_t = 0.0

        for idx, wp in enumerate(waypoints):
            action = wp["action"]
            duration = max(0.1, wp.get("duration", 2.0))
            start_t = cur_t
            end_t = cur_t + duration

            if action == "SPAWN":
                # High street-level corridor jib: elevated along street canyon, NEVER occluded by building rooftops
                shots.append({
                    "shot_index": len(shots),
                    "angle": "DRONE_WIDE",
                    "label": "Street Corridor Jib",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "High crane shot looking along the urban corridor framing the awakening humanoid without rooftop occlusion.",
                    "camera_config": {
                        "range": 21.0,
                        "tilt": 58.0,
                        "height_offset": 6.5,
                        "heading_offset": 0.0,
                        "mode": "DRONE_WIDE"
                    }
                })

            elif action in ("WALK", "JOG"):
                # If locomotion is long, subdivide into multiple dynamic cinematic cuts!
                if duration > 10.0:
                    split_1 = start_t + (duration * 0.42)
                    split_2 = start_t + (duration * 0.78)

                    # Shot A: Third Person Chase / Over The Shoulder
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "THIRD_PERSON_CHASE",
                        "label": "3rd Person Tracking",
                        "start_time": round(start_t, 2),
                        "end_time": round(split_1, 2),
                        "duration": round(split_1 - start_t, 2),
                        "target_action": action,
                        "description": "Over-the-shoulder tracking shot following humanoid transit down the pedestrian sidewalk.",
                        "camera_config": {
                            "range": 17.0,
                            "tilt": 66.0,
                            "height_offset": 3.6,
                            "heading_offset": 0.0,
                            "mode": "THIRD_PERSON_CHASE"
                        }
                    })

                    # Shot B: Hero 3/4 Follow
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "HERO_FOLLOW",
                        "label": "Hero 3/4 Follow",
                        "start_time": round(split_1, 2),
                        "end_time": round(split_2, 2),
                        "duration": round(split_2 - split_1, 2),
                        "target_action": action,
                        "description": "High 3/4 hero angle framing humanoid transit against the city skyline.",
                        "camera_config": {
                            "range": 17.0,
                            "tilt": 62.0,
                            "height_offset": 3.2,
                            "heading_offset": -22.0,
                            "mode": "HERO_FOLLOW"
                        }
                    })

                    # Shot C: Side Profile Dolly
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "SIDE_DOLLY",
                        "label": "Side Dolly Tracking",
                        "start_time": round(split_2, 2),
                        "end_time": round(end_t, 2),
                        "duration": round(end_t - split_2, 2),
                        "target_action": action,
                        "description": "Parallel sidewalk tracking dolly within roadway clearance.",
                        "camera_config": {
                            "range": 15.0,
                            "tilt": 62.0,
                            "height_offset": 3.0,
                            "heading_offset": 38.0,
                            "mode": "SIDE_DOLLY"
                        }
                    })

                elif duration > 5.0:
                    mid_t = start_t + (duration * 0.55)
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "THIRD_PERSON_CHASE",
                        "label": "3rd Person Tracking",
                        "start_time": round(start_t, 2),
                        "end_time": round(mid_t, 2),
                        "duration": round(mid_t - start_t, 2),
                        "target_action": action,
                        "description": "Over-the-shoulder tracking shot along sidewalk.",
                        "camera_config": {
                            "range": 17.0,
                            "tilt": 66.0,
                            "height_offset": 3.6,
                            "heading_offset": 0.0,
                            "mode": "THIRD_PERSON_CHASE"
                        }
                    })
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "HERO_FOLLOW",
                        "label": "Hero 3/4 Follow",
                        "start_time": round(mid_t, 2),
                        "end_time": round(end_t, 2),
                        "duration": round(end_t - mid_t, 2),
                        "target_action": action,
                        "description": "Hero angle framing approaching robot against urban canyon architecture.",
                        "camera_config": {
                            "range": 17.0,
                            "tilt": 62.0,
                            "height_offset": 3.2,
                            "heading_offset": -20.0,
                            "mode": "HERO_FOLLOW"
                        }
                    })

                else:
                    shots.append({
                        "shot_index": len(shots),
                        "angle": "THIRD_PERSON_CHASE",
                        "label": "3rd Person Tracking",
                        "start_time": round(start_t, 2),
                        "end_time": round(end_t, 2),
                        "duration": round(duration, 2),
                        "target_action": action,
                        "description": "Medium chase tracking shot.",
                        "camera_config": {
                            "range": 17.0,
                            "tilt": 66.0,
                            "height_offset": 3.6,
                            "heading_offset": 0.0,
                            "mode": "THIRD_PERSON_CHASE"
                        }
                    })

            elif action == "INSPECT":
                # Medium action profile framing on crouching robot inspecting building entrance
                shots.append({
                    "shot_index": len(shots),
                    "angle": "ACTION_CLOSEUP",
                    "label": "Action Medium Profile",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Cinematic 3/4 framing capturing robot inspecting building entrance.",
                    "camera_config": {
                        "range": 13.0,
                        "tilt": 60.0,
                        "height_offset": 2.8,
                        "heading_offset": 25.0,
                        "mode": "ACTION_CLOSEUP"
                    }
                })

            elif action == "SCAN":
                # Elevated Forward Sensor POV: cinematic reverse tracking showing robot and avenue ahead without ground clipping
                shots.append({
                    "shot_index": len(shots),
                    "angle": "FIRST_PERSON_POV",
                    "label": "Sensor Forward POV",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Forward tracking shot capturing humanoid surveying the urban environment.",
                    "camera_config": {
                        "range": 16.0,
                        "tilt": 64.0,
                        "height_offset": 3.2,
                        "heading_offset": 180.0,
                        "mode": "FIRST_PERSON_POV"
                    }
                })

            elif action == "WAVE":
                # Front action framing capturing the robot waving to the camera
                shots.append({
                    "shot_index": len(shots),
                    "angle": "ACTION_CLOSEUP",
                    "label": "Action Medium Profile",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Cinematic front angle capturing robot gesturing and waving to camera.",
                    "camera_config": {
                        "range": 15.0,
                        "tilt": 62.0,
                        "height_offset": 3.0,
                        "heading_offset": 165.0,
                        "mode": "ACTION_CLOSEUP"
                    }
                })

            elif action == "CELEBRATE":
                shots.append({
                    "shot_index": len(shots),
                    "angle": "HERO_FOLLOW",
                    "label": "Hero Victory Framing",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Dramatic hero angle of triumphant robot with arms raised high.",
                    "camera_config": {
                        "range": 17.0,
                        "tilt": 62.0,
                        "height_offset": 3.2,
                        "heading_offset": -20.0,
                        "mode": "HERO_FOLLOW"
                    }
                })

            elif action == "CROUCH":
                shots.append({
                    "shot_index": len(shots),
                    "angle": "ACTION_CLOSEUP",
                    "label": "Action Close-Up",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Close-up macro framing on crouching robot examining street surface.",
                    "camera_config": {
                        "range": 12.0,
                        "tilt": 60.0,
                        "height_offset": 2.5,
                        "heading_offset": 20.0,
                        "mode": "ACTION_CLOSEUP"
                    }
                })

            elif action == "LOOK_UP":
                shots.append({
                    "shot_index": len(shots),
                    "angle": "HERO_LOW_ANGLE",
                    "label": "Hero Low Angle",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": "Dramatic hero low angle looking up at skyscrapers along robot's upward gaze.",
                    "camera_config": {
                        "range": 16.0,
                        "tilt": 65.0,
                        "height_offset": 2.8,
                        "heading_offset": -15.0,
                        "mode": "HERO_LOW_ANGLE"
                    }
                })

            else:
                shots.append({
                    "shot_index": len(shots),
                    "angle": "THIRD_PERSON_CHASE",
                    "label": "3rd Person Tracking",
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "duration": round(duration, 2),
                    "target_action": action,
                    "description": f"Standard tracking angle for {action}.",
                    "camera_config": {
                        "range": 17.0,
                        "tilt": 66.0,
                        "height_offset": 3.6,
                        "heading_offset": 0.0,
                        "mode": "THIRD_PERSON_CHASE"
                    }
                })

            cur_t = end_t

        return shots

    def _interpolate_scene_frames(
        self,
        waypoints: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        base_alt: float,
        fps: int = 60,
        camera_shots: Optional[List[Dict[str, Any]]] = None,
        city_id: str = "san_francisco"
    ) -> List[Dict[str, Any]]:
        """
        Generates dense 60 FPS trajectory frames with physical realism:
        - Digital elevation terrain clamping (prevents floating in air on downhill slopes)
        - Slope posture compensation (torso pitch adaptation, knee impact dampening)
        - Linear Inverted Pendulum Model (LIPM) bipedal gait with ZMP balance
        - Foot contact physics (stance ground contact, swing foot parabolic arc)
        - Reciprocal counter-momentum arm swing
        - Automatic cinematic camera shot tagging per frame
        """
        frames: List[Dict[str, Any]] = []
        global_time = 0.0

        for i in range(len(waypoints)):
            wp_curr = waypoints[i]
            wp_next = waypoints[i + 1] if i + 1 < len(waypoints) else wp_curr
            duration = max(0.1, wp_curr["duration"])
            num_frames = int(duration * fps)
            action = wp_curr["action"]

            # Headings
            h_start = wp_curr["heading"]
            h_end = wp_next["heading"] if wp_next != wp_curr else h_start
            diff = (h_end - h_start + 180) % 360 - 180

            # Does this waypoint have a consecutive leg to the next waypoint?
            has_transit = (i + 1 < len(waypoints))
            is_movement_action = action in ("WALK", "JOG", "SPRINT", "RUN", "PATROL")

            inplace_dur = 0.0
            if has_transit and not is_movement_action:
                inplace_dur = 2.0 if action in ("SPAWN", "DROP") else 3.0
                inplace_dur = min(inplace_dur, duration * 0.5)
            inplace_frames = int(inplace_dur * fps)

            for f_idx in range(num_frames):
                frame_time = global_time + (f_idx / fps)

                if has_transit and f_idx < inplace_frames:
                    # Phase 1: In-place action phase at wp_curr!
                    act = action
                    t_act = f_idx / max(1, inplace_frames)
                    lat = wp_curr["lat"]
                    lng = wp_curr["lng"]
                    heading = h_start
                    spd = 0.0
                elif has_transit:
                    # Phase 2: Continuous transit locomotion along the path from wp_curr to wp_next!
                    act = action if is_movement_action else "WALK"
                    transit_idx = f_idx - inplace_frames
                    transit_total = max(1, num_frames - inplace_frames)
                    t_norm = transit_idx / transit_total
                    lat = wp_curr["lat"] + (wp_next["lat"] - wp_curr["lat"]) * t_norm
                    lng = wp_curr["lng"] + (wp_next["lng"] - wp_curr["lng"]) * t_norm
                    heading = (h_start + diff * t_norm) % 360.0
                    spd = wp_curr["speed"] if wp_curr["speed"] > 0 else 2.2
                    t_act = t_norm
                else:
                    # Final destination waypoint
                    t_norm = f_idx / max(1, num_frames)
                    act = action
                    lat = wp_curr["lat"]
                    lng = wp_curr["lng"]
                    spd = 0.0
                    heading = (h_start + diff * t_norm) % 360.0
                    t_act = t_norm

                bio_frame = biomechanical_locomotion.compute_humanoid_frame(
                    lat=lat,
                    lng=lng,
                    heading=heading,
                    action=act,
                    frame_time=frame_time,
                    action_progress=t_act,
                    speed=spd,
                    city_id=city_id
                )

                # Determine active camera shot for this frame
                active_shot_angle = "THIRD_PERSON_CHASE"
                if camera_shots:
                    for s in camera_shots:
                        if s["start_time"] <= frame_time < s["end_time"]:
                            active_shot_angle = s["angle"]
                            break
                    if not active_shot_angle and camera_shots:
                        active_shot_angle = camera_shots[-1]["angle"]

                # Precision camera angle alignment with active frame action
                if act == "WAVE":
                    active_shot_angle = "ACTION_CLOSEUP"
                elif act == "SPAWN" and frame_time < 2.0:
                    active_shot_angle = "DRONE_WIDE"

                frames.append({
                    "frame": len(frames),
                    "time": round(frame_time, 3),
                    "action": act,
                    "action_name": f"{act.capitalize()} directive",
                    "action_progress": round(t_act, 3),
                    "camera_shot": active_shot_angle,
                    "pos": bio_frame["pos"],
                    "heading": bio_frame["heading"],
                    "speed": bio_frame["speed"],
                    "roll": bio_frame["roll"],
                    "pitch": bio_frame["pitch"],
                    "joints": bio_frame["joints"],
                    "terrain_telemetry": bio_frame["terrain_telemetry"]
                })

            global_time += duration

        return frames

    def _synthesize_action_joints(self, action: str, t_norm: float, gait_cycle: float) -> Dict[str, float]:
        """Synthesizes anatomical humanoid joint angles in degrees for each action state."""
        joints = {
            "neck_pitch": 5.0,
            "neck_yaw": 0.0,
            "spine_pitch": 3.0,
            "r_shoulder_pitch": -10.0,
            "r_shoulder_roll": -5.0,
            "r_elbow": 20.0,
            "l_shoulder_pitch": -10.0,
            "l_shoulder_roll": 5.0,
            "l_elbow": 20.0,
            "r_hip_pitch": 0.0,
            "l_hip_pitch": 0.0,
            "r_knee": 5.0,
            "l_knee": 5.0
        }

        if action in ("WALK", "JOG"):
            # Arm swing opposed to leg swing
            leg_phase = math.sin(gait_cycle * 2 * math.pi)
            arm_amp = 30.0 if action == "JOG" else 18.0
            joints["r_shoulder_pitch"] = -10.0 - arm_amp * leg_phase
            joints["l_shoulder_pitch"] = -10.0 + arm_amp * leg_phase
            joints["r_elbow"] = 35.0 if action == "JOG" else 25.0
            joints["l_elbow"] = 35.0 if action == "JOG" else 25.0
            joints["spine_pitch"] = 8.0 if action == "JOG" else 4.0

        elif action == "INSPECT":
            # Crouch and inspect doorway latch
            crouch_depth = math.sin(t_norm * math.pi)  # 0 -> 1 -> 0
            joints["spine_pitch"] = 28.0 * crouch_depth
            joints["neck_pitch"] = -15.0 * crouch_depth
            joints["r_knee"] = 35.0 * crouch_depth
            joints["l_knee"] = 35.0 * crouch_depth
            joints["r_shoulder_pitch"] = 25.0 * crouch_depth
            joints["r_elbow"] = 55.0 * crouch_depth

        elif action == "SCAN":
            # Head turns left and right in survey motion
            scan_yaw = 45.0 * math.sin(t_norm * 4 * math.pi)
            joints["neck_yaw"] = scan_yaw
            joints["spine_pitch"] = 2.0
            joints["r_shoulder_pitch"] = -5.0
            joints["l_shoulder_pitch"] = -5.0

        elif action == "WAVE":
            # Right arm raised waving hand
            wave_osc = 18.0 * math.sin(t_norm * 8 * math.pi)
            joints["r_shoulder_pitch"] = 75.0
            joints["r_shoulder_roll"] = 40.0
            joints["r_elbow"] = 70.0 + wave_osc
            joints["neck_pitch"] = 15.0  # Looking up at drone

        elif action == "CELEBRATE":
            # Both arms in the air
            joints["r_shoulder_pitch"] = 85.0
            joints["r_shoulder_roll"] = 35.0
            joints["l_shoulder_pitch"] = 85.0
            joints["l_shoulder_roll"] = -35.0
            joints["neck_pitch"] = 20.0

        elif action == "CROUCH":
            crouch_depth = math.sin(t_norm * math.pi)
            joints["spine_pitch"] = 25.0 * crouch_depth + 4.0
            joints["neck_pitch"] = -14.0 * crouch_depth + 2.0
            joints["r_knee"] = 40.0 * crouch_depth + 5.0
            joints["l_knee"] = 40.0 * crouch_depth + 5.0

        elif action == "LOOK_UP":
            joints["neck_pitch"] = 35.0
            joints["spine_pitch"] = -8.0
            joints["r_shoulder_pitch"] = -12.0
            joints["l_shoulder_pitch"] = -12.0

        return joints

    def plan_screenplay_scene(
        self,
        prompt: str,
        city_id: str = "san_francisco",
        center_lat: float = 37.7952,
        center_lng: float = -122.4028,
        custom_stage_pos: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Directs an end-to-end screenplay scene from natural language.
        Routes to ScreenplayPhysicsEngine to select models from catalog (3-car pileup, drone flight, etc.),
        anchors simulation physically at custom_stage_pos, and generates 60 FPS multi-actor trajectories.
        """
        return screenplay_physics_engine.plan_screenplay(
            prompt=prompt,
            city_id=city_id,
            center_lat=center_lat,
            center_lng=center_lng,
            custom_stage_pos=custom_stage_pos
        )

# Singleton instance
scene_director = SceneDirector()
