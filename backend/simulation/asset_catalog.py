"""
RoboTwin 3D Asset Catalog & Semantic Retrieval Engine.
Manages game-ready, certified 3D GLB assets for vehicles, stunt props, and characters.
Provides fast semantic keyword and embedding matching for text-to-scene orchestration.
"""

import os
import re
from typing import Dict, Any, List, Optional

ASSET_CATALOG: Dict[str, Dict[str, Any]] = {
    # 1. Vehicles
    "vehicle_sedan": {
        "id": "vehicle_sedan",
        "name": "Sapphire Executive Sedan",
        "category": "vehicle",
        "type": "car",
        "src": "/models/vehicle_sedan.glb",
        "damaged_src": "/models/vehicle_sedan_damaged.glb",
        "tags": ["sedan", "car", "taxi", "cab", "commuter", "automobile", "blue car", "vehicle"],
        "dimensions": {"length": 4.6, "width": 1.85, "height": 1.45},
        "mass_kg": 1500.0,
        "scale": 1.0,
        "default_speed_mps": 16.0,  # ~36 mph
        "max_speed_mps": 45.0,     # ~101 mph
        "braking_decel_mps2": 8.5,
        "physics": {
            "model": "Ackermann Bicycle Dynamics",
            "mass_kg": 1500.0,
            "max_speed_mps": 45.0,
            "accel_mps2": 5.2,
            "braking_decel_mps2": 8.5,
            "drag_coefficient": 0.31,
            "frontal_area_m2": 2.2,
            "friction_coeff": 0.85,
            "wheelbase_m": 2.82,
            "turning_radius_m": 5.4,
            "suspension_roll_stiffness": 4200.0,
            "pitch_dive_stiffness": 5800.0,
            "supported_actions": ["ACCELERATE", "CRUISE", "DRIFT", "EMERGENCY_BRAKE", "REVERSE", "PARK"],
            "description": "Mid-size passenger chassis with rear anti-roll bar, ABS disc brakes, and moderate body roll in tight corners."
        }
    },
    "vehicle_suv": {
        "id": "vehicle_suv",
        "name": "Tactical Full-Size SUV",
        "category": "vehicle",
        "type": "suv",
        "src": "/models/vehicle_suv.glb",
        "damaged_src": "/models/vehicle_suv_damaged.glb",
        "tags": ["suv", "truck", "4x4", "jeep", "crossover", "large car", "family car", "black car"],
        "dimensions": {"length": 4.9, "width": 1.98, "height": 1.78},
        "mass_kg": 2300.0,
        "scale": 1.0,
        "default_speed_mps": 14.0,  # ~31 mph
        "max_speed_mps": 40.0,     # ~90 mph
        "braking_decel_mps2": 7.5,
        "physics": {
            "model": "High-Inertia 4x4 Multi-Body",
            "mass_kg": 2300.0,
            "max_speed_mps": 40.0,
            "accel_mps2": 4.4,
            "braking_decel_mps2": 7.5,
            "drag_coefficient": 0.42,
            "frontal_area_m2": 2.85,
            "friction_coeff": 0.82,
            "wheelbase_m": 3.05,
            "turning_radius_m": 6.2,
            "suspension_roll_stiffness": 5600.0,
            "pitch_dive_stiffness": 6800.0,
            "supported_actions": ["ACCELERATE", "CRUISE", "RAM_BARRIER", "EMERGENCY_BRAKE", "OFFROAD", "PARK"],
            "description": "High center-of-gravity utility vehicle with substantial momentum and pronounced nose dive during hard braking."
        }
    },
    "vehicle_sportscar": {
        "id": "vehicle_sportscar",
        "name": "Apex GT Aerodynamic Supercar",
        "category": "vehicle",
        "type": "sportscar",
        "src": "/models/vehicle_sportscar.glb",
        "damaged_src": "/models/vehicle_sedan_damaged.glb",
        "tags": ["sportscar", "sports car", "supercar", "racecar", "fast car", "coupe", "yellow car", "amber"],
        "dimensions": {"length": 4.6, "width": 2.02, "height": 1.18},
        "mass_kg": 1350.0,
        "scale": 1.0,
        "default_speed_mps": 24.0,  # ~54 mph
        "max_speed_mps": 65.0,     # ~145 mph
        "braking_decel_mps2": 11.0,
        "physics": {
            "model": "High-Downforce Ground-Effect",
            "mass_kg": 1350.0,
            "max_speed_mps": 65.0,
            "accel_mps2": 8.8,
            "braking_decel_mps2": 11.0,
            "drag_coefficient": 0.28,
            "frontal_area_m2": 1.85,
            "friction_coeff": 1.15,
            "wheelbase_m": 2.68,
            "turning_radius_m": 4.8,
            "suspension_roll_stiffness": 7800.0,
            "pitch_dive_stiffness": 9200.0,
            "supported_actions": ["LAUNCH_SPRINT", "DRIFT", "CORNER_APEX", "EMERGENCY_BRAKE", "HIGH_SPEED_CRUISE"],
            "description": "Low center-of-gravity track chassis with racing compound tire friction and minimal body lean."
        }
    },
    "vehicle_truck": {
        "id": "vehicle_truck",
        "name": "Freight Logistics Box Truck",
        "category": "vehicle",
        "type": "truck",
        "src": "/models/vehicle_truck.glb",
        "damaged_src": "/models/vehicle_suv_damaged.glb",
        "tags": ["truck", "box truck", "delivery", "cargo", "lorry", "commercial", "freight", "semi", "van"],
        "dimensions": {"length": 6.8, "width": 2.4, "height": 3.1},
        "mass_kg": 5200.0,
        "scale": 1.0,
        "default_speed_mps": 12.0,  # ~27 mph
        "max_speed_mps": 32.0,     # ~72 mph
        "braking_decel_mps2": 6.0,
        "physics": {
            "model": "Commercial Heavy Transport",
            "mass_kg": 5200.0,
            "max_speed_mps": 32.0,
            "accel_mps2": 2.8,
            "braking_decel_mps2": 6.0,
            "drag_coefficient": 0.58,
            "frontal_area_m2": 5.4,
            "friction_coeff": 0.75,
            "wheelbase_m": 4.2,
            "turning_radius_m": 8.6,
            "suspension_roll_stiffness": 12000.0,
            "pitch_dive_stiffness": 14000.0,
            "supported_actions": ["ACCELERATE", "CRUISE", "DECELERATE", "DOCK_LOADING", "IMPACT_CRUSH"],
            "description": "Heavy commercial payload transport with extended braking distance and high rollover sensitivity."
        }
    },
    "vehicle_police": {
        "id": "vehicle_police",
        "name": "Metropolitan Police Interceptor",
        "category": "vehicle",
        "type": "police",
        "src": "/models/vehicle_police.glb",
        "damaged_src": "/models/vehicle_sedan_damaged.glb",
        "tags": ["police", "cop", "patrol", "cruiser", "siren", "emergency", "interceptor", "law enforcement"],
        "dimensions": {"length": 4.8, "width": 1.88, "height": 1.55},
        "mass_kg": 1750.0,
        "scale": 1.0,
        "default_speed_mps": 22.0,  # ~50 mph
        "max_speed_mps": 55.0,     # ~123 mph
        "braking_decel_mps2": 10.0,
        "physics": {
            "model": "Reinforced Pursuit Interceptor",
            "mass_kg": 1750.0,
            "max_speed_mps": 55.0,
            "accel_mps2": 6.8,
            "braking_decel_mps2": 10.0,
            "drag_coefficient": 0.35,
            "frontal_area_m2": 2.4,
            "friction_coeff": 0.95,
            "wheelbase_m": 2.95,
            "turning_radius_m": 5.1,
            "suspension_roll_stiffness": 5800.0,
            "pitch_dive_stiffness": 7200.0,
            "supported_actions": ["PURSUIT_ACCEL", "PIT_MANEUVER", "SLIDE_BLOCK", "EMERGENCY_STOP", "SIREN_CRUISE"],
            "description": "Tuned police interceptor equipped with push bumper, heavy duty sway bars, and pursuit ABS."
        }
    },

    # 2. Robotics & Humanoids
    "humanoid_pedestrian": {
        "id": "humanoid_pedestrian",
        "name": "RoboTwin 29-DoF Humanoid",
        "category": "character",
        "type": "humanoid",
        "src": "/models/humanoid_walk.glb",
        "damaged_src": "/models/humanoid_drop.glb",
        "tags": ["robot", "humanoid", "pedestrian", "person", "walker", "actor", "stuntman", "character"],
        "dimensions": {"length": 0.6, "width": 0.8, "height": 2.0},
        "mass_kg": 85.0,
        "scale": 0.48,
        "default_speed_mps": 1.8,
        "max_speed_mps": 6.5,
        "braking_decel_mps2": 4.5,
        "physics": {
            "model": "LIPM Bipedal Gait & ZMP",
            "mass_kg": 85.0,
            "max_speed_mps": 6.5,
            "accel_mps2": 3.2,
            "braking_decel_mps2": 4.5,
            "drag_coefficient": 0.95,
            "frontal_area_m2": 0.65,
            "friction_coeff": 0.88,
            "leg_length_m": 0.96,
            "step_frequency_hz": 2.4,
            "moment_of_inertia_kgm2": 12.8,
            "supported_actions": ["WALK", "JOG", "SPRINT", "CROUCH", "INSPECT", "SCAN", "WAVE", "CELEBRATE", "SPAWN"],
            "description": "Full-body articulated humanoid robot with inverted pendulum bipedal stabilization and foot ground clamping."
        }
    },
    "robot_expressive": {
        "id": "robot_expressive",
        "name": "Three.js Open-Source Expressive Robot",
        "category": "robot",
        "type": "mobile_robot",
        "src": "/models/RobotExpressive.glb",
        "damaged_src": None,
        "tags": ["threejs", "open source", "robot", "expressive", "autonomous", "rover", "service robot"],
        "dimensions": {"length": 0.85, "width": 0.82, "height": 1.15},
        "mass_kg": 42.0,
        "scale": 0.55,
        "default_speed_mps": 2.5,
        "max_speed_mps": 4.8,
        "braking_decel_mps2": 3.8,
        "physics": {
            "model": "Differential Drive Kinematics",
            "mass_kg": 42.0,
            "max_speed_mps": 4.8,
            "accel_mps2": 2.4,
            "braking_decel_mps2": 3.8,
            "drag_coefficient": 0.75,
            "frontal_area_m2": 0.55,
            "friction_coeff": 0.90,
            "wheelbase_m": 0.65,
            "turning_radius_m": 0.35,
            "supported_actions": ["NAVIGATE", "ROTATE_IN_PLACE", "SCAN_SURVEY", "SALUTE", "EMOTE", "STANDBY"],
            "description": "Open source Three.js expressive autonomous ground rover with differential dual-wheel drive and zero turn radius."
        }
    },

    # 3. Autonomous Aerial Drones
    "drone_quadcopter": {
        "id": "drone_quadcopter",
        "name": "Autonomous Stunt Quadcopter Drone",
        "category": "drone",
        "type": "quadcopter",
        "src": "/models/drone_quadcopter.glb",
        "damaged_src": None,
        "tags": ["drone", "quadcopter", "uav", "aerial", "flying", "camera drone", "autonomous flight"],
        "dimensions": {"length": 0.72, "width": 0.72, "height": 0.28},
        "mass_kg": 3.8,
        "scale": 1.2,
        "default_speed_mps": 12.0,
        "max_speed_mps": 28.0,
        "braking_decel_mps2": 6.8,
        "physics": {
            "model": "6-DoF Multirotor Thrust Dynamics",
            "mass_kg": 3.8,
            "max_speed_mps": 28.0,
            "accel_mps2": 7.5,
            "braking_decel_mps2": 6.8,
            "drag_coefficient": 0.38,
            "frontal_area_m2": 0.16,
            "rotor_thrust_n": 82.0,
            "max_tilt_pitch_deg": 35.0,
            "max_bank_roll_deg": 40.0,
            "climb_rate_mps": 8.0,
            "supported_actions": ["TAKEOFF", "CORRIDOR_FLYBY", "ORBIT_TARGET", "DIVE_CAMERA", "HOVER", "LAND"],
            "description": "Agile 4-rotor brushless aerial drone capable of aggressive forward pitch acceleration and banked turns."
        }
    },

    # 4. Props & Obstacles
    "prop_barrier": {
        "id": "prop_barrier",
        "name": "Concrete Jersey Crash Barrier",
        "category": "prop",
        "type": "barrier",
        "src": "/models/prop_barrier.glb",
        "damaged_src": None,
        "tags": ["barrier", "concrete", "wall", "divider", "guardrail", "block", "curb"],
        "dimensions": {"length": 3.2, "width": 0.65, "height": 1.0},
        "mass_kg": 2500.0,
        "scale": 1.0,
        "physics": {
            "model": "Rigid Body Coulomb Friction",
            "mass_kg": 2500.0,
            "friction_coeff": 0.78,
            "restitution_coeff": 0.15,
            "toppling_angle_deg": 42.0,
            "supported_actions": ["ROADBLOCK", "IMPACT_DEFLECT", "CONTAINMENT"],
            "description": "Massive concrete reinforced barrier designed to deflect speeding vehicles back into roadway."
        }
    },
    "prop_traffic_light": {
        "id": "prop_traffic_light",
        "name": "Urban Traffic Light Mast",
        "category": "prop",
        "type": "signal",
        "src": "/models/prop_traffic_light.glb",
        "damaged_src": None,
        "tags": ["traffic light", "light", "signal", "pole", "intersection light", "red light", "green light"],
        "dimensions": {"length": 0.5, "width": 2.8, "height": 5.5},
        "mass_kg": 400.0,
        "scale": 1.0,
        "physics": {
            "model": "Cantilever Mast Arm",
            "mass_kg": 400.0,
            "friction_coeff": 0.90,
            "supported_actions": ["STANDBY", "SIGNAL_CYCLE"],
            "description": "Structural steel traffic signal mast standing 5.5m above ground elevation."
        }
    },
    "prop_traffic_cone": {
        "id": "prop_traffic_cone",
        "name": "OSHA Safety Traffic Cone",
        "category": "prop",
        "type": "hazard",
        "src": "/models/prop_traffic_cone.glb",
        "damaged_src": None,
        "tags": ["cone", "traffic cone", "hazard", "marker", "safety", "orange cone", "pylon"],
        "dimensions": {"length": 0.42, "width": 0.42, "height": 0.72},
        "mass_kg": 4.5,
        "scale": 1.0,
        "physics": {
            "model": "Low-Inertia Tip-Over Obstacle",
            "mass_kg": 4.5,
            "friction_coeff": 0.65,
            "restitution_coeff": 0.45,
            "toppling_angle_deg": 28.0,
            "supported_actions": ["OBSTACLE_SLALOM", "KNOCKDOWN", "STANDBY"],
            "description": "Weighted base flexible rubber hazard marker with high-visibility reflector."
        }
    },
    "prop_delivery_crate": {
        "id": "prop_delivery_crate",
        "name": "Heavy Industrial Cargo Crate",
        "category": "prop",
        "type": "cargo",
        "src": "/models/prop_delivery_crate.glb",
        "damaged_src": None,
        "tags": ["crate", "box", "cargo", "industrial", "wooden box", "container", "supply"],
        "dimensions": {"length": 1.2, "width": 1.2, "height": 1.2},
        "mass_kg": 180.0,
        "scale": 1.0,
        "physics": {
            "model": "Heavy Slidable Freight Crate",
            "mass_kg": 180.0,
            "friction_coeff": 0.60,
            "restitution_coeff": 0.20,
            "supported_actions": ["OBSTACLE_COLLISION", "CARGO_PICKUP", "STANDBY"],
            "description": "Reinforced corner composite freight crate suitable for robotics manipulation or vehicle impact."
        }
    },
    "prop_debris_cluster": {
        "id": "prop_debris_cluster",
        "name": "Accident Collision Debris Field",
        "category": "prop",
        "type": "debris",
        "src": "/models/prop_debris_cluster.glb",
        "damaged_src": None,
        "tags": ["debris", "wreckage", "scatter", "glass", "tire", "shards", "pieces", "parts", "collision"],
        "dimensions": {"length": 2.0, "width": 2.0, "height": 0.4},
        "mass_kg": 80.0,
        "scale": 1.0,
        "physics": {
            "model": "Dispersed Kinetic Scatter",
            "mass_kg": 80.0,
            "friction_coeff": 0.70,
            "supported_actions": ["ROAD_HAZARD", "SKID_IMPACT"],
            "description": "Multi-part collision scatter offering uneven rolling resistance to crossing vehicles."
        }
    }
}

