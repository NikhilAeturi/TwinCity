"""
Tests for RoboTwin StuntStudio WebSocket streaming endpoint.
"""
import unittest
from fastapi.testclient import TestClient
from backend.app import app

class TestStuntWebSocket(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_stunt_locations_rest(self):
        resp = self.client.get("/api/stunt/locations")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("locations", data)
        self.assertGreaterEqual(len(data["locations"]), 5)

    def test_stunt_presets_rest(self):
        resp = self.client.get("/api/stunt/presets")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("presets", data)

    def test_stunt_plan_rest(self):
        payload = {
            "location_id": "san_francisco_rooftop",
            "stunt_type": "ROOFTOP_GAP_LEAP",
            "safety_rig": "NONE",
            "launch_speed": 6.8,
            "launch_pitch_deg": 22.0,
            "num_rotations": 0.0
        }
        resp = self.client.post("/api/stunt/plan", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("telemetry", data)
        self.assertIn("frames", data)
        self.assertGreater(len(data["frames"]), 0)

    def test_stunt_websocket_stream(self):
        payload = {
            "location_id": "manhattan_high_rise",
            "stunt_type": "BASE_JUMP_WIRE_ARREST",
            "safety_rig": "WIRE_HARNESS",
            "launch_speed": 3.0,
            "launch_pitch_deg": 10.0,
            "num_rotations": 0.0
        }
        with self.client.websocket_connect("/ws/stunt_stream") as websocket:
            websocket.send_json(payload)
            init_msg = websocket.receive_json()
            self.assertEqual(init_msg["type"], "STUNT_INITIALIZED")
            self.assertIn("telemetry", init_msg)

            # Request playback
            websocket.send_json({"action": "play", "playback_speed": 10.0})

            # Receive at least 3 stream frames
            received_frames = 0
            for _ in range(5):
                msg = websocket.receive_json()
                if msg["type"] == "STUNT_FRAME":
                    received_frames += 1
                    self.assertIn("frame_idx", msg)
                    self.assertIn("pos", msg)
                    self.assertIn("joints", msg)
                elif msg["type"] == "STUNT_COMPLETE":
                    break
            self.assertGreater(received_frames, 0)

if __name__ == "__main__":
    unittest.main()
