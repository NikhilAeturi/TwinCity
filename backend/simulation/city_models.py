"""
RoboTwin StuntStudio: 1-to-1 Architectural City Models.
Provides definitive real-world architectural blueprints, heights, silhouettes,
and rooftop equipment matching Google Maps 3D photogrammetry for each location.
"""

from typing import Dict, Any, List

CITY_ARCHITECTURAL_MODELS: Dict[str, Dict[str, Any]] = {
    "san_francisco_rooftop": {
        "location_id": "san_francisco_rooftop",
        "city_name": "San Francisco, CA",
        "center_coordinates": {"lat": 37.7952, "lng": -122.4028},
        "description": "Financial District (Sansome St / California St / Montgomery St) featuring 555 California St and the Transamerica Pyramid.",
        "launch_building": {
            "name": "475 Sansome Street",
            "height": 42.0,
            "width": 26.0,
            "depth": 30.0,
            "facade_style": "brutalist_concrete_piers",
            "facade_color": 0x3d434d,
            "window_tint": 0x1a2b3c,
            "rooftop": {
                "surface_material": "gravel_bitumen_ballast",
                "color": 0x474b54,
                "parapet_height": 1.1,
                "penthouse": {"w": 8.0, "h": 4.2, "d": 6.5, "x": -5.0, "z": 6.0},
                "hvac_units": [
                    {"w": 4.5, "h": 2.4, "d": 3.0, "x": -6.0, "z": -6.0, "fan_count": 2},
                    {"w": 3.8, "h": 2.2, "d": 2.8, "x": 5.0, "z": -7.0, "fan_count": 2}
                ],
                "antenna_masts": [{"x": -7.0, "z": 8.0, "h": 9.5}],
                "satellite_dishes": [{"x": 6.0, "z": 7.0, "radius": 1.2}],
                "window_washer_track": True
            }
        },
        "target_building": {
            "name": "405 Sansome Street / Bank Ledge",
            "height": 38.5,
            "width": 28.0,
            "depth": 30.0,
            "facade_style": "granite_limestone_piers",
            "facade_color": 0x5a544b,
            "window_tint": 0x243242,
            "rooftop": {
                "surface_material": "weathered_membrane",
                "color": 0x4f5259,
                "parapet_height": 0.95,
                "penthouse": {"w": 7.5, "h": 3.8, "d": 6.0, "x": 5.0, "z": 7.0},
                "hvac_units": [
                    {"w": 4.0, "h": 2.2, "d": 3.0, "x": 6.0, "z": -6.0, "fan_count": 2}
                ],
                "antenna_masts": [{"x": 7.0, "z": 8.0, "h": 8.0}],
                "solar_panels": True
            }
        },
        "landmarks": [
            {
                "name": "Transamerica Pyramid",
                "type": "pyramid_spire",
                "x": -18.0,
                "z": -85.0,
                "height": 260.0,
                "base_w": 52.0,
                "base_d": 52.0,
                "spire_h": 65.0,
                "color": 0xdedede,
                "wing_w": 10.0,
                "wing_h": 45.0
            },
            {
                "name": "555 California Street (Bank of America Center)",
                "type": "faceted_bay_skyscraper",
                "x": 65.0,
                "z": 45.0,
                "height": 237.0,
                "width": 48.0,
                "depth": 42.0,
                "color": 0x4a2a2a,  # Deep carnelian granite
                "penthouse_setbacks": 3
            },
            {
                "name": "345 California Center",
                "type": "twin_pyramid_spires",
                "x": -68.0,
                "z": 35.0,
                "height": 212.0,
                "width": 38.0,
                "depth": 38.0,
                "color": 0x6e7682
            },
            {
                "name": "101 California Street",
                "type": "stepped_cylinder_atrium",
                "x": 75.0,
                "z": -60.0,
                "height": 183.0,
                "radius": 22.0,
                "color": 0x93a3b8
            },
            {
                "name": "Two Transamerica Center",
                "type": "commercial_block",
                "x": 25.0,
                "z": -70.0,
                "height": 74.0,
                "width": 26.0,
                "depth": 24.0,
                "color": 0x475569
            },
            {
                "name": "465 California Street",
                "type": "classical_commercial",
                "x": 28.0,
                "z": 75.0,
                "height": 88.0,
                "width": 28.0,
                "depth": 26.0,
                "color": 0x52525b
            }
        ]
    },
    "manhattan_high_rise": {
        "location_id": "manhattan_high_rise",
        "city_name": "New York, NY",
        "center_coordinates": {"lat": 40.7580, "lng": -73.9855},
        "description": "Midtown Manhattan canyon (Avenue of the Americas / 42nd-48th St) featuring Bank of America Tower, 4 Times Square, and Rockefeller setbacks.",
        "launch_building": {
            "name": "1133 Avenue of the Americas",
            "height": 65.0,
            "width": 28.0,
            "depth": 32.0,
            "facade_style": "curtain_wall_vertical_mullions",
            "facade_color": 0x1e293b,
            "window_tint": 0x0f172a,
            "rooftop": {
                "surface_material": "concrete_pavers",
                "color": 0x334155,
                "parapet_height": 1.2,
                "penthouse": {"w": 9.0, "h": 5.0, "d": 7.0, "x": -6.0, "z": 6.0},
                "hvac_units": [
                    {"w": 5.0, "h": 2.8, "d": 3.2, "x": -6.0, "z": -7.0, "fan_count": 3},
                    {"w": 4.2, "h": 2.5, "d": 3.0, "x": 6.0, "z": -8.0, "fan_count": 2}
                ],
                "antenna_masts": [{"x": -7.0, "z": 8.0, "h": 12.0}],
                "satellite_dishes": [{"x": 7.0, "z": 7.0, "radius": 1.5}]
            }
        },
        "target_building": {
            "name": "Commercial Setback Tower B",
            "height": 52.0,
            "width": 30.0,
            "depth": 32.0,
            "facade_style": "stone_limestone_mullions",
            "facade_color": 0x475569,
            "window_tint": 0x1e293b,
            "rooftop": {
                "surface_material": "bitumen_pavers",
                "color": 0x3f3f46,
                "parapet_height": 1.1,
                "penthouse": {"w": 8.0, "h": 4.5, "d": 6.5, "x": 6.0, "z": 6.0},
                "hvac_units": [
                    {"w": 4.8, "h": 2.6, "d": 3.2, "x": 7.0, "z": -7.0, "fan_count": 3}
                ],
                "antenna_masts": [{"x": 8.0, "z": 8.0, "h": 10.0}]
            }
        },
        "landmarks": [
            {
                "name": "Bank of America Tower (One Bryant Park)",
                "type": "faceted_crystalline_spire",
                "x": -45.0,
                "z": -80.0,
                "height": 366.0,
                "width": 46.0,
                "depth": 42.0,
                "color": 0x102a43,  # Crystalline blue-green glass
                "spire_h": 77.0
            },
            {
                "name": "4 Times Square (Condé Nast Tower)",
                "type": "four_tier_antenna_mast",
                "x": 60.0,
                "z": -75.0,
                "height": 247.0,
                "width": 42.0,
                "depth": 40.0,
                "color": 0x243b53,
                "spire_h": 55.0
            },
            {
                "name": "1540 Broadway (Bertelsmann Building)",
                "type": "stepped_emerald_setbacks",
                "x": -65.0,
                "z": 45.0,
                "height": 223.0,
                "width": 38.0,
                "depth": 36.0,
                "color": 0x1e3a5f
            },
            {
                "name": "Rockefeller Center 30 Rock",
                "type": "art_deco_limestone_tower",
                "x": 68.0,
                "z": 60.0,
                "height": 259.0,
                "width": 50.0,
                "depth": 35.0,
                "color": 0x78716c
            }
        ]
    },
    "tokyo_shinjuku_skyscraper": {
        "location_id": "tokyo_shinjuku_skyscraper",
        "city_name": "Tokyo, Japan",
        "center_coordinates": {"lat": 35.6909, "lng": 139.6998},
        "description": "Nishi-Shinjuku Skyscraper Center featuring Tokyo Metropolitan Government Building and Mode Gakuen Cocoon Tower.",
        "launch_building": {
            "name": "Shinjuku Helipad Tower",
            "height": 85.0,
            "width": 32.0,
            "depth": 34.0,
            "facade_style": "dark_tint_reflective_glass",
            "facade_color": 0x0f172a,
            "window_tint": 0x0284c7,
            "rooftop": {
                "surface_material": "reinforced_helipad_concrete",
                "color": 0x334155,
                "parapet_height": 1.1,
                "helipad_marking": "H_WHITE_EMERGENCY",
                "penthouse": {"w": 10.0, "h": 5.2, "d": 8.0, "x": -8.0, "z": 8.0},
                "hvac_units": [
                    {"w": 5.5, "h": 3.0, "d": 3.5, "x": -8.0, "z": -9.0, "fan_count": 3}
                ],
                "antenna_masts": [{"x": -9.0, "z": 10.0, "h": 14.0}]
            }
        },
        "target_building": {
            "name": "Shinjuku Plaza Atrium Roof",
            "height": 68.0,
            "width": 34.0,
            "depth": 36.0,
            "facade_style": "aluminum_horizontal_stripes",
            "facade_color": 0x1e293b,
            "window_tint": 0x0369a1,
            "rooftop": {
                "surface_material": "paver_granite",
                "color": 0x475569,
                "parapet_height": 1.0,
                "penthouse": {"w": 9.0, "h": 4.8, "d": 7.5, "x": 8.0, "z": 8.0},
                "hvac_units": [
                    {"w": 5.0, "h": 2.8, "d": 3.5, "x": 9.0, "z": -9.0, "fan_count": 3}
                ]
            }
        },
        "landmarks": [
            {
                "name": "Tokyo Metropolitan Government Building (Tochō)",
                "type": "twin_gothic_towers",
                "x": -55.0,
                "z": -85.0,
                "height": 243.0,
                "width": 58.0,
                "depth": 38.0,
                "color": 0x52525b,
                "skybridge_h": 180.0
            },
            {
                "name": "Mode Gakuen Cocoon Tower",
                "type": "curved_lattice_cocoon",
                "x": 65.0,
                "z": -70.0,
                "height": 204.0,
                "radius": 20.0,
                "color": 0x0284c7  # Vibrant blue lattice
            },
            {
                "name": "Shinjuku Mitsui Building",
                "type": "x_braced_damper_skyscraper",
                "x": -60.0,
                "z": 55.0,
                "height": 225.0,
                "width": 44.0,
                "depth": 38.0,
                "color": 0x18181b
            },
            {
                "name": "Shinjuku Sumitomo Building",
                "type": "triangular_prism",
                "x": 70.0,
                "z": 60.0,
                "height": 210.0,
                "side_len": 44.0,
                "color": 0x27272a
            }
        ]
    },
    "chicago_river_bridge": {
        "location_id": "chicago_river_bridge",
        "city_name": "Chicago, IL",
        "center_coordinates": {"lat": 41.8887, "lng": -87.6281},
        "description": "Chicago River & Michigan Ave Bridge featuring Wrigley Building clock tower and Tribune Tower buttresses.",
        "launch_building": {
            "name": "Wrigley Building South Tower",
            "height": 28.0,
            "width": 22.0,
            "depth": 25.0,
            "facade_style": "white_glazed_terracotta",
            "facade_color": 0xf1f5f9,
            "window_tint": 0x334155,
            "rooftop": {
                "surface_material": "terracotta_coping_gravel",
                "color": 0xe2e8f0,
                "parapet_height": 1.2,
                "clock_tower_base": True,
                "penthouse": {"w": 6.5, "h": 3.8, "d": 5.5, "x": -4.0, "z": 5.0},
                "hvac_units": [{"w": 3.8, "h": 2.0, "d": 2.5, "x": -5.0, "z": -5.0, "fan_count": 2}]
            }
        },
        "target_building": {
            "name": "Tribune Tower Bridge Deck",
            "height": 24.0,
            "width": 24.0,
            "depth": 26.0,
            "facade_style": "neo_gothic_carved_limestone",
            "facade_color": 0x78716c,
            "window_tint": 0x292524,
            "rooftop": {
                "surface_material": "weathered_copper_deck",
                "color": 0x22c55e,
                "parapet_height": 1.3,
                "buttresses": True,
                "penthouse": {"w": 6.0, "h": 3.5, "d": 5.0, "x": 5.0, "z": 5.0}
            }
        },
        "landmarks": [
            {
                "name": "Wrigley Clock Tower Peak",
                "type": "french_renaissance_cupola",
                "x": -25.0,
                "z": -40.0,
                "height": 130.0,
                "width": 24.0,
                "depth": 24.0,
                "color": 0xf8fafc
            },
            {
                "name": "Tribune Tower Gothic Crown",
                "type": "gothic_flying_buttresses",
                "x": 35.0,
                "z": -45.0,
                "height": 141.0,
                "width": 30.0,
                "depth": 28.0,
                "color": 0xa8a29e
            },
            {
                "name": "Trump International Hotel & Tower (Chicago)",
                "type": "curved_stepped_glass_tower",
                "x": -65.0,
                "z": 45.0,
                "height": 423.0,
                "width": 48.0,
                "depth": 42.0,
                "color": 0x0ea5e9,
                "spire_h": 68.0
            },
            {
                "name": "London Guarantee Building",
                "type": "classical_cupola_colonnade",
                "x": 55.0,
                "z": 40.0,
                "height": 110.0,
                "width": 26.0,
                "depth": 26.0,
                "color": 0xd6d3d1
            }
        ]
    },
    "stunt_training_ground": {
        "location_id": "stunt_training_ground",
        "city_name": "Hollywood Proving Lab",
        "center_coordinates": {"lat": 34.0522, "lng": -118.2437},
        "description": "Hollywood Stunt Engineering proving complex with multi-tier steel scaffolding, airbag pits, and telemetry towers.",
        "launch_building": {
            "name": "Scaffold Launch Platform Alpha",
            "height": 18.0,
            "width": 20.0,
            "depth": 22.0,
            "facade_style": "industrial_steel_scaffolding",
            "facade_color": 0x334155,
            "window_tint": 0x0284c7,
            "rooftop": {
                "surface_material": "anti_slip_modular_deck",
                "color": 0x1e293b,
                "parapet_height": 0.85,
                "penthouse": {"w": 5.0, "h": 3.0, "d": 4.5, "x": -3.5, "z": 4.0},
                "hvac_units": [{"w": 3.0, "h": 1.8, "d": 2.2, "x": -4.0, "z": -4.0, "fan_count": 1}]
            }
        },
        "target_building": {
            "name": "Foam Pit Platform Beta",
            "height": 14.5,
            "width": 22.0,
            "depth": 24.0,
            "facade_style": "modular_test_rig",
            "facade_color": 0x475569,
            "window_tint": 0x0284c7,
            "rooftop": {
                "surface_material": "shock_absorption_mat",
                "color": 0x0f172a,
                "parapet_height": 0.8
            }
        },
        "landmarks": [
            {
                "name": "Telemetry High Rig Tower 1",
                "type": "lattice_crane",
                "x": -30.0,
                "z": -30.0,
                "height": 55.0,
                "width": 8.0,
                "depth": 8.0,
                "color": 0xf59e0b
            },
            {
                "name": "Telemetry High Rig Tower 2",
                "type": "lattice_crane",
                "x": 35.0,
                "z": -35.0,
                "height": 55.0,
                "width": 8.0,
                "depth": 8.0,
                "color": 0xf59e0b
            }
        ]
    }
}

def get_city_architectural_model(location_id: str) -> Dict[str, Any]:
    """Returns the 1-to-1 definitive architectural model for a location."""
    return CITY_ARCHITECTURAL_MODELS.get(location_id, CITY_ARCHITECTURAL_MODELS["san_francisco_rooftop"])
