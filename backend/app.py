"""
RoboTwin FastAPI & WebSocket Backend Server
Serves 3D scene data, handles phone camera perception streams, real-time depth estimation,
3D point cloud environment reconstruction, plans humanoid tasks, and streams physics telemetry.
"""

import os
import json
import base64
import socket
import asyncio
import logging
import cv2
import numpy as np
import subprocess
import tempfile
import time
import shutil
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from backend.simulation.engine import SimulationEngine
from backend.planner.task_planner import TaskPlanner
from backend.perception import DepthEstimator, PointCloudReconstructor, FurnitureDetector
from backend.simulation.stunt_physics import stunt_solver, STUNT_PRESETS
from backend.simulation.stunt_locations import (
    STUNT_LOCATIONS,
    get_all_locations,
    get_location_by_id
)
from backend.simulation.city_models import get_city_architectural_model, CITY_ARCHITECTURAL_MODELS
from backend.planner.scene_director import scene_director
from backend.simulation.asset_catalog import asset_catalog_manager
from backend.simulation.camera_director import camera_director
from backend.simulation.object_physics import object_physics_engine

# Resolve project root directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCENES_DIR = os.path.join(BASE_DIR, "models", "scenes")
ROBOT_XML = os.path.join(BASE_DIR, "models", "robot", "humanoid.xml")
UPLOADS_DIR = os.path.join(BASE_DIR, "models", "scenes", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(
    title="TwinCity Director API",
    description="Cinematic shot simulation and movie directing platform with real-time 3D environment ingestion",
    version="1.1.0"
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize simulation engine and task planner
engine = SimulationEngine(SCENES_DIR, ROBOT_XML)
planner = TaskPlanner(engine.scene_config)

# Initialize real-time perception pipeline
depth_estimator = DepthEstimator(preferred_engine="depth_anything_v2")
reconstructor = PointCloudReconstructor(voxel_size=0.03, max_points=120_000)
furniture_detector = FurnitureDetector()
latest_furniture_layout = {"table": None, "chairs": [], "tables": [], "layout_summary": "Awaiting phone camera scan", "status": "EMPTY"}

# Real-time state synchronization counters
scene_version = 1
scan_version = 1

# Start background MuJoCo physics stepping loop
engine.start_loop()


def get_local_ip() -> str:
    """Discovers the LAN IP address for phone pairing."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_ngrok_url() -> Optional[str]:
    """Queries local ngrok API (port 4040) to discover active public HTTPS tunnel."""
    try:
        import urllib.request
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={"User-Agent": "curl/7.0"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            data = json.loads(resp.read().decode())
            for t in data.get("tunnels", []):
                if t.get("proto") == "https":
                    return t.get("public_url")
    except Exception:
        pass
    return None


class CommandRequest(BaseModel):
    prompt: str


class ObjectUpdateRequest(BaseModel):
    id: str
    position: list[float]
    size: Optional[list[float]] = None
    movable: Optional[bool] = None


class SpeedRequest(BaseModel):
    multiplier: float


class EngineRequest(BaseModel):
    engine: str


class FrameUploadRequest(BaseModel):
    image: str
    orientation: Optional[Dict[str, float]] = None


class StuntPlanRequest(BaseModel):
    location_id: str = "san_francisco_rooftop"
    stunt_type: str = "ROOFTOP_GAP_LEAP"
    run_speed: Optional[float] = None
    launch_speed: Optional[float] = None
    pitch_deg: Optional[float] = None
    launch_pitch_deg: Optional[float] = None
    flips: Optional[int] = None
    num_rotations: Optional[int] = None
    safety_rig: Optional[str] = None
    custom_takeoff: Optional[list[float]] = None
    custom_target: Optional[list[float]] = None


class StuntExecuteRequest(BaseModel):
    stunt_plan: Optional[Dict[str, Any]] = None
    speed_multiplier: float = 1.0


# Stunt Previs State
active_stunt_plan: Optional[Dict[str, Any]] = None
latest_stunt_report: Optional[Dict[str, Any]] = None



@app.get("/api/health")
def get_health():
    return {
        "status": "online",
        "engine": "MuJoCo 3.15",
        "humanoid": "RoboTwin 29-DoF Articulated Humanoid",
        "perception": depth_estimator.get_status(),
        "sim_time": engine.get_telemetry_snapshot().get("sim_time", 0.0)
    }


@app.get("/api/network_info")
def get_network_info():
    ip = get_local_ip()
    ngrok_url = get_ngrok_url()

    # If ngrok HTTPS tunnel is active, default to it because iOS Safari & Android Chrome
    # strictly mandate a Secure Context (HTTPS) to allow getUserMedia live video streams.
    phone_url = f"{ngrok_url}/phone" if ngrok_url else f"http://{ip}:5173/phone"

    return {
        "local_ip": ip,
        "ngrok_url": ngrok_url,
        "is_https": bool(ngrok_url),
        "phone_url": phone_url,
        "phone_http_url": f"http://{ip}:5173/phone",
        "phone_https_url": f"{ngrok_url}/phone" if ngrok_url else None,
        "backend_url": f"http://{ip}:8000",
        "ws_phone_url": f"ws://{ip}:8000/ws/phone_feed"
    }



@app.get("/api/scene")
def get_scene():
    return {
        "scene_config": engine.scene_config,
        "telemetry": engine.get_telemetry_snapshot(),
        "scan_summary": reconstructor.get_point_cloud_summary()
    }


@app.post("/api/scene/reset")
def reset_scene():
    engine.reset_simulation()
    return {"status": "reset", "message": "Simulation reset to initial state"}


@app.post("/api/scene/object")
def update_object(req: ObjectUpdateRequest):
    found = False
    for obj in engine.scene_config.get("objects", []):
        if obj["id"] == req.id:
            obj["position"] = req.position
            if req.size is not None:
                obj["size"] = req.size
            if req.movable is not None:
                obj["movable"] = req.movable
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"Object {req.id} not found")

    engine.builder.save_scene_config(engine.scene_config)
    engine.load_scene("default_room.json")
    planner.update_scene_config(engine.scene_config)
    return {"status": "updated", "object": req.id}


@app.post("/api/plan")
def plan_task(req: CommandRequest):
    plan = planner.plan_from_text(req.prompt)
    return plan


@app.post("/api/execute")
def execute_task(req: CommandRequest):
    plan = planner.plan_from_text(req.prompt)
    engine.set_task_plan(plan)
    return {
        "status": "executing",
        "plan": plan
    }


@app.post("/api/control/pause")
def toggle_pause():
    engine.is_paused = not engine.is_paused
    return {"paused": engine.is_paused}


@app.post("/api/control/speed")
def set_speed(req: SpeedRequest):
    engine.speed_multiplier = max(0.2, min(5.0, req.multiplier))
    return {"speed_multiplier": engine.speed_multiplier}


@app.post("/api/control/step")
def single_step():
    engine.step(0.01)
    return {"status": "stepped", "sim_time": engine.data.time}


# --- RoboTwin StuntStudio Geospatial & Physics Endpoints ---

@app.get("/api/stunt/locations")
def api_get_stunt_locations():
    """Returns catalog of pre-configured real-world geospatial digital twin locations."""
    return {"locations": get_all_locations()}


@app.get("/api/stunt/presets")
def api_get_stunt_presets():
    """Returns catalog of stunt maneuvers with default physical parameters."""
    return {"presets": STUNT_PRESETS}


@app.get("/api/stunt/city_model/{location_id}")
def api_get_city_model(location_id: str):
    """Returns 1-to-1 definitive architectural model, rooftop equipment, and landmarks for location."""
    return {"city_model": get_city_architectural_model(location_id)}


@app.post("/api/stunt/plan")
def api_plan_stunt(req: StuntPlanRequest):
    """
    Solves full ballistic trajectory, angular momentum conservation,
    G-force deceleration, and joint torque strain for chosen parameters.
    """
    global active_stunt_plan, latest_stunt_report
    loc = get_location_by_id(req.location_id)
    preset = STUNT_PRESETS.get(req.stunt_type, STUNT_PRESETS["ROOFTOP_GAP_LEAP"])

    speed = req.run_speed if req.run_speed is not None else (req.launch_speed if req.launch_speed is not None else float(preset["default_run_speed"]))
    pitch = req.pitch_deg if req.pitch_deg is not None else (req.launch_pitch_deg if req.launch_pitch_deg is not None else float(preset["default_pitch_deg"]))
    flips = req.flips if req.flips is not None else (req.num_rotations if req.num_rotations is not None else int(preset["default_flips"]))
    rig = req.safety_rig if req.safety_rig is not None else preset["safety_rig"]

    if req.custom_takeoff:
        takeoff = tuple(req.custom_takeoff)
    else:
        h0 = float(loc["rooftop"]["launch_height"])
        takeoff = (0.0, 0.0, h0)

    if req.custom_target:
        target = tuple(req.custom_target)
    else:
        h1 = float(loc["rooftop"]["target_height"])
        gap = float(loc["rooftop"]["gap_distance"])
        target = (gap, 0.0, h1)

    plan = stunt_solver.solve_trajectory(
        stunt_type=req.stunt_type,
        takeoff_pos=takeoff,
        target_pos=target,
        run_speed=speed,
        pitch_deg=pitch,
        flips=flips,
        safety_rig=rig,
        airbag_height=float(loc["rooftop"].get("parapet_height", 1.0)) + 1.8,
        wire_catch_height=max(5.0, float(loc["street_drop"]["total_depth"]) * 0.25)
    )
    plan["location"] = loc
    active_stunt_plan = plan
    latest_stunt_report = plan["telemetry"]
    return plan


@app.get("/api/stunt/report")
def api_get_stunt_report():
    """Returns the latest stunt engineering and safety certification report."""
    global active_stunt_plan, latest_stunt_report
    if not active_stunt_plan:
        loc = get_location_by_id("san_francisco_rooftop")
        h0 = float(loc["rooftop"]["launch_height"])
        h1 = float(loc["rooftop"]["target_height"])
        gap = float(loc["rooftop"]["gap_distance"])
        plan = stunt_solver.solve_trajectory(
            stunt_type="ROOFTOP_GAP_LEAP",
            takeoff_pos=(0.0, 0.0, h0),
            target_pos=(gap, 0.0, h1),
            run_speed=7.8,
            pitch_deg=18.0,
            flips=1,
            safety_rig="NONE"
        )
        plan["location"] = loc
        active_stunt_plan = plan
        latest_stunt_report = plan["telemetry"]
        return plan
    return active_stunt_plan


@app.post("/api/stunt/reset")
def api_reset_stunt():
    """Resets stunt trajectory state to takeoff origin."""
    global active_stunt_plan, latest_stunt_report
    active_stunt_plan = None
    latest_stunt_report = None
    return {"status": "stunt_reset"}


# --- Perception & Real-Time Phone Feed Endpoints ---


@app.get("/api/scan/status")
def get_scan_status():
    return {
        "perception_engine": depth_estimator.get_status(),
        "reconstructor": reconstructor.get_point_cloud_summary(),
        "surfaces": reconstructor.detected_surfaces,
        "total_points": len(reconstructor.all_points),
        "frame_count": reconstructor.frame_count
    }


@app.get("/api/scan/pointcloud")
def get_scan_pointcloud():
    """Returns 3D point cloud array, solid surface mesh, and room dimensions for Three.js."""
    pc = reconstructor.get_point_cloud_data(max_display=45_000)
    pc["mesh"] = reconstructor.get_mesh_data()
    pc["room_dimensions"] = reconstructor.room_dimensions
    return pc


@app.get("/api/environment/mesh")
def get_environment_mesh():
    """Returns 3D solid surface mesh (vertices, faces, vertex colors, normals) & room dimensions."""
    return reconstructor.get_mesh_data()


@app.post("/api/scan/engine")
def set_depth_engine(req: EngineRequest):
    depth_estimator.set_engine(req.engine)
    return {"status": "updated", "perception_engine": depth_estimator.get_status()}


@app.get("/api/furniture/layout")
def get_furniture_layout():
    """Returns detected 3D furniture layout (table + scattered chairs & target tuck-in slots)."""
    return latest_furniture_layout


@app.post("/api/scan/frame")
def upload_scan_frame(req: FrameUploadRequest):
    """
    Processes a single high-resolution mobile camera photo or video frame.
    Runs Depth Anything V2 monocular depth estimation, integrates points,
    detects 3D furniture entities (Table + Scattered Chairs),
    and returns segmented surfaces & colorized depth preview.
    """
    global scan_version, scene_version, latest_furniture_layout
    img_data = req.image
    if "," in img_data:
        img_data = img_data.split(",")[1]
    try:
        frame_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode failed: {e}")

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # 1. Monocular Depth Estimation
    depth_map = depth_estimator.estimate_depth(frame)

    # 2. 6-DoF Spatial Odometry, Multi-Entity Recognition & 3D Model Anchoring
    res = reconstructor.process_frame(frame, depth_map, orientation=req.orientation, subsample=2)

    # 3. Synchronize detected 3D models directly to MuJoCo physics and simulation
    new_scene = reconstructor.generate_scene_config()
    engine.load_scene_from_dict(new_scene)
    planner.update_scene_config(new_scene)

    # 4. Generate preview colormap for phone viewfinder HUD
    colormap = depth_estimator.depth_to_colormap(depth_map, cv2.COLORMAP_TURBO)
    preview_small = cv2.resize(colormap, (180, 135))
    _, buf = cv2.imencode(".jpg", preview_small, [cv2.IMWRITE_JPEG_QUALITY, 80])
    colormap_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

    scan_version += 1
    scene_version += 1

    return {
        "status": "ok",
        "frame": res["frame_number"],
        "total_points": res["total_points"],
        "mesh_triangles": res.get("mesh_triangles", 0),
        "mesh_vertices": res.get("mesh_vertices", 0),
        "room_dimensions": res.get("room_dimensions", {}),
        "surfaces": res["surfaces"],
        "depth_preview": colormap_b64,
        "engine": depth_estimator.active_engine,
        "camera_pose": res.get("camera_pose"),
        "motion_state": res.get("motion_state"),
        "is_stationary": res.get("is_stationary"),
        "spatial_anchors": res.get("spatial_anchors", []),
        "scene_config": new_scene
    }


@app.post("/api/scan/commit")
def commit_scan_to_simulation():
    """
    Synthesizes detected surfaces and 3D furniture digital twins into MuJoCo physics!
    Spawns clean compound table and movable scattered chairs for humanoid rearrangement.
    """
    global scene_version
    scene_version += 1
    new_scene = reconstructor.generate_scene_config(furniture_layout=latest_furniture_layout)
    engine.load_scene_from_dict(new_scene)
    planner.update_scene_config(new_scene)
    return {
        "status": "committed",
        "scene_version": scene_version,
        "message": f"Successfully injected {len(new_scene.get('objects', []))} real-world objects into MuJoCo physics",
        "scene_config": new_scene,
        "furniture_layout": latest_furniture_layout
    }


@app.post("/api/scan/reset")
def reset_scan():
    global scene_version, scan_version, latest_furniture_layout
    scene_version += 1
    scan_version += 1
    reconstructor.reset()
    latest_furniture_layout = {"table": None, "chairs": [], "tables": [], "layout_summary": "Awaiting phone camera scan", "status": "EMPTY"}
    engine.load_scene("default_room.json")
    planner.update_scene_config(engine.scene_config)
    return {"status": "cleared", "total_points": 0}



@app.post("/api/scan/sample_room")
def load_sample_room():
    """Injects high-fidelity real-room point cloud and digital twin table with scattered chairs."""
    global scene_version, scan_version, latest_furniture_layout
    scene_version += 1
    scan_version += 1
    reconstructor.load_sample_room_scan()
    latest_furniture_layout = furniture_detector._build_canonical_layout()
    new_scene = reconstructor.generate_scene_config(furniture_layout=latest_furniture_layout)
    engine.load_scene_from_dict(new_scene)
    planner.update_scene_config(new_scene)
    return {
        "status": "sample_loaded",
        "scene_version": scene_version,
        "total_points": len(reconstructor.all_points),
        "surfaces": reconstructor.detected_surfaces,
        "scene_config": new_scene,
        "furniture_layout": latest_furniture_layout
    }


@app.post("/api/upload_scan")
async def upload_scan(file: UploadFile = File(...)):
    filename = file.filename
    save_path = os.path.join(UPLOADS_DIR, filename)
    with open(save_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    engine.scene_config["visual_scan"] = {
        "mesh_filename": filename,
        "file_size_bytes": len(content),
        "source": "Uploaded 3D Phone Scan",
        "custom_upload": True
    }
    engine.builder.save_scene_config(engine.scene_config)

    return {
        "status": "success",
        "filename": filename,
        "message": "Scanned mesh registered to visual layer"
    }


# --- AI Scene Director REST Endpoints ---

class SceneGenerateRequest(BaseModel):
    prompt: str
    city_id: Optional[str] = "san_francisco"
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028
    custom_spawn: Optional[Dict[str, float]] = None


class ScreenplayGenerateRequest(BaseModel):
    prompt: str
    city_id: Optional[str] = "san_francisco"
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028
    custom_stage_pos: Optional[Dict[str, float]] = None


class WaypointInterpolateRequest(BaseModel):
    waypoints: List[Dict[str, Any]]
    city_id: Optional[str] = "san_francisco"
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028


class DirectPathRequest(BaseModel):
    waypoints: List[Dict[str, Any]]
    city_id: Optional[str] = "san_francisco"
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028


class ObjectMotionRequest(BaseModel):
    asset_id: str
    waypoints: List[Dict[str, Any]]
    city_id: Optional[str] = "san_francisco"
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028
    prompt: Optional[str] = None
    custom_physics: Optional[Dict[str, Any]] = None


class CameraRailInterpolateRequest(BaseModel):
    waypoints: List[Dict[str, Any]]
    center_lat: Optional[float] = 37.7952
    center_lng: Optional[float] = -122.4028
    duration_sec: Optional[float] = 6.0
    fps: Optional[int] = 60
    tracking_mode: Optional[str] = "track_impact"
    target_point: Optional[Dict[str, float]] = None
    scene_frames: Optional[List[Dict[str, Any]]] = None


class AssetMatchRequest(BaseModel):
    prompt: str
    preferred_category: Optional[str] = None


@app.get("/api/assets/catalog")
def get_assets_catalog():
    """Returns the certified 3D model asset catalog for vehicles, props, and characters."""
    assets = asset_catalog_manager.get_all_assets()
    return {
        "status": "success",
        "total_assets": len(assets),
        "assets": assets
    }


@app.post("/api/assets/match")
def match_asset_endpoint(request: AssetMatchRequest):
    """Semantically matches a text description to the closest 3D model asset."""
    matched = asset_catalog_manager.match_asset(request.prompt, request.preferred_category)
    return {
        "status": "success",
        "prompt": request.prompt,
        "asset": matched
    }


class SaveThumbnailRequest(BaseModel):
    asset_id: str
    image_base64: str


@app.post("/api/assets/save_thumbnail")
def save_asset_thumbnail(request: SaveThumbnailRequest):
    """Saves rendered 3D thumbnail image to public/models/thumbnails."""
    try:
        import base64
        import re
        output_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "thumbnails")
        )
        os.makedirs(output_dir, exist_ok=True)
        img_data = re.sub(r"^data:image/\w+;base64,", "", request.image_base64)
        file_path = os.path.join(output_dir, f"{request.asset_id}.png")
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(img_data))
        return {"status": "success", "file": f"/models/thumbnails/{request.asset_id}.png"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/api/scene/camera_rail/interpolate")
def interpolate_camera_rail_endpoint(request: CameraRailInterpolateRequest):
    """
    Interpolates a smooth 60 FPS Catmull-Rom camera flight path along user-drawn
    camera waypoints, dynamically locking onto the crash collision or vehicle targets.
    """
    if not request.waypoints:
        raise HTTPException(status_code=400, detail="Camera rail waypoints list cannot be empty")

    camera_frames = camera_director.interpolate_camera_rail(
        waypoints=request.waypoints,
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028,
        duration_sec=request.duration_sec or 6.0,
        fps=request.fps or 60,
        tracking_mode=request.tracking_mode or "track_impact",
        target_point=request.target_point,
        scene_frames=request.scene_frames
    )
    return {
        "status": "success",
        "total_frames": len(camera_frames),
        "duration_sec": request.duration_sec or 6.0,
        "fps": request.fps or 60,
        "tracking_mode": request.tracking_mode,
        "camera_frames": camera_frames
    }


@app.get("/api/scene/landmarks")
def get_scene_landmarks(
    city_id: str = "san_francisco",
    lat: float = 37.7952,
    lng: float = -122.4028
):
    """Returns detected architectural landmarks, buildings, and POIs for the current city."""
    landmarks = scene_director.get_city_landmarks(city_id, lat, lng)
    return {
        "status": "success",
        "city_id": city_id,
        "total_landmarks": len(landmarks),
        "landmarks": landmarks
    }


@app.post("/api/scene/generate")
def generate_ai_scene(request: SceneGenerateRequest):
    """
    Translates natural language scene description into grounded 3D humanoid
    waypoint trajectories, action states, and 60 FPS animation frames.
    """
    if not request.prompt or not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    scene_data = scene_director.plan_scene_from_prompt(
        prompt=request.prompt,
        city_id=request.city_id or "san_francisco",
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028,
        custom_spawn=request.custom_spawn
    )
    return scene_data


@app.post("/api/scene/direct_path")
def direct_path_scene(request: DirectPathRequest):
    """
    Directs a 3D scene from user-drawn path waypoints and custom natural language prompts.
    Translates each waypoint's prompt into action states, speeds, kinematic profiles,
    and generates the full 60 FPS trajectory with multi-angle cinematic shots.
    """
    if not request.waypoints:
        raise HTTPException(status_code=400, detail="Waypoints list cannot be empty")

    scene_data = scene_director.plan_scene_from_custom_directed_path(
        waypoints_input=request.waypoints,
        city_id=request.city_id or "san_francisco",
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028
    )
    return scene_data


@app.post("/api/scene/direct_object_motion")
def direct_object_motion_scene(request: ObjectMotionRequest):
    """
    Directs 3D motion for any catalog model (Vehicle, Biped, Drone, Mobile Robot, Prop).
    Simulates real-world physics (mass, acceleration, braking, slip, drag, bank angles, ground elevation).
    """
    if not request.waypoints:
        raise HTTPException(status_code=400, detail="Waypoints list cannot be empty")

    scene_data = object_physics_engine.simulate_object_motion(
        asset_id=request.asset_id,
        waypoints=request.waypoints,
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028,
        city_id=request.city_id or "san_francisco",
        prompt=request.prompt,
        custom_physics=request.custom_physics
    )
    return scene_data


@app.post("/api/scene/screenplay")
def generate_screenplay_scene(request: ScreenplayGenerateRequest):
    """
    Directs an end-to-end screenplay scene from natural language prompt.
    Selects certified 3D models (e.g. 3-car pileup, drone flight in air, truck barrier crash),
    simulates multi-body Newtonian physics grounded at custom_stage_pos,
    and returns 60 FPS trajectory frames with cinematic director cameras.
    """
    if not request.prompt or not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Scene description prompt cannot be empty")

    scene_data = scene_director.plan_screenplay_scene(
        prompt=request.prompt,
        city_id=request.city_id or "san_francisco",
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028,
        custom_stage_pos=request.custom_stage_pos
    )
    return scene_data


@app.post("/api/scene/waypoints/interpolate")
def interpolate_custom_waypoints(request: WaypointInterpolateRequest):
    """Interpolates dense 60 FPS trajectory from manually defined or adjusted waypoints."""
    if not request.waypoints:
        raise HTTPException(status_code=400, detail="Waypoints list cannot be empty")

    frames = scene_director._interpolate_scene_frames(
        waypoints=request.waypoints,
        center_lat=request.center_lat or 37.7952,
        center_lng=request.center_lng or -122.4028,
        base_alt=20.0
    )
    return {
        "status": "success",
        "total_frames": len(frames),
        "total_duration_sec": sum(w.get("duration", 2.0) for w in request.waypoints),
        "frames": frames
    }


@app.post("/api/scene/export_mp4")
async def export_scene_mp4(
    video_file: UploadFile = File(...),
    target_duration: Optional[float] = Form(None),
    fps: Optional[int] = Form(60)
):
    """
    Transcodes recorded WebM video stream or raw footage into a production-grade
    H.264 / MP4 video with high-profile progressive encoding, yuv420p, and faststart.
    Guarantees exact target duration and 60 FPS output.
    """
    if not video_file:
        raise HTTPException(status_code=400, detail="No video file provided for export")

    temp_dir = tempfile.gettempdir()
    timestamp = int(time.time() * 1000)
    in_ext = ".webm" if "webm" in (video_file.content_type or "") else ".mp4"
    input_path = os.path.join(temp_dir, f"input_rec_{timestamp}{in_ext}")
    output_path = os.path.join(temp_dir, f"robotwin_scene_director_{timestamp}.mp4")

    try:
        content = await video_file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty video file payload")

        with open(input_path, "wb") as f:
            f.write(content)

        # Locate ffmpeg
        ffmpeg_bin = "/opt/homebrew/bin/ffmpeg"
        if not os.path.exists(ffmpeg_bin):
            ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"

        # Build video filter chain: 60 FPS conform, CAS sharpening, contrast/saturation grading
        vf_filters = []
        target_fps = fps if (fps and fps > 0) else 60
        vf_filters.append(f"fps={target_fps}")
        vf_filters.append("cas=0.75,unsharp=5:5:1.20:5:5:0.0,eq=contrast=1.14:brightness=0.01:saturation=1.20,vignette=PI/5")
        if target_duration and target_duration > 0:
            # Pad final frame so any browser encoding lag is cleanly bridged to reach the exact target runtime
            vf_filters.append("tpad=stop_mode=clone:stop_duration=3.5")

        cmd = [
            ffmpeg_bin, "-y",
            "-i", input_path,
            "-vf", ",".join(vf_filters),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-crf", "18",
            "-movflags", "+faststart",
        ]
        if target_duration and target_duration > 0:
            cmd.extend(["-t", str(target_duration)])
        cmd.append(output_path)

        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
        if res.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            logger.error(f"FFmpeg transcode error: {res.stderr.decode('utf-8', errors='ignore')}")
            # Fallback with standard filters if CAS or custom filter had an issue
            cmd_fallback = [ffmpeg_bin, "-y", "-i", input_path]
            fallback_filters = [f"fps={target_fps}"]
            if target_duration and target_duration > 0:
                fallback_filters.append("tpad=stop_mode=clone:stop_duration=3.5")
            cmd_fallback.extend(["-vf", ",".join(fallback_filters)])
            if target_duration and target_duration > 0:
                cmd_fallback.extend(["-t", str(target_duration)])
            cmd_fallback.extend([
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "veryfast",
                "-crf", "18",
                "-movflags", "+faststart",
                output_path
            ])
            res_fb = subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45)
            if res_fb.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                # Raw copy fallback
                cmd_copy = [ffmpeg_bin, "-y", "-i", input_path, "-c:v", "copy", output_path]
                res_copy = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
                if res_copy.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                    raise HTTPException(status_code=500, detail=f"MP4 transcode failed: {res.stderr.decode('utf-8', errors='ignore')}")

        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"robotwin_cinematic_director_{timestamp}.mp4",
            headers={"Content-Disposition": f'attachment; filename="robotwin_cinematic_director_{timestamp}.mp4"'}
        )
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except Exception:
                pass


@app.get("/api/scene/export_mp4/test")
def export_scene_mp4_test():
    """Generates a test MP4 video to verify FFmpeg pipeline availability."""
    temp_dir = tempfile.gettempdir()
    timestamp = int(time.time() * 1000)
    output_path = os.path.join(temp_dir, f"test_director_{timestamp}.mp4")

    ffmpeg_bin = "/opt/homebrew/bin/ffmpeg"
    if not os.path.exists(ffmpeg_bin):
        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"

    cmd = [
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=1:size=640x360:rate=30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    if res.returncode != 0 or not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Test MP4 generation failed")

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename="test_director.mp4",
        headers={"Content-Disposition": 'attachment; filename="test_director.mp4"'}
    )


# --- WebSocket Endpoints ---

@app.websocket("/ws/phone_feed")
async def websocket_phone_feed(websocket: WebSocket):
    """
    High-throughput WebSocket for phone camera frames.
    Receives RGB video frames and phone gyro orientation from mobile browser.
    Runs real-time depth estimation, updates 3D point cloud, and returns depth colormap.
    """
    await websocket.accept()
    try:
        while True:
            # Handle text (JSON with base64 image) or binary bytes
            message = await websocket.receive()
            frame_bytes = None
            orientation = None

            if "text" in message:
                try:
                    payload = json.loads(message["text"])
                    if "image" in payload:
                        img_data = payload["image"]
                        if "," in img_data:
                            img_data = img_data.split(",")[1]
                        frame_bytes = base64.b64decode(img_data)
                    orientation = payload.get("orientation")
                except Exception as e:
                    await websocket.send_json({"status": "error", "message": f"Invalid JSON payload: {e}"})
                    continue

            elif "bytes" in message:
                frame_bytes = message["bytes"]

            if not frame_bytes:
                continue

            # Decode image using OpenCV
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            # 1. Monocular Depth Estimation
            depth_map = depth_estimator.estimate_depth(frame)

            # 2. 6-DoF Spatial Odometry, Multi-Entity Recognition & 3D Model Anchoring
            res = reconstructor.process_frame(frame, depth_map, orientation=orientation, subsample=3)

            # 3. Synchronize detected 3D models into MuJoCo physics every 4th frame
            try:
                new_scene = reconstructor.generate_scene_config()
                if res["frame_number"] % 4 == 0:
                    engine.load_scene_from_dict(new_scene)
                    planner.update_scene_config(new_scene)
                    scene_version += 1
            except Exception as e_scene:
                logger.warning(f"Scene sync error: {e_scene}")

            # 4. Generate preview colormap for phone viewfinder HUD
            colormap = depth_estimator.depth_to_colormap(depth_map, cv2.COLORMAP_TURBO)
            preview_small = cv2.resize(colormap, (160, 120))
            _, buf = cv2.imencode(".jpg", preview_small, [cv2.IMWRITE_JPEG_QUALITY, 75])
            colormap_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

            # 5. Respond to phone client with full 3D odometry & spatial anchor data
            await websocket.send_json({
                "status": "ok",
                "frame": res["frame_number"],
                "frame_points": res.get("frame_points", 0),
                "total_points": res["total_points"],
                "surfaces": res["surfaces"],
                "depth_preview": colormap_b64,
                "engine": depth_estimator.active_engine,
                "camera_pose": res.get("camera_pose"),
                "motion_state": res.get("motion_state"),
                "is_stationary": res.get("is_stationary"),
                "spatial_anchors": res.get("spatial_anchors", []),
                "scene_config": new_scene
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"Phone stream error: {e}")



@app.websocket("/ws/stream")
async def websocket_telemetry_stream(websocket: WebSocket):
    """Streams MuJoCo physics state, spatial odometry, and perception telemetry to desktop UI."""
    await websocket.accept()
    try:
        while True:
            telem = engine.get_telemetry_snapshot()
            tracker_state = reconstructor.spatial_tracker.get_state()
            telem["scene_version"] = scene_version
            telem["scan_version"] = scan_version
            telem["scan_points"] = len(reconstructor.all_points)
            telem["mesh_triangles"] = len(reconstructor.mesh_faces)
            telem["room_dimensions"] = reconstructor.room_dimensions
            telem["scan_surfaces"] = reconstructor.detected_surfaces
            telem["perception_engine"] = depth_estimator.active_engine
            telem["furniture_layout"] = latest_furniture_layout
            telem["camera_pose"] = tracker_state.get("camera_pose")
            telem["motion_state"] = tracker_state.get("motion_state")
            telem["is_stationary"] = tracker_state.get("is_stationary")
            telem["spatial_anchors"] = tracker_state.get("spatial_anchors", [])
            await websocket.send_json(telem)
            await asyncio.sleep(0.033)  # ~30 FPS stream
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.websocket("/ws/stunt_stream")
async def websocket_stunt_stream(websocket: WebSocket):
    """
    Streams 60 FPS stunt trajectory poses, kinematic joint states,
    ballistic flight progress, and impact telemetry to StuntStudio frontend.
    Supports real-time bidirectional control: planning, scrubbing, and frame playback.
    """
    await websocket.accept()
    global active_stunt_plan
    try:
        while True:
            # Check for client commands
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.04)
                data = json.loads(msg)
                action = data.get("action")

                # If no explicit action but has location_id, treat as plan request
                if not action and ("location_id" in data or "stunt_type" in data):
                    action = "plan"
                    req_data = data
                else:
                    req_data = data.get("params", data)

                if action == "plan":
                    loc_id = req_data.get("location_id", "san_francisco_rooftop")
                    loc = get_location_by_id(loc_id)
                    stunt_type = req_data.get("stunt_type", "ROOFTOP_GAP_LEAP")
                    preset = STUNT_PRESETS.get(stunt_type, STUNT_PRESETS["ROOFTOP_GAP_LEAP"])
                    speed = float(req_data.get("launch_speed", req_data.get("run_speed", preset["default_run_speed"])))
                    pitch = float(req_data.get("launch_pitch_deg", req_data.get("pitch_deg", preset["default_pitch_deg"])))
                    flips = int(req_data.get("num_rotations", req_data.get("flips", preset["default_flips"])))
                    rig = req_data.get("safety_rig", preset["safety_rig"])
                    h0 = float(loc["rooftop"]["launch_height"])
                    h1 = float(loc["rooftop"]["target_height"])
                    gap = float(loc["rooftop"]["gap_distance"])
                    plan = stunt_solver.solve_trajectory(
                        stunt_type=stunt_type,
                        takeoff_pos=(0.0, 0.0, h0),
                        target_pos=(gap, 0.0, h1),
                        run_speed=speed,
                        pitch_deg=pitch,
                        flips=flips,
                        safety_rig=rig,
                        airbag_height=float(loc["rooftop"].get("parapet_height", 1.0)) + 1.8,
                        wire_catch_height=max(5.0, float(loc["street_drop"]["total_depth"]) * 0.25)
                    )
                    plan["location"] = loc
                    active_stunt_plan = plan
                    await websocket.send_json({
                        "type": "STUNT_INITIALIZED",
                        "plan": plan,
                        "telemetry": plan["telemetry"],
                        "total_frames": plan["total_frames"]
                    })

                elif action in ("play", "execute"):
                    if not active_stunt_plan or not active_stunt_plan.get("frames"):
                        # Auto-plan if none exists
                        loc = get_location_by_id("san_francisco_rooftop")
                        active_stunt_plan = stunt_solver.solve_trajectory(
                            stunt_type="ROOFTOP_GAP_LEAP",
                            takeoff_pos=(0.0, 0.0, float(loc["rooftop"]["launch_height"])),
                            target_pos=(float(loc["rooftop"]["gap_distance"]), 0.0, float(loc["rooftop"]["target_height"])),
                            run_speed=6.5,
                            pitch_deg=22.0,
                            flips=0,
                            safety_rig="NONE"
                        )
                        active_stunt_plan["location"] = loc

                    frames = active_stunt_plan.get("frames", [])
                    playback_speed = float(data.get("playback_speed", 1.0))
                    frame_delay = max(0.005, 0.016 / max(0.1, playback_speed))

                    for idx, frame in enumerate(frames):
                        await websocket.send_json({
                            "type": "STUNT_FRAME",
                            "frame_idx": idx,
                            "total_frames": len(frames),
                            "time": frame.get("time", 0.0),
                            "pos": frame.get("pos", [0, 0, 0]),
                            "rot": frame.get("rot", [0, 0, 0]),
                            "phase": frame.get("phase", "FLIGHT"),
                            "joints": frame.get("joints", {}),
                            "telemetry": active_stunt_plan.get("telemetry", {})
                        })
                        await asyncio.sleep(frame_delay)

                    await websocket.send_json({
                        "type": "STUNT_COMPLETE",
                        "telemetry": active_stunt_plan.get("telemetry", {})
                    })

            except asyncio.TimeoutError:
                pass

            # Keepalive / status ping if active
            await asyncio.sleep(0.02)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"Stunt stream error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
