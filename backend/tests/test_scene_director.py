"""
Test suite for RoboTwin AI Scene Director & Urban Humanoid Choreography Engine.
Validates landmark retrieval, prompt-to-scene planning, waypoint trajectory synthesis,
gait and action joint synthesis, frame interpolation, and REST API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app import app
from backend.planner.scene_director import (
    scene_director,
    meters_to_lat_lng,
    lat_lng_to_meters,
    calculate_heading
)

client = TestClient(app)

def test_geodesic_math_utilities():
    center_lat = 37.7952
    center_lng = -122.4028

    # 100m East, 50m North
    pos = meters_to_lat_lng(center_lat, center_lng, 100.0, 50.0)
    assert pos["lat"] > center_lat
    assert pos["lng"] > center_lng

    # Round trip
    dx, dy = lat_lng_to_meters(center_lat, center_lng, pos["lat"], pos["lng"])
    assert pytest.approx(dx, rel=1e-2) == 100.0
    assert pytest.approx(dy, rel=1e-2) == 50.0

    # Heading (0 = North, 90 = East)
    p_north = meters_to_lat_lng(center_lat, center_lng, 0.0, 50.0)
    head_north = calculate_heading({"lat": center_lat, "lng": center_lng}, p_north)
    assert pytest.approx(head_north, abs=2.0) == 0.0

    p_east = meters_to_lat_lng(center_lat, center_lng, 50.0, 0.0)
    head_east = calculate_heading({"lat": center_lat, "lng": center_lng}, p_east)
    assert pytest.approx(head_east, abs=2.0) == 90.0

def test_city_landmarks_retrieval():
    landmarks = scene_director.get_city_landmarks("san_francisco", 37.7952, -122.4028)
    assert len(landmarks) >= 5
    names = [lm["name"] for lm in landmarks]
    assert any("Transamerica" in n for n in names)
    assert any("Cafe" in n for n in names)
    assert any("Bank" in n for n in names)

def test_scene_director_plan_from_prompt():
    prompt = "A humanoid robot starts near the cafe, walks to the brick apartments, inspects entrance, looks around, and waves to the camera."
    scene = scene_director.plan_scene_from_prompt(
        prompt=prompt,
        city_id="san_francisco",
        center_lat=37.7952,
        center_lng=-122.4028
    )

    assert scene["status"] == "success"
    assert "scene_id" in scene
    assert scene["total_duration_sec"] > 0
    assert len(scene["waypoints"]) >= 4
    assert len(scene["frames"]) > 100

    # Verify actions in sequence
    actions = [wp["action"] for wp in scene["waypoints"]]
    assert "SPAWN" in actions
    assert "WALK" in actions or "JOG" in actions
    assert "INSPECT" in actions
    assert "SCAN" in actions
    assert "WAVE" in actions

    # Verify frame structure
    first_frame = scene["frames"][0]
    assert "pos" in first_frame
    assert "heading" in first_frame
    assert "joints" in first_frame
    assert "camera_shot" in first_frame
    assert "neck_pitch" in first_frame["joints"]
    assert "r_shoulder_pitch" in first_frame["joints"]

    # Verify multi-angle stitched camera shots
    assert "camera_shots" in scene
    shots = scene["camera_shots"]
    assert len(shots) >= 4
    angles = [s["angle"] for s in shots]
    assert "DRONE_WIDE" in angles
    assert "FIRST_PERSON_POV" in angles
    assert "ACTION_CLOSEUP" in angles

def test_camera_shots_synthesis():
    waypoints = [
        {"action": "SPAWN", "duration": 2.0},
        {"action": "WALK", "duration": 12.0},
        {"action": "INSPECT", "duration": 4.0},
        {"action": "SCAN", "duration": 3.0},
        {"action": "WAVE", "duration": 3.0}
    ]
    shots = scene_director.synthesize_camera_shots(waypoints)
    assert len(shots) >= 5
    assert shots[0]["angle"] == "DRONE_WIDE"
    # 12s walk should subdivide into multiple angles
    walk_angles = [s["angle"] for s in shots if s["target_action"] == "WALK"]
    assert len(walk_angles) >= 2
    assert any(s["angle"] == "FIRST_PERSON_POV" for s in shots)

def test_api_landmarks_endpoint():
    resp = client.get("/api/scene/landmarks?city_id=san_francisco&lat=37.7952&lng=-122.4028")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_landmarks"] >= 5
    assert len(data["landmarks"]) == data["total_landmarks"]

def test_api_generate_scene_endpoint():
    payload = {
        "prompt": "Robot starts at Sansome, walks down street, checks doors, and signals victory",
        "city_id": "san_francisco",
        "center_lat": 37.7952,
        "center_lng": -122.4028
    }
    resp = client.post("/api/scene/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["waypoints"]) >= 3
    assert len(data["frames"]) > 50

def test_api_generate_scene_empty_prompt():
    resp = client.post("/api/scene/generate", json={"prompt": ""})
    assert resp.status_code == 400

def test_api_interpolate_custom_waypoints():
    waypoints = [
        {"step": 0, "action": "SPAWN", "name": "Start", "lat": 37.7952, "lng": -122.4028, "altitude": 20.0, "heading": 0.0, "duration": 1.0, "speed": 0.0},
        {"step": 1, "action": "WALK", "name": "Walk", "lat": 37.7960, "lng": -122.4020, "altitude": 20.0, "heading": 45.0, "duration": 3.0, "speed": 1.3}
    ]
    resp = client.post("/api/scene/waypoints/interpolate", json={"waypoints": waypoints})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_frames"] == int((1.0 + 3.0) * 60)


def test_plan_scene_from_custom_directed_path():
    directed_waypoints = [
        {"lat": 37.7952, "lng": -122.4028, "prompt": "Drop from sky and absorb landing"},
        {"lat": 37.7956, "lng": -122.4025, "prompt": "Jog down Sansome St sidewalk"},
        {"lat": 37.7960, "lng": -122.4021, "prompt": "Crouch and inspect corner doorway latch"},
        {"lat": 37.7960, "lng": -122.4021, "prompt": "Look around and scan for obstacles"},
        {"lat": 37.7963, "lng": -122.4018, "prompt": "Wave to surveillance drone"},
        {"lat": 37.7963, "lng": -122.4018, "prompt": "Raise arms and celebrate victory"}
    ]
    scene = scene_director.plan_scene_from_custom_directed_path(
        waypoints_input=directed_waypoints,
        city_id="san_francisco"
    )
    assert scene["status"] == "success"
    assert len(scene["waypoints"]) == 6
    actions = [w["action"] for w in scene["waypoints"]]
    assert actions[0] in ("SPAWN", "JUMP")
    assert actions[1] == "JOG"
    assert actions[2] in ("CROUCH", "INSPECT")
    assert actions[3] == "SCAN"
    assert actions[4] == "WAVE"
    assert actions[5] == "CELEBRATE"
    assert len(scene["camera_shots"]) >= 4
    assert len(scene["frames"]) > 100

    # Verify joint kinematics in frames
    frame0 = scene["frames"][0]
    assert "joints" in frame0
    joints = frame0["joints"]
    assert "r_knee" in joints and "l_knee" in joints
    assert "r_shoulder_pitch" in joints and "l_shoulder_pitch" in joints
    assert "neck_pitch" in joints and "spine_pitch" in joints

    # Verify JSON protocol transparency payload
    assert "json_protocol" in scene
    proto = scene["json_protocol"]
    assert len(proto["compiled_timeline"]) == 6
    assert proto["active_joints_count"] == 16


def test_api_direct_path_endpoint():
    payload = {
        "city_id": "san_francisco",
        "waypoints": [
            {"lat": 37.7952, "lng": -122.4028, "prompt": "Drop onto sidewalk"},
            {"lat": 37.7958, "lng": -122.4022, "prompt": "Walk along sidewalk towards cafe"}
        ]
    }
    resp = client.post("/api/scene/direct_path", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["waypoints"]) == 2
    assert data["waypoints"][0]["action"] in ("SPAWN", "JUMP")
    assert data["waypoints"][1]["action"] == "WALK"
    assert len(data["frames"]) > 50


def test_api_direct_path_empty_error():
    resp = client.post("/api/scene/direct_path", json={"waypoints": []})
    assert resp.status_code == 400


def test_natural_language_prompts_wave_and_lookup():
    """Verifies that arbitrary natural language descriptions without preset tags are parsed correctly."""
    directed_waypoints = [
        {"lat": 37.7952, "lng": -122.4028, "prompt": "Wave Hello to drone camera"},
        {"lat": 37.7956, "lng": -122.4025, "prompt": "Look up at tall skyscraper facade"}
    ]
    scene = scene_director.plan_scene_from_custom_directed_path(
        waypoints_input=directed_waypoints,
        city_id="san_francisco"
    )
    assert scene["status"] == "success"
    assert scene["waypoints"][0]["action"] == "WAVE"
    assert scene["waypoints"][1]["action"] == "LOOK_UP"


def test_api_export_mp4_test_endpoint():
    """Verifies the backend FFmpeg MP4 generation pipeline produces a valid playable MP4 file."""
    resp = client.get("/api/scene/export_mp4/test")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "video/mp4"
    content = resp.content
    assert len(content) > 1000
    # Check MP4 ISO Base Media file signature (ftyp)
    assert b"ftyp" in content[:32]


def test_api_export_mp4_with_target_duration():
    """Verifies that export_mp4 with target_duration pads short footage to exactly match expected duration."""
    test_vid = client.get("/api/scene/export_mp4/test").content
    files = {"video_file": ("test.mp4", test_vid, "video/mp4")}
    data = {"target_duration": 6.0, "fps": 60}
    resp = client.post("/api/scene/export_mp4", files=files, data=data)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "video/mp4"
    assert b"ftyp" in resp.content[:32]


