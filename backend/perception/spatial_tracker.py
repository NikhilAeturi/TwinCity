"""
RoboTwin Open-Source Visual-Inertial Spatial Odometry & Relative Anchor Engine.
Tracks 6-DoF smartphone camera movement across continuous video streams, provides
robust optical flow feature tracking (Lucas-Kanade), detects stationary/put-down states,
and maintains a globally unified spatial anchor graph so objects retain exact relative positions.
"""

import time
import math
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2

logger = logging.getLogger(__name__)


class SpatialTracker:
    """
    Real-Time 6-DoF Visual-Inertial Odometry and Multi-Object Spatial Anchor Engine.
    Enables live 3D reconstruction as the smartphone pans, tilts, lifts, or is set down.
    """

    def __init__(self):
        # Camera Pose in World Coordinates: X = Right, Y = Forward (depth into room), Z = Up
        self.cam_pos = np.array([0.0, 0.0, 1.25], dtype=np.float32)  # typical initial height ~1.25m
        self.cam_yaw = 0.0
        self.cam_pitch = -22.0
        self.cam_roll = 0.0

        # Trajectory history for Three.js frustum visualization
        self.trajectory: List[List[float]] = [[0.0, 0.0, 1.25]]
        self.max_trajectory_len = 60

        # Optical Flow Feature Tracking
        self.prev_gray: Optional[np.ndarray] = None
        self.prev_pts: Optional[np.ndarray] = None
        self.tracked_features: List[Dict[str, Any]] = []

        # Motion & Stationary State
        self.last_update_time = time.time()
        self.motion_state = "INITIALIZING"  # "TRACKING" | "STATIONARY" | "REACQUIRED"
        self.stationary_frames = 0
        self.stationary_threshold = 4  # frames with < 1.2px optical flow & < 1 deg gyro
        self.is_stationary = False

        # Persistent Spatial Anchors: Dict[str, Dict[str, Any]]
        # Keeps objects locked to world coordinates and tracks relative vectors
        self.spatial_anchors: Dict[str, Dict[str, Any]] = {}
        self.anchor_smoothing_alpha = 0.35  # Exponential moving average smoothing

        # Feature detector parameters
        self.feature_params = dict(
            maxCorners=150,
            qualityLevel=0.03,
            minDistance=15,
            blockSize=7
        )
        self.lk_params = dict(
            winSize=(21, 21),
            maxLevel=3,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 20, 0.03)
        )

    def update(
        self,
        frame: np.ndarray,
        orientation: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Processes a live camera video frame + phone IMU orientation:
        1. Updates 6-DoF camera pose (rotation from IMU, translation from optical flow).
        2. Detects whether phone was set down (stationary lock).
        3. Returns tracked visual feature points and updated camera trajectory.
        """
        now = time.time()
        dt = max(0.01, min(0.3, now - self.last_update_time))
        self.last_update_time = now

        if frame is None or frame.size == 0:
            return self.get_state()

        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame

        # 1. Update Camera Rotation from IMU
        if orientation:
            target_pitch = float(orientation.get("pitch", self.cam_pitch))
            target_yaw = float(orientation.get("yaw", self.cam_yaw))
            target_roll = float(orientation.get("roll", self.cam_roll))

            # Gyro delta for stationary detection
            gyro_delta = abs(target_pitch - self.cam_pitch) + abs(target_roll - self.cam_roll)
            self.cam_pitch = target_pitch
            self.cam_yaw = target_yaw
            self.cam_roll = target_roll
        else:
            gyro_delta = 0.0

        # 2. Visual Optical Flow Tracking
        mean_flow_mag = 0.0
        active_points_2d = []

        if self.prev_gray is not None and self.prev_pts is not None and len(self.prev_pts) > 6:
            p1, st, err = cv2.calcOpticalFlowPyrLK(self.prev_gray, gray, self.prev_pts, None, **self.lk_params)
            if p1 is not None:
                good_new = p1[st == 1]
                good_old = self.prev_pts[st == 1]

                if len(good_new) >= 6:
                    flow_vecs = good_new - good_old
                    flow_mags = np.linalg.norm(flow_vecs, axis=1)
                    mean_flow_mag = float(np.median(flow_mags))

                    # 2D tracked points for frontend AR overlay
                    subsample = max(1, len(good_new) // 40)
                    for pt in good_new[::subsample]:
                        active_points_2d.append([float(pt[0]), float(pt[1])])

                    # Estimate translation delta from flow divergence & lateral shift
                    # Forward translation creates radial expansion/contraction
                    cx, cy = w / 2.0, h / 2.0
                    rad_old = np.linalg.norm(good_old - np.array([cx, cy]), axis=1)
                    rad_new = np.linalg.norm(good_new - np.array([cx, cy]), axis=1)
                    scale_change = np.median(rad_new / (rad_old + 1e-4))

                    # Forward velocity along camera optical axis
                    forward_vel = 0.0
                    if 0.85 < scale_change < 1.18:
                        forward_vel = float((scale_change - 1.0) * 1.5)

                    # Lateral translation from median flow
                    median_dx = float(np.median(flow_vecs[:, 0])) / w
                    median_dy = float(np.median(flow_vecs[:, 1])) / h

                    # Rotate camera translation delta into room world coordinates
                    # Room frame: X = Right, Y = Forward, Z = Up
                    pitch_rad = math.radians(self.cam_pitch)
                    yaw_rad = math.radians(self.cam_yaw)

                    # Camera-relative translation
                    t_cam_x = -median_dx * 0.8  # lateral pan
                    t_cam_y = forward_vel * 0.6  # forward/back
                    t_cam_z = median_dy * 0.6  # vertical lift

                    # World rotation
                    cos_y, sin_y = math.cos(yaw_rad), math.sin(yaw_rad)
                    cos_p, sin_p = math.cos(pitch_rad), math.sin(pitch_rad)

                    world_dx = t_cam_x * cos_y - t_cam_y * sin_y
                    world_dy = t_cam_x * sin_y + t_cam_y * cos_y
                    world_dz = t_cam_z * cos_p

                    # Dampen and clamp velocity per frame
                    self.cam_pos[0] += float(np.clip(world_dx, -0.08, 0.08))
                    self.cam_pos[1] += float(np.clip(world_dy, -0.08, 0.08))
                    self.cam_pos[2] = float(np.clip(self.cam_pos[2] + world_dz, 0.45, 2.50))

                    self.prev_pts = good_new.reshape(-1, 1, 2)
                else:
                    self._reseed_features(gray)
            else:
                self._reseed_features(gray)
        else:
            self._reseed_features(gray)

        self.prev_gray = gray.copy()

        # 3. Stationary Detection (Phone set down on desk or held still)
        if mean_flow_mag < 1.4 and gyro_delta < 1.5:
            self.stationary_frames += 1
            if self.stationary_frames >= self.stationary_threshold:
                if not self.is_stationary:
                    logger.info("SpatialTracker: Phone entered STATIONARY state (Anchors Locked)")
                self.is_stationary = True
                self.motion_state = "STATIONARY"
        else:
            if self.is_stationary:
                logger.info("SpatialTracker: Phone resumed motion (Tracking Reacquired relative to anchors)")
                self.motion_state = "REACQUIRED"
            else:
                self.motion_state = "TRACKING"
            self.stationary_frames = 0
            self.is_stationary = False

        # 4. Append to trajectory
        cur_pos_list = [round(float(c), 3) for c in self.cam_pos]
        if len(self.trajectory) == 0 or np.linalg.norm(np.array(cur_pos_list) - np.array(self.trajectory[-1])) > 0.02:
            self.trajectory.append(cur_pos_list)
            if len(self.trajectory) > self.max_trajectory_len:
                self.trajectory.pop(0)

        self.tracked_features = active_points_2d
        return self.get_state()

    def _reseed_features(self, gray: np.ndarray):
        """Finds fresh feature points when tracking degrades."""
        pts = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
        if pts is not None:
            self.prev_pts = pts
        else:
            self.prev_pts = None

    def register_or_update_anchor(
        self,
        anchor_id: str,
        anchor_type: str,
        name: str,
        pos_world: List[float],
        size_metric: List[float],
        yaw_rad: float = 0.0,
        confidence: float = 0.9,
        relative_to_id: Optional[str] = None,
        extra_props: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Registers or smoothly updates a 3D object anchor in the global coordinate frame.
        Computes relative offset vectors to other anchors so relative spatial alignment is preserved.
        """
        alpha = self.anchor_smoothing_alpha

        if anchor_id in self.spatial_anchors:
            # Smooth position and size with Exponential Moving Average (EMA)
            cur = self.spatial_anchors[anchor_id]
            old_pos = np.array(cur["position"], dtype=np.float32)
            new_pos = np.array(pos_world, dtype=np.float32)
            smoothed_pos = (old_pos * (1.0 - alpha) + new_pos * alpha).tolist()

            old_size = np.array(cur["size"], dtype=np.float32)
            new_size = np.array(size_metric, dtype=np.float32)
            smoothed_size = (old_size * (1.0 - alpha) + new_size * alpha).tolist()

            cur["position"] = [round(p, 3) for p in smoothed_pos]
            cur["size"] = [round(s, 3) for s in smoothed_size]
            cur["yaw"] = round(float(yaw_rad), 3)
            cur["confidence"] = round(min(1.0, cur.get("confidence", 0.8) + 0.04), 2)
            cur["last_seen"] = time.time()
            cur["observations"] = cur.get("observations", 1) + 1
            if extra_props:
                cur.update(extra_props)
            return cur

        # Initialize new anchor
        anchor_entry = {
            "id": anchor_id,
            "type": anchor_type,
            "name": name,
            "position": [round(p, 3) for p in pos_world],
            "size": [round(s, 3) for s in size_metric],
            "yaw": round(float(yaw_rad), 3),
            "confidence": round(float(confidence), 2),
            "first_seen": time.time(),
            "last_seen": time.time(),
            "observations": 1,
            "locked": True,
            "relative_to": relative_to_id,
            "relative_vector": [0.0, 0.0, 0.0]
        }

        # Compute relative vector if reference anchor exists
        if relative_to_id and relative_to_id in self.spatial_anchors:
            ref_pos = np.array(self.spatial_anchors[relative_to_id]["position"])
            my_pos = np.array(pos_world)
            diff = (my_pos - ref_pos).tolist()
            anchor_entry["relative_vector"] = [round(d, 3) for d in diff]

        if extra_props:
            anchor_entry.update(extra_props)

        self.spatial_anchors[anchor_id] = anchor_entry
        logger.info(f"SpatialTracker: Anchored new 3D entity '{name}' [{anchor_id}] at {pos_world}")
        return anchor_entry

    def get_anchors_list(self) -> List[Dict[str, Any]]:
        """Returns all registered spatial anchors with their relative positions."""
        anchors = list(self.spatial_anchors.values())
        # Ensure primary reference (table_1) updates relative vectors for all other objects
        ref_anchor = self.spatial_anchors.get("table_1")
        if ref_anchor:
            ref_pos = np.array(ref_anchor["position"])
            for anc in anchors:
                if anc["id"] != "table_1":
                    diff = (np.array(anc["position"]) - ref_pos).tolist()
                    anc["relative_to"] = "table_1"
                    anc["relative_vector"] = [round(d, 2) for d in diff]

        return anchors

    def get_state(self) -> Dict[str, Any]:
        """Returns the full 6-DoF tracking state and active spatial anchors for the UI."""
        return {
            "motion_state": self.motion_state,
            "is_stationary": self.is_stationary,
            "camera_pose": {
                "position": [round(float(c), 3) for c in self.cam_pos],
                "rotation": {
                    "pitch": round(float(self.cam_pitch), 1),
                    "yaw": round(float(self.cam_yaw), 1),
                    "roll": round(float(self.cam_roll), 1)
                },
                "trajectory": self.trajectory
            },
            "tracked_points_2d": self.tracked_features,
            "tracked_count": len(self.tracked_features),
            "spatial_anchors": self.get_anchors_list(),
            "anchor_count": len(self.spatial_anchors)
        }

    def reset(self):
        """Resets camera trajectory and feature tracking while preserving or clearing anchors."""
        self.cam_pos = np.array([0.0, 0.0, 1.25], dtype=np.float32)
        self.trajectory = [[0.0, 0.0, 1.25]]
        self.prev_gray = None
        self.prev_pts = None
        self.tracked_features = []
        self.spatial_anchors = {}
        self.motion_state = "INITIALIZING"
        self.is_stationary = False
        self.stationary_frames = 0
