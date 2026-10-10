# RoboTwin: Physics-Based Humanoid Robotics Simulator
> **"Real World In, Humanoid Robot Out"**

RoboTwin is an open-source, physics-grounded humanoid robotics simulator designed to bridge real-world physical environments captured on mobile devices (Polycam, photogrammetry, LiDAR scans) with high-fidelity articulated humanoid robot simulation in **MuJoCo** and interactive web-based 3D visualization in **Three.js**.

---

## 🌟 Key Capabilities

1. **Two-Layer Environment Model**:
   - **Visual Layer**: High-detail room scan mesh (e.g. Polycam GLTF/OBJ export) rendered in Three.js with realistic materials.
   - **Physics Layer**: Fast, stable collision primitives (`box`, `cylinder`, `plane`) compiled dynamically into MuJoCo MJCF XML for real-time contact dynamics without mesh tunneling or lag.
2. **29-DoF Articulated Humanoid Robot**:
   - Inspired by Google DeepMind's **MuJoCo Menagerie** (`unitree_h1` & `unitree_g1`).
   - Complete kinematic tree: Pelvis root with 6-DoF freejoint, 2-DoF spine torso, 2-DoF sensor head, 7-DoF arms with parallel-jaw grippers, and 12-DoF lower body.
3. **Motion Planning & Damped Least-Squares (DLS) Inverse Kinematics**:
   - Utilizes MuJoCo's analytical Jacobian ($\Delta q = J^T (J J^T + \lambda^2 I)^{-1} e$) for end-effector reaching and target tracking.
   - Real friction contact confirmation when grasping objects.
4. **SayCan-Style AI Task Planner**:
   - Translates natural language commands (*"Walk to the desk, pick up the bottle, and place it on the shelf"*) into grounded, verifiable action sequences (`walk_to`, `reach`, `grasp`, `lift`, `carry_to`, `place_on`, `release`).
5. **Real-Time 30 FPS Telemetry Stream & 3D Web Dashboard**:
   - FastAPI WebSocket backend streaming joint coordinates, object poses, and contact forces.
   - Aesthetic dark-mode Three.js dashboard with orbit controls, camera focus presets, live collision wireframe toggling, and object coordinate fine-tuning.

---

## 🏗️ Architecture

```
                       📱 Phone 3D Scan (Polycam / LiDAR)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
        [Visual Scan Mesh]                      [Physics Primitives]
        (Three.js Viewport)                     (MuJoCo MJCF XML)
                 │                                       │
                 │                                       ▼
                 │                          ┌──────────────────────────┐
                 │                          │   MuJoCo Physics Core    │
                 │                          │   - 29-DoF Humanoid      │
                 │                          │   - DLS Jacobian IK      │
                 │                          │   - Contact Grasping     │
                 │                          │   - Walking Locomotion   │
                 │                          └────────────┬─────────────┘
                 │                                       │
                 ▼                                       ▼
     ┌────────────────────────────────────────────────────────┐
     │           FastAPI Server & WebSocket Stream            │
     └──────────────────────────┬─────────────────────────────┘
                                │
                                ▼
     ┌────────────────────────────────────────────────────────┐
     │            RoboTwin 3D Web Dashboard                   │
     │            - Three.js WebGL Viewport                   │
     │            - SayCan AI Task Planner Console            │
     │            - 2-Layer Scene Manager & Upload            │
     │            - 500Hz MuJoCo Telemetry Panel              │
     └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.11)
- **Node.js**: 18+ (tested on Node v20.18)

### 2. Launch with One Command
```bash
./start.sh
```
This script automatically:
1. Activates the Python virtual environment.
2. Starts the FastAPI MuJoCo backend server on `http://127.0.0.1:8000`.
3. Starts the Vite 3D dashboard on `http://127.0.0.1:5173`.

### 3. Manual Startup

**Backend**:
```bash
source .venv/bin/activate
uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` in your browser.

---

## 🎮 Benchmark Demonstration

In the dashboard, click **"Benchmark: Pick & Place Bottle"** or enter:
> *"Walk to the desk, pick up the bottle, and place it on the shelf"*

Observe:
1. **Navigation**: Humanoid walks across the room to the work desk using an articulated bipedal stepping cycle.
2. **IK Approach**: Right arm calculates Jacobian IK and smoothly reaches toward the water bottle.
3. **Contact Grasp**: Parallel gripper fingers close around the bottle and verify physical contact.
4. **Lift**: Object is lifted 22cm above the desk surface.
5. **Transport**: Humanoid carries the bottle across the room to the storage shelf.
6. **Placement & Release**: Object is positioned above the top shelf surface, gripper releases, and bottle settles under gravity.

---

## 📁 Repository Structure

```
RoboTwin/
├── backend/
│   ├── app.py                     # FastAPI REST API & WebSocket server
│   ├── requirements.txt           # Python dependencies
│   ├── simulation/
│   │   ├── engine.py              # MuJoCo Physics loop & state manager
│   │   ├── robot_model.py         # Humanoid kinematic tree & actuators
│   │   ├── ik_solver.py           # Damped Least-Squares Jacobian IK
│   │   ├── locomotion.py          # Walking gait & navigation controller
│   │   └── scene_builder.py       # Two-layer environment compiler
│   ├── planner/
│   │   ├── task_planner.py        # SayCan AI task planner & affordance checker
│   │   └── skills.py              # Atomic skill state machine
│   └── models/
│       ├── robot/
│       │   └── humanoid.xml       # High-fidelity 29-DoF MJCF model
│       └── scenes/
│           └── default_room.json  # Scanned room scene registry
├── frontend/
│   ├── index.html                 # HTML shell with Google Fonts
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                # Main interface & WebSocket listener
│       ├── index.css              # Cyber-robotics dark CSS design system
│       └── components/
│           ├── Viewport3D.jsx     # Three.js 3D Viewport & robot renderer
│           ├── TaskConsole.jsx    # Natural language command bar & pipeline
│           ├── SceneManager.jsx   # Phone scan upload & 2-layer inspector
│           └── TelemetryPanel.jsx # 500Hz physics metrics & coordinates
├── start.sh                       # One-click startup script
└── README.md
```

---

## 📜 Open Source Citations & References
- **MuJoCo**: [google-deepmind/mujoco](https://github.com/google-deepmind/mujoco)
- **MuJoCo Menagerie**: [google-deepmind/mujoco_menagerie](https://github.com/google-deepmind/mujoco_menagerie)
- **SayCan**: [google-research/saycan](https://github.com/google-research/google-research/tree/master/saycan)
- **Viser**: [viser-project/viser](https://github.com/viser-project/viser)
- **CoACD / V-HACD**: [SarahWeiii/CoACD](https://github.com/SarahWeiii/CoACD) & [obj2mjcf](https://github.com/kevinzakka/obj2mjcf)
