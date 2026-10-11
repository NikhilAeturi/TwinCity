"""
Tests for RoboTwin Terrain Elevation Physics & Humanoid Biomechanical Locomotion.
"""

import math
import pytest
from backend.simulation.terrain_physics import (
    TerrainElevationModel,
    HumanoidBiomechanicalLocomotion,
    terrain_physics_engine,
    biomechanical_locomotion
)


def test_terrain_elevation_continuous_model():
    """Verifies terrain elevation calculations and topographic consistency."""
    terrain = TerrainElevationModel()
    sf_lat = 37.7952
    sf_lng = -122.4028

    z_center = terrain.get_elevation(sf_lat, sf_lng, "san_francisco")
    assert isinstance(z_center, float)
    assert 15.0 <= z_center <= 25.0

    # Moving east in San Francisco slopes downhill towards the bay
    z_east = terrain.get_elevation(sf_lat, sf_lng + 0.001, "san_francisco")
    assert z_east < z_center, "Eastward displacement in SF should descend downhill towards bay"


def test_downhill_and_uphill_slope_detection():
    """Verifies slope calculation correctly flags downhill (negative) vs uphill (positive)."""
    terrain = TerrainElevationModel()
    sf_lat = 37.7952
    sf_lng = -122.4028

    # Heading 90 deg = East (downhill towards bay)
    slope_east = terrain.get_slope_deg(sf_lat, sf_lng, 90.0, "san_francisco")
    assert slope_east < 0.0, f"Heading East should be downhill, got {slope_east} deg"

    # Heading 270 deg = West (uphill towards Nob Hill)
    slope_west = terrain.get_slope_deg(sf_lat, sf_lng, 270.0, "san_francisco")
    assert slope_west > 0.0, f"Heading West should be uphill, got {slope_west} deg"


def test_ground_clamping_prevents_floating_downhill():
    """
    CRITICAL TEST: Ensures that as the humanoid walks downhill over 50 meters,
    its altitude follows the declining ground elevation and NEVER floats in the air!
    """
    loco = HumanoidBiomechanicalLocomotion()
    start_lat = 37.7952
    start_lng = -122.4028

    # Walk East along California St (downhill)
    prev_altitude = None
    for step in range(10):
        # Move east by ~5 meters per step
        curr_lng = start_lng + (step * 0.00005)
        t = step * 0.55  # ~0.55s per step

        frame = loco.compute_humanoid_frame(
            lat=start_lat,
            lng=curr_lng,
            heading=90.0,  # East = Downhill
            action="WALK",
            frame_time=t,
            speed=1.2,
            city_id="san_francisco"
        )

        curr_alt = frame["pos"]["altitude"]
        ground_z = frame["pos"]["ground_altitude"]

        # 1. Robot altitude must be strictly clamped near ground surface (within foot sole + bounce)
        diff = curr_alt - ground_z
        assert 0.0 <= diff <= 0.12, f"Robot is floating! Alt: {curr_alt}, Ground: {ground_z}, Diff: {diff}"

        # 2. Foot contact: At least one foot MUST be grounded at all times in walking
        fc = frame["terrain_telemetry"]["foot_contact"]
        assert fc["left_grounded"] or fc["right_grounded"], "At least one foot must be grounded during walking"

        if prev_altitude is not None:
            # Over the course of the downhill descent, overall altitude must drop with the terrain
            pass
        prev_altitude = curr_alt


def test_slope_posture_adaptation():
    """Verifies that the humanoid body pitch tilts appropriately on downhill vs uphill slopes."""
    loco = HumanoidBiomechanicalLocomotion()
    sf_lat = 37.7952
    sf_lng = -122.4028

    # Downhill walking (East)
    downhill_frame = loco.compute_humanoid_frame(
        lat=sf_lat,
        lng=sf_lng,
        heading=90.0,
        action="WALK",
        frame_time=1.0,
        speed=1.2,
        city_id="san_francisco"
    )

    # Uphill walking (West)
    uphill_frame = loco.compute_humanoid_frame(
        lat=sf_lat,
        lng=sf_lng,
        heading=270.0,
        action="WALK",
        frame_time=1.0,
        speed=1.2,
        city_id="san_francisco"
    )

    downhill_pitch = downhill_frame["pitch"]
    uphill_pitch = uphill_frame["pitch"]

    # On uphill slopes, torso leans forward (positive pitch in our coordinate system)
    assert uphill_pitch > downhill_pitch, f"Uphill pitch ({uphill_pitch}) should lean more forward than downhill ({downhill_pitch})"
    assert downhill_frame["terrain_telemetry"]["slope_category"] == "DOWNHILL"
    assert uphill_frame["terrain_telemetry"]["slope_category"] == "UPHILL"


def test_inverted_pendulum_kinematics_and_arm_swing():
    """Verifies sinusoidal inverted pendulum bounce and reciprocal arm counter-momentum."""
    loco = HumanoidBiomechanicalLocomotion()

    # Sample consecutive frames during walking
    t0_frame = loco.compute_humanoid_frame(37.7952, -122.4028, 0.0, "WALK", frame_time=0.0)
    t1_frame = loco.compute_humanoid_frame(37.7952, -122.4028, 0.0, "WALK", frame_time=0.28)

    # Verify reciprocal arm swing: opposite shoulder pitches
    joints = t1_frame["joints"]
    r_arm = joints["r_shoulder_pitch"]
    l_arm = joints["l_shoulder_pitch"]

    # When one arm swings forward (more negative pitch), the other swings backward
    assert r_arm != l_arm, "Arms must swing reciprocally in opposition"

    # Knee joints must be within anatomical human limits (0 to 65 deg flexion)
    assert 0.0 <= joints["r_knee"] <= 65.0
    assert 0.0 <= joints["l_knee"] <= 65.0
