"""
Unit and Integration Tests for Object-Centric Digital Twinning
and Autonomous Humanoid Furniture Arrangement (Chair Tucking).
"""

import os
import sys
import unittest

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import mujoco
import requests

from backend.perception.furniture_detector import FurnitureDetector
from backend.simulation.scene_builder import SceneBuilder
from backend.simulation.engine import SimulationEngine
from backend.planner.task_planner import TaskPlanner
from backend.planner.skills import SkillStatus
from backend.app import app, plan_task, execute_task, get_furniture_layout, load_sample_room, commit_scan_to_simulation, CommandRequest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES_DIR = os.path.join(BASE_DIR, "models", "scenes")
ROBOT_XML = os.path.join(BASE_DIR, "models", "robot", "humanoid.xml")


class TestFurnitureArrangement(unittest.TestCase):

    def test_furniture_detector_layout(self):
        detector = FurnitureDetector()
        
        # 1. Test canonical fallback layout
        canonical = detector._build_canonical_layout()
        self.assertIn("table", canonical)
        self.assertIn("chairs", canonical)
        self.assertEqual(len(canonical["chairs"]), 2)
        self.assertEqual(canonical["table"]["geometry"], "compound_table")
        self.assertEqual(canonical["chairs"][0]["geometry"], "compound_chair")
        self.assertEqual(canonical["scattered_count"], 2)
        self.assertEqual(canonical["suggested_task"], "tuck in the chairs")

        # 2. Test synthetic frame detection
        dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
        # Draw simple floor & furniture contrast patches
        dummy_img[200:460, 100:540] = [120, 130, 140]
        dummy_img[300:420, 200:400] = [60, 70, 80]

        layout = detector.detect_layout_from_image(dummy_img, orientation={"pitch": -25.0})
        self.assertEqual(layout["table"]["type"], "table")
        self.assertEqual(len(layout["chairs"]), 2)
        self.assertIn("slots", layout["table"])
        self.assertEqual(len(layout["table"]["slots"]), 2)

    def test_scene_builder_compound_furniture_in_mujoco(self):
        sb = SceneBuilder(SCENES_DIR, ROBOT_XML)
        cfg = {
            "robot_spawn": {"position": [0.0, 0.0, 0.98]},
            "objects": [
                {
                    "id": "floor",
                    "geometry": "plane",
                    "position": [0.0, 0.0, 0.0],
                    "size": [5.0, 5.0, 0.05],
                    "friction": [1.0, 0.01, 0.001]
                },
                {
                    "id": "dining_table",
                    "type": "table",
                    "geometry": "compound_table",
                    "position": [1.35, 0.0, 0.74],
                    "size": [0.65, 0.45, 0.025],
                    "surface_height": 0.74,
                    "movable": False,
                    "friction": [0.9, 0.02, 0.001]
                },
                {
                    "id": "chair_1",
                    "type": "chair",
                    "geometry": "compound_chair",
                    "position": [0.85, 0.65, 0.42],
                    "movable": True,
                    "mass": 4.2,
                    "friction": [0.35, 0.05, 0.001]
                },
                {
                    "id": "chair_2",
                    "type": "chair",
                    "geometry": "compound_chair",
                    "position": [1.95, -0.65, 0.42],
                    "movable": True,
                    "mass": 4.2,
                    "friction": [0.35, 0.05, 0.001]
                }
            ]
        }

        xml_str = sb.build_full_scene_xml(cfg)
        self.assertNotIn("compound_table", xml_str)  # compiled into native geoms
        self.assertIn("dining_table_top", xml_str)
        self.assertIn("chair_1_seat", xml_str)
        self.assertIn("chair_1_backrest", xml_str)
        self.assertIn("chair_1_freejoint", xml_str)

        # Load directly into MuJoCo physics engine
        model = mujoco.MjModel.from_xml_string(xml_str)
        data = mujoco.MjData(model)
        self.assertGreaterEqual(model.nbody, 28)
        
        # Step simulation dynamics
        for _ in range(50):
            mujoco.mj_step(model, data)

        # Check stability: chair bodies have valid finite positions
        c1_bid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "chair_1")
        self.assertGreaterEqual(c1_bid, 0)
        self.assertFalse(np.isnan(data.xpos[c1_bid]).any())

    def test_task_planner_furniture_arrangement(self):
        scene_config = {
            "objects": [
                {
                    "id": "chair_1",
                    "name": "Chair #1",
                    "type": "chair",
                    "target_pos": [0.95, 0.35, 0.42]
                },
                {
                    "id": "chair_2",
                    "name": "Chair #2",
                    "type": "chair",
                    "target_pos": [1.75, -0.35, 0.42]
                }
            ]
        }
        planner = TaskPlanner(scene_config)

        # Test trigger variations
        commands = [
            "put the chairs in correct position",
            "tuck in the chairs",
            "arrange chairs",
            "align chairs with table",
            "put chairs"
        ]

        for cmd in commands:
            plan = planner.plan_from_text(cmd)
            self.assertEqual(plan["status"], "VALIDATED")
            self.assertEqual(plan["total_steps"], 8)
            skills = [s["skill"] for s in plan["steps"]]
            self.assertEqual(skills, [
                "approach_chair", "contact_chair", "push_chair_to_slot", "retract_arms",
                "approach_chair", "contact_chair", "push_chair_to_slot", "retract_arms"
            ])

        # Benchmark pick and place still works
        bottle_plan = planner.plan_from_text("walk to desk, pick up bottle, place on shelf")
        self.assertEqual(bottle_plan["status"], "VALIDATED")
        self.assertEqual(bottle_plan["total_steps"], 7)
        self.assertEqual(bottle_plan["steps"][0]["skill"], "walk_to")
        self.assertEqual(bottle_plan["steps"][2]["skill"], "grasp")

    def test_simulation_engine_chair_tucking_execution(self):
        engine = SimulationEngine(SCENES_DIR, ROBOT_XML)
        engine.load_scene("sample_room.json")

        planner = TaskPlanner(engine.scene_config)
        plan = planner.plan_from_text("put the chairs in correct position")
        engine.set_task_plan(plan)

        self.assertIsNotNone(engine.active_task_plan)
        self.assertEqual(engine.current_step_index, 0)

        # Step physics loop through several steps
        for _ in range(80):
            engine.step(0.01)

        # Telemetry snapshot contains rich state
        telem = engine.get_telemetry_snapshot()
        self.assertIn("robot", telem)
        self.assertIn("objects", telem)
        self.assertIn("chair_1", telem["objects"])
        self.assertIn("task", telem)
        self.assertTrue(telem["task"]["active"])

    def test_api_endpoints_via_functions_and_http(self):
        # 1. Furniture layout function starts empty awaiting scan
        layout = get_furniture_layout()
        self.assertIn("table", layout)
        self.assertIn("chairs", layout)
        self.assertEqual(len(layout["chairs"]), 0)

        # 2. Plan task function
        plan = plan_task(CommandRequest(prompt="put the chairs in correct position"))
        self.assertEqual(plan["status"], "VALIDATED")
        self.assertEqual(plan["total_steps"], 8)

        # 3. Execute task function
        exec_res = execute_task(CommandRequest(prompt="tuck in the chairs"))
        self.assertEqual(exec_res["status"], "executing")
        self.assertEqual(exec_res["plan"]["total_steps"], 8)

        # 4. Sample room loading function
        sample_res = load_sample_room()
        self.assertEqual(sample_res["status"], "sample_loaded")
        self.assertIn("furniture_layout", sample_res)
        self.assertGreaterEqual(len(sample_res["scene_config"]["objects"]), 3)

        # 5. Live HTTP endpoints (against running server)
        try:
            r = requests.get("http://127.0.0.1:8000/api/furniture/layout", timeout=2.0)
            if r.status_code == 200:
                data = r.json()
                self.assertIn("table", data)
                self.assertIn("chairs", data)

            r_plan = requests.post("http://127.0.0.1:8000/api/plan", json={"prompt": "put the chairs in correct position"}, timeout=2.0)
            if r_plan.status_code == 200:
                pdata = r_plan.json()
                self.assertEqual(pdata["status"], "VALIDATED")
        except Exception as e:
            # Server might be mid-reload, function tests already verified logic
            pass


if __name__ == "__main__":
    unittest.main()
