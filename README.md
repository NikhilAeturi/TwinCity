# TwinCity: Movie Directing & Cinematic Shot Simulator
> **"Direct Scenes, Plan Camera Rails & Simulate Film Shots in Photorealistic 3D Digital Twin Cities"**
>
> 🏆 **1st Place Winner at HackRU (Rutgers Hackathon)!**

TwinCity transforms real-world cities into an interactive, physics-grounded virtual movie studio. Instead of spending millions of dollars closing down metropolitan streets, wrecking practical stunt cars, or hiring helicopter crews to test camera angles, directors and creators can stage multi-actor action scenes, choreograph vehicle chases, draw custom 3D camera flight rails, and simulate cinematic shots right inside their browser.

---

## 🌟 Key Capabilities

### 1. 🏙️ Real-World 3D Digital Twin Sets
- **Global Photorealistic Sets**: Drop onto any real-world street corner—from the hills of San Francisco to the skyline of Manhattan or the districts of Tokyo.
- **Accurate Geospatial Stages**: 0.25-mile radius staging areas with photogrammetry mesh elevation, street layouts, and real architectural landmarks.

### 2. 🏎️ 3D Model Catalog & Dynamic Physics Staging
- **High-Fidelity Vehicles**: Supercars, tactical SUVs, executive sedans, police interceptors, and transport trucks with realistic vehicle dynamics (Ackermann steering, momentum, braking deceleration, body roll, and crash deformation).
- **Drones & Aerial Vehicles**: Agile quadcopters capable of swooping low through traffic or sweeping overhead.
- **Articulated Stunt Doubles**: Humanoid models with motion-captured choreography (walk, jog, crouch, scan, wave, celebrate, drop).
- **Set Props**: Traffic barriers, cones, streetlights, delivery crates, and impact debris clusters.

### 3. 🎥 Pencil Path & Camera Rail Director
- **3D Airspace Flight Rails**: Use an intuitive pencil tool to click and draw smooth 3D camera paths directly in the sky above the city.
- **Catmull-Rom Spline Interpolation**: Camera trajectories are smoothed into cinematic flight curves with adjustable altitude presets (Curb: 4m, Street: 14m, Crane: 28m, Aerial: 55m).
- **Intelligent Tracking Optics**:
  - 🎯 **Lock on Action Center**: Keeps the camera lens centered on the core stunt or crash impact point.
  - 🏎️ **Chase Lead Actor**: Dynamically follows a speeding vehicle or drone from behind or alongside.
  - 🧭 **Look Forward along Rail**: Tangent lookahead aligned with camera flight velocity.
  - 📍 **Target Focus**: Locks onto secondary targets or destination landmarks.

### 4. 🤖 AI Natural Language Screenplay Choreographer
- Describe any action scene in plain English (*"A sports car speeds around the corner while an SUV swerves and a drone sweeps overhead"*).
- The AI scene director parses the script, stages the models, calculates realistic speeds, distances, and timing, and generates the choreography automatically.

### 5. 🎬 60 FPS In-Browser Recording & Direct MP4 Export
- Capture and preview scenes in real time with free camera navigation or directed camera rails.
- Export production-ready **1080p 60 FPS MP4** videos and synchronized telemetry datasets directly from the browser canvas.

---

## 🏗️ System Architecture

```
                       🌍 Geospatial Digital Twin (Google 3D Tiles)
                                      │
                  ┌───────────────────┴───────────────────┐
                  ▼                                       ▼
         [Photorealistic 3D Mesh]                [Geospatial ENU Stage]
          (Three.js / WebGL View)                 (Elevation & Bounds)
                  │                                       │
                  │                                       ▼
                  │                          ┌──────────────────────────┐
                  │                          │  TwinCity Physics Core   │
                  │                          │  - Vehicle Dynamics      │
                  │                          │  - Catmull-Rom Rails     │
                  │                          │  - Contact & Collisions  │
                  │                          │  - Humanoid Locomotion   │
                  │                          └────────────┬─────────────┘
                  │                                       │
                  ▼                                       ▼
      ┌────────────────────────────────────────────────────────┐
      │           FastAPI Server & WebSocket Stream            │
      │           - REST Endpoints & Screenplay Director       │
      │           - 60Hz Telemetry & Vehicle Pose Streaming    │
      └──────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
      ┌────────────────────────────────────────────────────────┐
      │              TwinCity 3D Director Studio               │
      │              - 3D City Viewport & Asset Stager         │
      │              - Pencil Path & Camera Rail Director      │
      │              - Screenplay Natural Language Bar         │
      │              - In-Browser 60 FPS MP4 Video Recorder    │
      └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.11)
- **Node.js**: 18+ (tested on Node v20+)

### 2. Launch with One Command
```bash
./start.sh
```
This automatically:
1. Activates the Python virtual environment (`.venv`).
2. Starts the **FastAPI Physics & Director Backend** on `http://127.0.0.1:8000`.
3. Starts the **Vite 3D Web Studio** on `http://127.0.0.1:5173`.

### 3. Manual Startup

**Backend**:
```bash
source .venv/bin/activate
uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` in your browser to begin directing.

---

## 📁 Repository Structure

```
TwinCity/
├── backend/
│   ├── app.py                         # FastAPI REST API & WebSocket server
│   ├── requirements.txt               # Python backend dependencies
│   ├── simulation/
│   │   ├── camera_director.py         # Catmull-Rom spline camera rail director
│   │   ├── screenplay_physics.py      # Multi-vehicle stunt & screenplay kinematics
│   │   ├── asset_catalog.py           # 3D models & physical properties catalog
│   │   ├── stunt_physics.py           # Impact dynamics & trajectory simulation
│   │   ├── stunt_locations.py         # Global geospatial city preset locations
│   │   ├── city_models.py             # 3D city architectural stage models
│   │   ├── locomotion.py              # Humanoid walking & action controllers
│   │   └── engine.py                  # Physics state integration loop
│   ├── planner/
│   │   ├── scene_director.py          # AI screenplay-to-scene choreography
│   │   └── task_planner.py            # Natural language command interpreter
│   └── models/
│       ├── robot/                     # Humanoid MJCF models & generators
│       └── scenes/                    # Scene configurations & uploads
├── frontend/
│   ├── index.html                     # Studio HTML shell & typography
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                    # Root studio container & error boundary
│       ├── index.css                  # Studio dark theme & design tokens
│       └── components/
│           ├── StuntStudio.jsx        # Main Director Studio orchestration
│           ├── CityViewport.jsx       # 3D City WebGL environment viewport
│           ├── DirectorStudioPanel.jsx# Unified scene generation & camera controls
│           ├── PencilPathDirector.jsx # Custom waypoint & action director
│           ├── CameraRailDirector.jsx # 3D camera spline rail controls
│           ├── ModelsDirectorPanel.jsx# 3D asset, vehicle, and prop catalog
│           └── Model3DStudioViewer.jsx# Interactive 3D asset previewer
├── start.sh                           # One-click startup script
└── README.md
```

---

## 🏆 Acknowledgments & Tech Stack
- **Google Photorealistic 3D Tiles** & Three.js for 3D geospatial environments
- **FastAPI & Uvicorn** for real-time kinematics and WebSocket streaming
- **MuJoCo & SciPy** for rigid-body physics, vehicle dynamics, and spline mathematics
- Built and awarded **1st Place at Rutgers HackRU** 🎬
