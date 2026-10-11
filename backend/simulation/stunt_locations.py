"""
RoboTwin StuntStudio: Real-World Geospatial Stunt Locations.
Provides curated real-world coordinates and metric architectural dimensions
for Google Photorealistic 3D Tiles and procedural geospatial digital twins.
"""

from typing import Dict, Any, List

STUNT_LOCATIONS: Dict[str, Dict[str, Any]] = {
    "san_francisco_rooftop": {
        "id": "san_francisco_rooftop",
        "name": "San Francisco - Financial District",
        "city": "San Francisco, CA",
        "description": "High-rise rooftop gap jump across commercial buildings into a deep urban canyon.",
        "coordinates": {"lat": 37.7952, "lng": -122.4028},
        "camera_start": {"x": 0.0, "y": 48.0, "z": 28.0},
        "rooftop": {
            "launch_height": 42.0,
            "target_height": 38.5,
            "gap_distance": 9.8,
            "surface_type": "gravel_membrane",
            "parapet_height": 0.9,
            "landing_zone_radius": 3.2
        },
        "street_drop": {
            "total_depth": 42.0,
            "surface": "asphalt_concrete",
            "airbag_capable": True,
            "wire_rig_capable": True
        },
        "recommended_stunts": ["ROOFTOP_GAP_LEAP", "BASE_JUMP_WIRE_ARREST", "HIGH_FALL_AIRBAG"]
    },
    "manhattan_high_rise": {
        "id": "manhattan_high_rise",
        "name": "New York - Manhattan Midtown",
        "city": "New York, NY",
        "description": "Multi-tier commercial rooftop ledges with architectural setbacks and ventilation towers.",
        "coordinates": {"lat": 40.7580, "lng": -73.9855},
        "camera_start": {"x": 5.0, "y": 72.0, "z": 32.0},
        "rooftop": {
            "launch_height": 65.0,
            "target_height": 52.0,
            "gap_distance": 7.4,
            "surface_type": "concrete_pavers",
            "parapet_height": 1.1,
            "landing_zone_radius": 2.8
        },
        "street_drop": {
            "total_depth": 65.0,
            "surface": "asphalt",
            "airbag_capable": True,
            "wire_rig_capable": True
        },
        "recommended_stunts": ["PARKOUR_LEDGE_ROLL", "BASE_JUMP_WIRE_ARREST", "HIGH_FALL_AIRBAG"]
    },
    "chicago_river_bridge": {
        "id": "chicago_river_bridge",
        "name": "Chicago - Riverwalk Bridge",
        "city": "Chicago, IL",
        "description": "Double-deck bascule bridge tower vault with long parabolic flight over river corridor.",
        "coordinates": {"lat": 41.8887, "lng": -87.6281},
        "camera_start": {"x": -2.0, "y": 35.0, "z": 24.0},
        "rooftop": {
            "launch_height": 28.0,
            "target_height": 24.0,
            "gap_distance": 12.5,
            "surface_type": "steel_deck_tread",
            "parapet_height": 1.2,
            "landing_zone_radius": 3.5
        },
        "street_drop": {
            "total_depth": 28.0,
            "surface": "water_channel",
            "airbag_capable": False,
            "wire_rig_capable": True
        },
        "recommended_stunts": ["SUPERMAN_GLIDE_WIRE", "ROOFTOP_GAP_LEAP"]
    },
    "tokyo_shinjuku_skyscraper": {
        "id": "tokyo_shinjuku_skyscraper",
        "name": "Tokyo - Shinjuku District",
        "city": "Tokyo, Japan",
        "description": "Ultra-dense skyscraper helipad ledge with dramatic vertical plunge into illuminated courtyard.",
        "coordinates": {"lat": 35.6909, "lng": 139.6998},
        "camera_start": {"x": 0.0, "y": 95.0, "z": 36.0},
        "rooftop": {
            "launch_height": 85.0,
            "target_height": 68.0,
            "gap_distance": 11.2,
            "surface_type": "reinforced_helipad",
            "parapet_height": 1.0,
            "landing_zone_radius": 3.0
        },
        "street_drop": {
            "total_depth": 85.0,
            "surface": "granite_plaza",
            "airbag_capable": True,
            "wire_rig_capable": True
        },
        "recommended_stunts": ["BASE_JUMP_WIRE_ARREST", "HERO_LANDING", "ROOFTOP_GAP_LEAP"]
    },
    "stunt_training_ground": {
        "id": "stunt_training_ground",
        "name": "RoboTwin Stunt Testing Grounds",
        "city": "Hollywood Proving Lab",
        "description": "Controlled Hollywood stunt engineering complex with multi-height testing platforms, airbag pits, and telemetry rigs.",
        "coordinates": {"lat": 34.0522, "lng": -118.2437},
        "camera_start": {"x": 0.0, "y": 25.0, "z": 22.0},
        "rooftop": {
            "launch_height": 18.0,
            "target_height": 14.5,
            "gap_distance": 8.0,
            "surface_type": "anti_slip_modular",
            "parapet_height": 0.8,
            "landing_zone_radius": 4.0
        },
        "street_drop": {
            "total_depth": 18.0,
            "surface": "high_density_foam_pit",
            "airbag_capable": True,
            "wire_rig_capable": True
        },
        "recommended_stunts": ["ROOFTOP_GAP_LEAP", "HIGH_FALL_AIRBAG", "BASE_JUMP_WIRE_ARREST", "PARKOUR_LEDGE_ROLL", "HERO_LANDING"]
    }
}


def get_all_locations() -> List[Dict[str, Any]]:
    """Returns a list of all pre-configured stunt locations."""
    return list(STUNT_LOCATIONS.values())


def get_location_by_id(loc_id: str) -> Dict[str, Any]:
    """Retrieves a specific location by ID, falling back to training ground."""
    return STUNT_LOCATIONS.get(loc_id, STUNT_LOCATIONS["stunt_training_ground"])
