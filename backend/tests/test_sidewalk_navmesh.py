"""
Comprehensive tests for RoboTwin Urban Sidewalk NavMesh,
Building Obstacle Collision Avoidance, and Ground Drop Physics.
"""

import math
import pytest
from backend.simulation.sidewalk_navmesh import (
    urban_sidewalk_navmesh,
    UrbanSidewalkNavMesh,
    CITY_BUILDING_FOOTPRINTS,
    CITY_SIDEWALK_GRAPHS
)
from backend.simulation.terrain_physics import (
    biomechanical_locomotion,
    terrain_physics_engine
)
from backend.planner.scene_director import (
    scene_director,
    meters_to_lat_lng,
    lat_lng_to_meters
)


def test_building_footprint_collision_detection():
    """Verifies that interior building coordinates are flagged as collisions, and sidewalks are clear."""
    navmesh = UrbanSidewalkNavMesh()

    # 1. Interior of Montgomery Brick Lofts building ([-82, -10], [-2, 32])
    inside_bldg, name = navmesh.is_inside_building(-40.0, 15.0, "san_francisco")
    assert inside_bldg is True
    assert "Brick" in name

    # 2. Interior of 475 Sansome Tower ([10, 80], [-2, 32])
    inside_sansome, name_sansome = navmesh.is_inside_building(35.0, 15.0, "san_francisco")
    assert inside_sansome is True
    assert "475 Sansome" in name_sansome

    # 3. Montgomery Street West Sidewalk (x = -6.0, y = 15.0) -> Must be completely clear!
    inside_sidewalk, _ = navmesh.is_inside_building(-6.0, 15.0, "san_francisco")
    assert inside_sidewalk is False, "Sidewalk must never be flagged as a building interior"


def test_segment_building_collision_avoidance():
    """Verifies that straight paths cutting through buildings are rejected."""
    navmesh = UrbanSidewalkNavMesh()

    # Line segment from (-60, 15) to (30, 15) slices directly through Montgomery Brick Lofts and across street
    collides, name = navmesh.segment_collides_with_buildings((-60.0, 15.0), (30.0, 15.0), "san_francisco")
    assert collides is True

    # Line segment along Montgomery St West Sidewalk from (-6.0, -25.0) to (-6.0, 15.0) is collision free!
    sidewalk_collides, _ = navmesh.segment_collides_with_buildings((-6.0, -25.0), (-6.0, 15.0), "san_francisco")
    assert sidewalk_collides is False, "Walking straight along sidewalk corridor must be collision free"


def test_snap_to_nearest_sidewalk():
    """Verifies arbitrary points (including rooftops) snap to the nearest walkable sidewalk corridor."""
    navmesh = UrbanSidewalkNavMesh()

    # User clicks on roof of building at (-40.0, 45.0)
    snapped = navmesh.snap_to_nearest_sidewalk(-40.0, 45.0, "san_francisco")
    assert snapped is not None
    assert snapped["type"] in ("sidewalk", "plaza", "crosswalk")

    # Snapped coordinate must be outside all building footprints
    is_in_bldg, _ = navmesh.is_inside_building(snapped["x"], snapped["y"], "san_francisco")
    assert is_in_bldg is False, "Snapped position must be completely outside building boundaries"


def test_plan_sidewalk_corridor_path():
    """Verifies A* path planning follows street sidewalk corridors and avoids building interiors."""
    navmesh = UrbanSidewalkNavMesh()

    # Route from Cafe (-8.0, -15.0) to Montgomery Brick Lofts (-8.0, 45.0)
    path = navmesh.plan_sidewalk_path(-8.0, -15.0, -8.0, 45.0, "san_francisco")
    assert len(path) >= 2

    # Every waypoint in path must be outside buildings
    for pt in path:
        is_bldg, _ = navmesh.is_inside_building(pt["x"], pt["y"], "san_francisco")
        assert is_bldg is False, f"Waypoint {pt} penetrated a building footprint"


def test_spawn_and_drop_ground_physics():
    """
    CRITICAL TEST: Ensures that during SPAWN/DROP action:
    1. Humanoid begins in free-fall above ground.
    2. Drops under gravitational acceleration g = 9.81 m/s^2.
    3. Hits the sidewalk surface at t = 0.65s (altitude_offset reaches 0.0m).
    4. Absorbs impact with knee flexion damping and stabilizes.
    """
    sf_lat = 37.7952
    sf_lng = -122.4028

    # Frame 0: Airborne drop start (progress = 0.0)
    f_start = biomechanical_locomotion.compute_humanoid_frame(
        lat=sf_lat,
        lng=sf_lng,
        heading=45.0,
        action="SPAWN",
        frame_time=0.0,
        action_progress=0.0,
        speed=0.0,
        city_id="san_francisco"
    )
    assert f_start["pos"]["altitude_offset"] > 2.0, "Robot must start above ground when dropped"
    assert f_start["terrain_telemetry"]["ground_clamped"] is False

    # Frame Mid: Ground contact impact & athletic shock-absorption squat (progress = 0.45)
    f_impact = biomechanical_locomotion.compute_humanoid_frame(
        lat=sf_lat,
        lng=sf_lng,
        heading=45.0,
        action="SPAWN",
        frame_time=0.9,
        action_progress=0.45,
        speed=0.0,
        city_id="san_francisco"
    )
    assert f_impact["pos"]["altitude_offset"] == 0.0, "Feet must be touching the ground upon impact"
    assert f_impact["terrain_telemetry"]["ground_clamped"] is True
    assert f_impact["joints"]["r_knee"] > 25.0, "Knees must flex to absorb landing kinetic shock"

    # Frame End: Postural equilibrium recovery into upright stance (progress = 0.95)
    f_standing = biomechanical_locomotion.compute_humanoid_frame(
        lat=sf_lat,
        lng=sf_lng,
        heading=45.0,
        action="SPAWN",
        frame_time=1.9,
        action_progress=0.95,
        speed=0.0,
        city_id="san_francisco"
    )
    assert f_standing["pos"]["altitude_offset"] == 0.0, "Robot must be firmly on the sidewalk"
    assert f_standing["terrain_telemetry"]["ground_clamped"] is True
    assert f_standing["joints"]["r_knee"] <= 10.0, "Knees must straighten to upright standing posture"


def test_scene_director_sidewalk_waypoints_avoid_rooftops():
    """
    CRITICAL TEST: Ensures that all waypoints generated by the AI Scene Director
    strictly follow sidewalk networks and NEVER land on rooftops or inside buildings.
    """
    scene = scene_director.plan_scene_from_prompt(
        prompt="A humanoid robot starts near the cafe and walks to the brick apartments, inspects entrance, and scans perimeter.",
        city_id="san_francisco",
        center_lat=37.7952,
        center_lng=-122.4028
    )

    waypoints = scene["waypoints"]
    assert len(waypoints) >= 4

    navmesh = UrbanSidewalkNavMesh()
    for wp in waypoints:
        dx, dy = lat_lng_to_meters(37.7952, -122.4028, wp["lat"], wp["lng"])
        is_bldg, bldg_name = navmesh.is_inside_building(dx, dy, "san_francisco")
        assert is_bldg is False, f"Waypoint '{wp['name']}' at ({dx}, {dy}) is inside {bldg_name} or on its roof!"