class AssetCatalogManager:
    """Manages 3D asset matching, semantic lookup, and metadata discovery."""

    def __init__(self):
        self.catalog = ASSET_CATALOG

    def get_all_assets(self) -> List[Dict[str, Any]]:
        """Returns the full list of catalog assets."""
        return list(self.catalog.values())

    def get_asset_by_id(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """Finds asset by exact ID."""
        return self.catalog.get(asset_id)

    def match_asset(self, text: str, preferred_category: Optional[str] = None) -> Dict[str, Any]:
        """
        Finds the closest matching 3D asset for a natural language phrase.
        e.g., 'police cruiser' -> vehicle_police
              'delivery truck' -> vehicle_truck
              'yellow sports car' -> vehicle_sportscar
        """
        q = text.lower().strip()
        words = set(re.findall(r"\w+", q))

        best_score = -1
        best_asset = self.catalog["vehicle_sedan"]  # Fallback

        for key, asset in self.catalog.items():
            if preferred_category and asset.get("category") != preferred_category:
                continue

            score = 0
            # Direct ID or name match
            if key in q or asset["name"].lower() in q:
                score += 15

            # Tag matching
            for tag in asset.get("tags", []):
                tag_lower = tag.lower()
                if tag_lower in q:
                    score += 8
                tag_words = set(tag_lower.split())
                score += len(words.intersection(tag_words)) * 3

            # Type match
            if asset.get("type", "") in q:
                score += 5

            if score > best_score:
                best_score = score
                best_asset = asset

        return best_asset

    def resolve_actors_for_scene(self, prompt: str) -> List[Dict[str, Any]]:
        """
        Parses scene description and resolves participating actors.
        Defaults to a dramatic 2-vehicle scenario (e.g. sedan vs SUV or police vs speeder)
        if not explicitly broken down.
        """
        p_lower = prompt.lower()
        actors = []

        # Check for police involvement
        has_police = any(w in p_lower for w in ["police", "cop", "patrol", "chase", "pursuit", "siren"])
        has_truck = any(w in p_lower for w in ["truck", "semi", "lorry", "delivery", "box truck", "cargo"])
        has_sports = any(w in p_lower for w in ["sports car", "supercar", "fast car", "speeding", "ferrari", "lamborghini"])
        has_suv = any(w in p_lower for w in ["suv", "jeep", "crossover", "large car", "4x4"])
        has_humanoid = any(w in p_lower for w in ["pedestrian", "person", "humanoid", "robot", "crosswalk", "walker"])

        # Select primary and secondary vehicle pairing
        if has_police:
            a1_asset = self.catalog["vehicle_police"]
            if has_sports:
                a2_asset = self.catalog["vehicle_sportscar"]
            elif has_truck:
                a2_asset = self.catalog["vehicle_truck"]
            elif has_suv:
                a2_asset = self.catalog["vehicle_suv"]
            else:
                a2_asset = self.catalog["vehicle_sedan"]
        elif has_sports:
            a1_asset = self.catalog["vehicle_sportscar"]
            if has_truck:
                a2_asset = self.catalog["vehicle_truck"]
            elif has_suv or "t-bone" in p_lower:
                a2_asset = self.catalog["vehicle_suv"]
            else:
                a2_asset = self.catalog["vehicle_sedan"]
        elif has_truck:
            a1_asset = self.catalog["vehicle_truck"]
            a2_asset = self.catalog["vehicle_sedan"]
        else:
            a1_asset = self.catalog["vehicle_sedan"]
            a2_asset = self.catalog["vehicle_suv"]

        actors.append({
            "id": "actor_lead",
            "name": a1_asset["name"],
            "asset_id": a1_asset["id"],
            "model_src": a1_asset["src"],
            "damaged_src": a1_asset.get("damaged_src"),
            "category": a1_asset["category"],
            "role": "pursuer" if has_police else "lead",
            "dimensions": a1_asset["dimensions"],
            "mass_kg": a1_asset["mass_kg"],
            "scale": a1_asset["scale"]
        })

        actors.append({
            "id": "actor_target",
            "name": a2_asset["name"],
            "asset_id": a2_asset["id"],
            "model_src": a2_asset["src"],
            "damaged_src": a2_asset.get("damaged_src"),
            "category": a2_asset["category"],
            "role": "suspect" if has_police else "target",
            "dimensions": a2_asset["dimensions"],
            "mass_kg": a2_asset["mass_kg"],
            "scale": a2_asset["scale"]
        })

        # Actor 3 (Optional pedestrian/stunt humanoid or barrier)
        if has_humanoid or "pedestrian" in p_lower or "crosswalk" in p_lower:
            h_asset = self.catalog["humanoid_pedestrian"]
            actors.append({
                "id": "actor_pedestrian",
                "name": h_asset["name"],
                "asset_id": h_asset["id"],
                "model_src": h_asset["src"],
                "damaged_src": h_asset.get("damaged_src"),
                "category": h_asset["category"],
                "role": "pedestrian_witness",
                "dimensions": h_asset["dimensions"],
                "mass_kg": h_asset["mass_kg"],
                "scale": h_asset["scale"]
            })

        return actors

asset_catalog_manager = AssetCatalogManager()
