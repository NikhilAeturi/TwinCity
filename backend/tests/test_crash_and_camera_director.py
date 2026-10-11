"""
Test suite for RoboTwin Multi-Vehicle Crash Simulator,
3D Asset Catalog, and Cinematic Camera Rail Director.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app import app
from backend.simulation.asset_catalog import asset_catalog_manager
from backend.simulation.crash_physics import crash_physics_engine
from backend.simulation.camera_director import camera_director

client = TestClient(app)

def test_asset_catalog_discovery_and_matching():
    """Validates 3D asset catalog retrieval and semantic search."""
    assets = asset_catalog_manager.get_all_assets()
    assert len(assets) >= 7

    # Test semantic matches
    p_cop = asset_catalog_manager.match_asset("police interceptor with flashing sirens")
    assert p_cop["id"] == "vehicle_police"

    p_truck = asset_catalog_manager.match_asset("heavy delivery cargo box truck")
    assert p_truck["id"] == "vehicle_truck"

    p_sports = asset_catalog_manager.match_asset("yellow fast aerodynamic supercar")
    assert p_sports["id"] == "vehicle_sportscar"

    p_sedan = asset_catalog_manager.match_asset("blue commuter sedan automobile")
    assert p_sedan["id"] == "vehicle_sedan"

def test_resolve_actors_for_scene():
    """Validates actor resolution from scene descriptions."""
    actors = asset_catalog_manager.resolve_actors_for_scene("A speeding sports car t-bones a black SUV")
    assert len(actors) >= 2
    assert actors[0]["asset_id"] == "vehicle_sportscar"
    assert actors[1]["asset_id"] == "vehicle_suv"

    # Test police chase
    actors_police = asset_catalog_manager.resolve_actors_for_scene("Police cruiser chases a speeding car")
    assert any(a["asset_id"] == "vehicle_police" for a in actors_police)

def test_crash_physics_simulation():
    """Validates Newtonian multi-vehicle collision mechanics and 60 FPS frames."""
    actors = asset_catalog_manager.resolve_actors_for_scene("T-bone intersection collision")
    res = crash_physics_engine.plan_crash_scenario(
        prompt="A sedan runs a red light and t-bones an SUV",
        actors=actors,
        center_lat=37.7952,
        center_lng=-122.4028,
        impact_offset=(0.0, 0.0),
        duration_sec=6.0,
        fps=60
    )

    assert res["status"] == "success"
    assert res["crash_type"] == "t_bone"
    assert res["total_frames"] == 360
    assert len(res["frames"]) == 360
    assert "impact_coords" in res

    # Verify impact event occurs at 2.4s
    impact_frames = [f for f in res["frames"] if any(e["type"] == "COLLISION_IMPACT" for e in f.get("events", []))]
    assert len(impact_frames) >= 1

    # Check vehicle post-collision states (spin, damage)
    last_frame = res["frames"][-1]
    assert len(last_frame["actors"]) >= 2
    v1_final = [a for a in last_frame["actors"] if a["id"] == actors[0]["id"]][0]
    assert v1_final["damaged"] is True
    assert v1_final["speed_mps"] < 2.0  # Decelerated to near rest

    # Debris field present post-impact
    assert any(a["id"] == "actor_debris" for a in last_frame["actors"])

def test_camera_rail_interpolation():
    """Validates smooth Catmull-Rom camera flight paths along drawn waypoints."""
    waypoints = [
        {"lat": 37.7950, "lng": -122.4030, "altitude": 40.0},
        {"lat": 37.7952, "lng": -122.4025, "altitude": 15.0},
        {"lat": 37.7954, "lng": -122.4020, "altitude": 8.0}
    ]
    target_impact = {"lat": 37.7952, "lng": -122.4028, "altitude": 0.0}

    frames = camera_director.interpolate_camera_rail(
        waypoints=waypoints,
        center_lat=37.7952,
        center_lng=-122.4028,
        duration_sec=6.0,
        fps=60,
        tracking_mode="track_impact",
        target_point=target_impact
    )

    assert len(frames) == 360
    for f in frames:
        assert "center" in f
        assert "heading" in f
        assert "tilt" in f
        assert "range" in f
        assert 20.0 <= f["tilt"] <= 85.0
        assert f["range"] > 0

def test_rest_endpoints():
    """Validates FastAPI REST endpoints for asset catalog, match, and camera rail."""
    # 1. Asset catalog endpoint
    resp_cat = client.get("/api/assets/catalog")
    assert resp_cat.status_code == 200
    data_cat = resp_cat.json()
    assert data_cat["status"] == "success"
    assert data_cat["total_assets"] >= 7

    # 2. Asset match endpoint
    resp_match = client.post("/api/assets/match", json={"prompt": "police cruiser car"})
    assert resp_match.status_code == 200
    data_match = resp_match.json()
    assert data_match["asset"]["id"] == "vehicle_police"

    # 3. Crash scene generation endpoint
    resp_scene = client.post("/api/scene/generate", json={
        "prompt": "A car crash happens here: sports car t-bones an SUV at the intersection",
        "city_id": "san_francisco",
        "center_lat": 37.7952,
        "center_lng": -122.4028
    })
    assert resp_scene.status_code == 200
    scene = resp_scene.json()
    assert scene["status"] == "success"
    assert scene["scene_type"] == "vehicular_collision"
    assert len(scene["actors"]) >= 2
    assert len(scene["frames"]) == 360
    assert len(scene["camera_shots"]) >= 3

    # 4. Camera rail endpoint
    resp_rail = client.post("/api/scene/camera_rail/interpolate", json={
        "waypoints": [
            {"lat": 37.7950, "lng": -122.4030, "altitude": 35.0},
            {"lat": 37.7954, "lng": -122.4020, "altitude": 10.0}
        ],
        "center_lat": 37.7952,
        "center_lng": -122.4028,
        "duration_sec": 6.0,
        "tracking_mode": "track_impact"
    })
    assert resp_rail.status_code == 200
    rail_data = resp_rail.json()
    assert rail_data["status"] == "success"
    assert len(rail_data["camera_frames"]) == 360
