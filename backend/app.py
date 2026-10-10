"""
RoboTwin FastAPI & WebSocket Backend Server
Serves 3D scene data, handles scan uploads, plans tasks, and streams physics telemetry.
"""

import os
import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.simulation.engine import SimulationEngine
from backend.planner.task_planner import TaskPlanner

# Resolve project root directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCENES_DIR = os.path.join(BASE_DIR, "models", "scenes")
ROBOT_XML = os.path.join(BASE_DIR, "models", "robot", "humanoid.xml")
UPLOADS_DIR = os.path.join(BASE_DIR, "models", "scenes", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(
    title="RoboTwin Simulator API",
    description="Physics-based humanoid robotics simulator with real-world 3D scene ingestion",
    version="1.0.0"
)

# Enable CORS for local dev frontend
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

# Start background MuJoCo physics stepping loop
engine.start_loop()

class CommandRequest(BaseModel):
    prompt: str

class ObjectUpdateRequest(BaseModel):
    id: str
    position: list[float]
    size: Optional[list[float]] = None
    movable: Optional[bool] = None

class SpeedRequest(BaseModel):
    multiplier: float

@app.get("/api/health")
def get_health():
    return {
        "status": "online",
        "engine": "MuJoCo 3.15",
        "humanoid": "RoboTwin 29-DoF Articulated Humanoid",
        "sim_time": engine.get_telemetry_snapshot().get("sim_time", 0.0)
    }

@app.get("/api/scene")
def get_scene():
    return {
        "scene_config": engine.scene_config,
        "telemetry": engine.get_telemetry_snapshot()
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

    # Reload simulation with updated positions
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

@app.post("/api/upload_scan")
async def upload_scan(file: UploadFile = File(...)):
    """
    Accepts 3D phone scans (GLTF, GLB, OBJ) and updates the visual mesh layer.
    """
    filename = file.filename
    save_path = os.path.join(UPLOADS_DIR, filename)
    with open(save_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Update visual scan metadata
    engine.scene_config["visual_scan"] = {
        "mesh_filename": filename,
        "file_size_bytes": len(content),
        "source": "Uploaded Phone Scan",
        "custom_upload": True
    }
    engine.builder.save_scene_config(engine.scene_config)

    return {
        "status": "success",
        "filename": filename,
        "message": "Scanned mesh uploaded and registered to visual layer"
    }

# WebSocket Manager for 3D state streaming
@app.websocket("/ws/stream")
async def websocket_telemetry_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            telem = engine.get_telemetry_snapshot()
            await websocket.send_json(telem)
            await asyncio.sleep(0.033)  # ~30 FPS stream
    except WebSocketDisconnect:
        pass
    except Exception:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
