"""
RoboTwin Cinematic Camera Rail & Spline Director.
Translates user-drawn 3D camera paths on the Google Maps satellite view into
smooth Catmull-Rom spline flight paths with dynamic target-tracking optics
(locking onto crash impact points, speeding vehicles, or smooth tangent sweeps).
"""

import math
from typing import Dict, Any, List, Optional, Tuple

METERS_PER_DEG_LAT = 111320.0

def meters_to_lat_lng(center_lat: float, center_lng: float, dx: float, dy: float, alt: float = 20.0) -> Dict[str, float]:
    d_lat = dy / METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    d_lng = dx / (METERS_PER_DEG_LAT * cos_lat)
    return {
        "lat": round(center_lat + d_lat, 7),
        "lng": round(center_lng + d_lng, 7),
        "altitude": round(alt, 2)
    }

def lat_lng_to_meters(center_lat: float, center_lng: float, lat: float, lng: float) -> Tuple[float, float]:
    dy = (lat - center_lat) * METERS_PER_DEG_LAT
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    dx = (lng - center_lng) * (METERS_PER_DEG_LAT * cos_lat)
    return dx, dy

def catmull_rom(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    """1D Catmull-Rom cubic spline interpolation."""
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )

def catmull_rom_3d(pts: List[Tuple[float, float, float]], u: float) -> Tuple[float, float, float]:
    """Evaluates 3D Catmull-Rom spline at normalized parameter u in [0, 1]."""
    n = len(pts)
    if n == 1:
        return pts[0]
    if n == 2:
        p0, p1 = pts[0], pts[1]
        return (
            p0[0] + (p1[0] - p0[0]) * u,
            p0[1] + (p1[1] - p0[1]) * u,
            p0[2] + (p1[2] - p0[2]) * u
        )

    # Scaled parameter across n - 1 segments
    val = max(0.0, min(float(n - 1), u * (n - 1)))
    idx = int(math.floor(val))
    t = val - idx

    if idx >= n - 1:
        return pts[-1]

    p0 = pts[max(0, idx - 1)]
    p1 = pts[idx]
    p2 = pts[min(n - 1, idx + 1)]
    p3 = pts[min(n - 1, idx + 2)]

    return (
        catmull_rom(p0[0], p1[0], p2[0], p3[0], t),
        catmull_rom(p0[1], p1[1], p2[1], p3[1], t),
        catmull_rom(p0[2], p1[2], p2[2], p3[2], t)
    )

def spline_tangent_3d(pts: List[Tuple[float, float, float]], u: float) -> Tuple[float, float, float]:
    """Computes normalized unit forward tangent vector along Catmull-Rom spline at u."""
    delta = 0.005
    u_prev = max(0.0, u - delta)
    u_next = min(1.0, u + delta)
    p0 = catmull_rom_3d(pts, u_prev)
    p1 = catmull_rom_3d(pts, u_next)
    dx = p1[0] - p0[0]
    dy = p1[1] - p0[1]
    dz = p1[2] - p0[2]
    mag = math.sqrt(dx * dx + dy * dy + dz * dz)
    if mag < 1e-4:
        return (0.0, 1.0, 0.0)
    return (dx / mag, dy / mag, dz / mag)


