"""
Unit tests for RoboTwin StuntStudio Physics Engine & Geospatial Stunt Simulation.
Validates ballistic trajectory solving, G-force impact physics, safety rig deceleration,
biomechanical survivability scoring, and location catalogs.
"""

import unittest
from backend.simulation.stunt_physics import StuntTrajectorySolver, STUNT_PRESETS
from backend.simulation.stunt_locations import (
    STUNT_LOCATIONS,
    get_all_locations,
    get_location_by_id
)


class TestStuntSimulation(unittest.TestCase):
    def setUp(self):
        self.solver = StuntTrajectorySolver(mass=75.0)

    def test_locations_catalog_completeness(self):
        """Validates that all expected locations exist with metric rooftop parameters."""
        locations = get_all_locations()
        self.assertGreaterEqual(len(locations), 4)

        for loc in locations:
            self.assertIn("id", loc)
            self.assertIn("name", loc)
            self.assertIn("coordinates", loc)
            self.assertIn("rooftop", loc)
            self.assertGreater(loc["rooftop"]["launch_height"], 0.0)
            self.assertGreater(loc["rooftop"]["gap_distance"], 0.0)

    def test_location_by_id(self):
        """Tests lookup by ID with fallback behavior."""
        sf = get_location_by_id("san_francisco_rooftop")
        self.assertEqual(sf["id"], "san_francisco_rooftop")
        self.assertEqual(sf["city"], "San Francisco, CA")

        # Unknown ID falls back safely to training ground
        fallback = get_location_by_id("unknown_alien_planet")
        self.assertEqual(fallback["id"], "stunt_training_ground")

    def test_ballistic_flight_trajectory(self):
        """Validates physics equations of motion for parabolic rooftop jump."""
        res = self.solver.solve_trajectory(
            stunt_type="ROOFTOP_GAP_LEAP",
            takeoff_pos=(0.0, 0.0, 30.0),
            target_pos=(10.0, 0.0, 26.0),
            run_speed=8.0,
            pitch_deg=15.0,
            flips=1,
            safety_rig="NONE"
        )

        self.assertIn("flight_time", res)
        self.assertGreater(res["flight_time"], 0.5)
        self.assertGreater(res["apex_altitude"], 30.0)
        self.assertGreater(len(res["frames"]), 10)
        self.assertAlmostEqual(res["landing_coords"][2], 26.0, delta=0.5)

    def test_airbag_deceleration_safety(self):
        """Verifies that high-volume stunt airbag limits deceleration to safe G-forces."""
        res = self.solver.solve_trajectory(
            stunt_type="HIGH_FALL_AIRBAG",
            takeoff_pos=(0.0, 0.0, 20.0),
            target_pos=(0.0, 0.0, 0.0),
            run_speed=2.5,
            pitch_deg=0.0,
            flips=0,
            safety_rig="AIRBAG",
            airbag_height=2.5
        )

        telemetry = res["telemetry"]
        self.assertIn("CLEARED", telemetry["verdict"])
        self.assertLess(telemetry["peak_g_force"], 18.0)
        self.assertGreater(telemetry["survivability_pct"], 85.0)

    def test_bare_impact_fatal_consequences(self):
        """Confirms that free-fall drops onto bare concrete reflect catastrophic deceleration."""
        res = self.solver.solve_trajectory(
            stunt_type="HIGH_FALL_AIRBAG",
            takeoff_pos=(0.0, 0.0, 35.0),
            target_pos=(0.0, 0.0, 0.0),
            run_speed=2.0,
            pitch_deg=0.0,
            flips=0,
            safety_rig="NONE"
        )

        telemetry = res["telemetry"]
        self.assertIn("CATASTROPHIC", telemetry["verdict"])
        self.assertGreater(telemetry["peak_g_force"], 50.0)
        self.assertEqual(telemetry["survivability_pct"], 0.0)

    def test_wire_harness_arrest(self):
        """Verifies calibrated wire harness arrest deceleration."""
        res = self.solver.solve_trajectory(
            stunt_type="BASE_JUMP_WIRE_ARREST",
            takeoff_pos=(0.0, 0.0, 50.0),
            target_pos=(0.0, 0.0, 0.0),
            run_speed=4.0,
            pitch_deg=10.0,
            flips=0,
            safety_rig="WIRE_HARNESS",
            wire_catch_height=10.0
        )

        telemetry = res["telemetry"]
        self.assertIn("CLEARED", telemetry["verdict"])
        self.assertLess(telemetry["peak_g_force"], 20.0)
        self.assertGreater(telemetry["survivability_pct"], 80.0)

    def test_presets_validity(self):
        """Validates that all stunt presets contain required physics fields."""
        self.assertIn("ROOFTOP_GAP_LEAP", STUNT_PRESETS)
        self.assertIn("HERO_LANDING", STUNT_PRESETS)
        self.assertIn("BASE_JUMP_WIRE_ARREST", STUNT_PRESETS)

        for preset_id, preset in STUNT_PRESETS.items():
            self.assertIn("name", preset)
            self.assertIn("default_run_speed", preset)
            self.assertIn("default_pitch_deg", preset)
            self.assertGreater(preset["default_run_speed"], 0.0)


if __name__ == "__main__":
    unittest.main()