class CameraDirector:
    """
    Computes cinematic camera motion trajectories from user-drawn rails and target tracking.
    Harmonized with Google Maps Photorealistic 3D (gmp-map-3d) optical parameters:
    - center: Geographic coordinates of the target point being focused on.
    - range: Distance in meters from camera eye to target focal center.
    - heading: Compass direction pointing from camera eye towards target.
    - tilt: Angle from downward vertical (0° = nadir top-down, 90° = horizontal).
    """

    def __init__(self):
        pass

    def interpolate_camera_rail(
        self,
        waypoints: List[Dict[str, Any]],
        center_lat: float,
        center_lng: float,
        duration_sec: float = 6.0,
        fps: int = 60,
        tracking_mode: str = "track_impact",
        target_point: Optional[Dict[str, float]] = None,
        scene_frames: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Takes user-drawn 3D camera waypoints and compiles a smooth 60 FPS camera rail.
        Mathematically aligns camera eye along the flight spline while orienting the optical
        axis precisely at the designated dynamic target (lead vehicle, impact zone, or forward tangent).
        """
        if not waypoints:
            return []

        # Convert waypoints to metric (dx, dy, alt) relative to stage center
        metric_pts: List[Tuple[float, float, float]] = []
        for w in waypoints:
            lat = float(w.get("lat", center_lat))
            lng = float(w.get("lng", center_lng))
            alt = float(w.get("altitude", 25.0))
            dx, dy = lat_lng_to_meters(center_lat, center_lng, lat, lng)
            metric_pts.append((dx, dy, alt))

        total_frames = int(max(1.0, duration_sec) * fps)
        camera_frames: List[Dict[str, Any]] = []

        # Default focal point is stage origin (impact center)
        tgt_dx, tgt_dy = 0.0, 0.0
        base_ground_alt = float(target_point.get("altitude", 20.0)) if target_point else 20.0
        tgt_alt = base_ground_alt + 1.2

        if target_point:
            tgt_dx, tgt_dy = lat_lng_to_meters(
                center_lat, center_lng,
                float(target_point.get("lat", center_lat)),
                float(target_point.get("lng", center_lng))
            )
            tgt_alt = float(target_point.get("altitude", base_ground_alt)) + 1.2

        last_valid_heading = 0.0

        for f_idx in range(total_frames):
            u = f_idx / max(1, total_frames - 1)
            t = (f_idx / total_frames) * duration_sec

            # 1. Camera eye position along spline
            cam_x, cam_y, cam_z = catmull_rom_3d(metric_pts, u)

            # 2. Determine target position based on tracking mode
            cur_tgt_x, cur_tgt_y, cur_tgt_z = tgt_dx, tgt_dy, tgt_alt

            if tracking_mode == "rail_tangent":
                # Look straight along flight rail velocity vector
                tx, ty, tz = spline_tangent_3d(metric_pts, u)
                look_dist = 30.0
                cur_tgt_x = cam_x + tx * look_dist
                cur_tgt_y = cam_y + ty * look_dist
                cur_tgt_z = cam_z + tz * look_dist
            elif scene_frames and f_idx < len(scene_frames):
                frame_data = scene_frames[f_idx]
                actors = frame_data.get("actors", [])

                if (tracking_mode == "track_lead" or tracking_mode == "chase_lead") and len(actors) > 0:
                    a = actors[0]
                    cur_tgt_x, cur_tgt_y = lat_lng_to_meters(center_lat, center_lng, a["lat"], a["lng"])
                    cur_tgt_z = base_ground_alt + float(a.get("altitude", 0.0)) + 1.2
                elif tracking_mode == "track_target" and len(actors) > 1:
                    a = actors[1]
                    cur_tgt_x, cur_tgt_y = lat_lng_to_meters(center_lat, center_lng, a["lat"], a["lng"])
                    cur_tgt_z = base_ground_alt + float(a.get("altitude", 0.0)) + 1.2
                elif tracking_mode == "track_impact" and target_point:
                    cur_tgt_x, cur_tgt_y = tgt_dx, tgt_dy
                    cur_tgt_z = tgt_alt

            # 3. Compute vector from camera eye to focal target
            dx = cur_tgt_x - cam_x
            dy = cur_tgt_y - cam_y
            dz = cur_tgt_z - cam_z

            h_dist = math.hypot(dx, dy)
            tot_dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            # 4. Heading: Compass degrees from camera to target (0 = North/+Y, 90 = East/+X)
            if h_dist > 0.01:
                heading = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
                last_valid_heading = heading
            else:
                heading = last_valid_heading

            # 5. Tilt in Google Maps 3D (0° = looking straight down, 90° = horizontal)
            # pitch_rad is angle below horizontal line of sight
            pitch_rad = math.atan2(-dz, max(0.1, h_dist))
            raw_tilt = math.degrees(math.pi / 2.0 - pitch_rad)
            tilt = round(min(84.0, max(25.0, raw_tilt)), 1)

            # 6. Ensure range is clamped to stable visual bounds
            safe_range = max(10.0, min(350.0, round(tot_dist, 2)))

            # 7. Convert focal target and camera eye to GPS coordinates
            geo_tgt = meters_to_lat_lng(center_lat, center_lng, cur_tgt_x, cur_tgt_y, alt=cur_tgt_z)
            geo_cam = meters_to_lat_lng(center_lat, center_lng, cam_x, cam_y, alt=cam_z)

            camera_frames.append({
                "frame": f_idx,
                "timestamp": round(t, 3),
                # center is the focal target in Google Maps 3D
                "center": {
                    "lat": geo_tgt["lat"],
                    "lng": geo_tgt["lng"],
                    "altitude": geo_tgt["altitude"]
                },
                # camera_pos records the exact physical eye coordinates along the rail
                "camera_pos": {
                    "lat": geo_cam["lat"],
                    "lng": geo_cam["lng"],
                    "altitude": geo_cam["altitude"]
                },
                "heading": round(heading, 1),
                "tilt": tilt,
                "range": safe_range,
                "roll": 0.0
            })

        return camera_frames

camera_director = CameraDirector()
