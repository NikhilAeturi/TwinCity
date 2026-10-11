"""
RoboTwin Depth Estimator
Multi-engine monocular depth estimation pipeline:
1. Depth Anything V2 (Small) via HuggingFace transformers (State of the art metric depth)
2. MiDaS Small via torch.hub (Lightweight, robust relative depth)
3. Fast Edge-Guided Perspective Estimator (Instant zero-latency fallback)

Supports Apple Silicon Metal (MPS) acceleration and CUDA when available.
"""

import numpy as np
import cv2
import logging
import threading
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)


class DepthEstimator:
    """
    Wraps monocular depth estimation engines. Processes RGB frames and returns
    dense depth maps suitable for point cloud back-projection.
    """

    def __init__(self, preferred_engine: str = "depth_anything_v2"):
        self.preferred_engine = preferred_engine
        self.active_engine = "fast_gradient"  # Starts in fast mode immediately
        self.model = None
        self.transform = None
        self.device = "cpu"
        self._deep_model_ready = False
        self._loading = False
        self._load_error = None

        # Check acceleration
        self._detect_device()

        # Start loading the requested deep model in background thread
        self.start_background_loader()

    def _detect_device(self):
        try:
            import torch
            if torch.backends.mps.is_available():
                self.device = "mps"
                logger.info("RoboTwin Perception using Apple Silicon Metal (MPS) GPU acceleration")
            elif torch.cuda.is_available():
                self.device = "cuda"
                logger.info("RoboTwin Perception using CUDA GPU acceleration")
            else:
                self.device = "cpu"
                logger.info("RoboTwin Perception using CPU device")
        except Exception:
            self.device = "cpu"

    def start_background_loader(self):
        """Asynchronously loads deep learning depth models without blocking server startup."""
        if self._loading or self._deep_model_ready:
            return
        self._loading = True
        thread = threading.Thread(target=self._load_deep_model, daemon=True)
        thread.start()

    def _load_deep_model(self):
        logger.info(f"Attempting to load preferred depth engine: {self.preferred_engine}")
        
        # 1. Try Depth Anything V2 Small
        if self.preferred_engine in ("depth_anything_v2", "auto"):
            try:
                from transformers import pipeline
                import torch
                dev_id = 0 if self.device == "cuda" else -1
                logger.info("Loading Depth Anything V2 Small pipeline...")
                self.model = pipeline(
                    task="depth-estimation",
                    model="depth-anything/Depth-Anything-V2-Small-hf",
                    device=dev_id,
                )
                self.active_engine = "depth_anything_v2_small"
                self._deep_model_ready = True
                self._loading = False
                logger.info("Depth Anything V2 Small loaded and active!")
                return
            except Exception as e:
                logger.warning(f"Could not load Depth Anything V2: {e}. Falling back to MiDaS...")
                self._load_error = str(e)

        # 2. Try MiDaS Small
        try:
            import torch
            logger.info("Loading MiDaS Small via torch.hub...")
            model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", trust_repo=True)
            model.to(self.device).eval()
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
            self.model = model
            self.transform = midas_transforms.small_transform
            self.active_engine = "midas_small"
            self._deep_model_ready = True
            self._loading = False
            logger.info("MiDaS Small loaded successfully!")
            return
        except Exception as e:
            logger.warning(f"Could not load MiDaS: {e}. Using Fast Edge-Guided Perspective Estimator.")
            self._load_error = str(e)

        self._loading = False
        self.active_engine = "fast_gradient"

    @property
    def is_ready(self) -> bool:
        return True  # Always ready due to fast fallback

    def get_status(self) -> Dict[str, Any]:
        return {
            "active_engine": self.active_engine,
            "preferred_engine": self.preferred_engine,
            "deep_model_ready": self._deep_model_ready,
            "loading": self._loading,
            "device": self.device,
            "error": self._load_error
        }

    def set_engine(self, engine_name: str):
        if engine_name == "fast_gradient":
            self.active_engine = "fast_gradient"
        elif engine_name in ("depth_anything_v2", "midas_small"):
            self.preferred_engine = engine_name
            if not self._deep_model_ready and not self._loading:
                self.start_background_loader()

    def estimate_depth(self, rgb_frame: np.ndarray) -> np.ndarray:
        """
        Takes an RGB or BGR numpy image (H, W, 3) uint8 and returns a depth map (H, W) float32.
        Values are scaled where higher = closer or metric distance depending on mode.
        """
        if self._deep_model_ready and self.model is not None:
            try:
                if "depth_anything" in self.active_engine:
                    return self._estimate_hf(rgb_frame)
                elif "midas" in self.active_engine:
                    return self._estimate_midas(rgb_frame)
            except Exception as e:
                logger.warning(f"Deep inference failed ({e}), falling back to fast estimator")

        return self._estimate_fast(rgb_frame)

    def _estimate_hf(self, rgb_frame: np.ndarray) -> np.ndarray:
        """Depth Anything V2 Small inference."""
        from PIL import Image

        if rgb_frame.shape[2] == 3:
            pil_img = Image.fromarray(cv2.cvtColor(rgb_frame, cv2.COLOR_BGR2RGB))
        else:
            pil_img = Image.fromarray(rgb_frame)

        result = self.model(pil_img)
        depth_pil = result["depth"]
        depth_np = np.array(depth_pil, dtype=np.float32)

        if depth_np.shape[:2] != rgb_frame.shape[:2]:
            depth_np = cv2.resize(depth_np, (rgb_frame.shape[1], rgb_frame.shape[0]),
                                  interpolation=cv2.INTER_LINEAR)

        return depth_np

    def _estimate_midas(self, rgb_frame: np.ndarray) -> np.ndarray:
        """MiDaS Small inference."""
        import torch

        img_rgb = cv2.cvtColor(rgb_frame, cv2.COLOR_BGR2RGB) if rgb_frame.ndim == 3 else rgb_frame
        input_batch = self.transform(img_rgb).to(self.device)

        with torch.no_grad():
            prediction = self.model(input_batch)
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=rgb_frame.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()

        return prediction.cpu().numpy().astype(np.float32)

    def _estimate_fast(self, frame: np.ndarray) -> np.ndarray:
        """
        Fast Edge-Guided Perspective Estimator (runs in <2ms on CPU).
        Combines:
        1. Perspective ground plane gradient (lower pixels in handheld camera are physically closer)
        2. Edge & high-frequency texture cues (prominent object boundaries)
        3. Bilateral smoothing to preserve sharp obstacle boundaries
        """
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 and frame.shape[2] == 3 else frame

        # Perspective vertical depth gradient: floor / desk is closer at bottom (v=h) than at top (v=0)
        v_gradient = np.linspace(0.2, 1.0, h, dtype=np.float32)[:, None]
        base_depth = np.tile(v_gradient, (1, w))

        # Horizontal subtle vignetting (camera center is slightly closer)
        u_gradient = 1.0 - 0.15 * (np.abs(np.linspace(-1.0, 1.0, w, dtype=np.float32)[None, :]))
        base_depth = base_depth * u_gradient

        # Detect high-contrast object edges (tables, bottles, obstacles)
        sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        edge_mag = cv2.magnitude(sobelx, sobely)
        cv2.normalize(edge_mag, edge_mag, 0.0, 0.35, cv2.NORM_MINMAX)

        # Bilateral blur on luminance for smooth object surfaces
        small_gray = cv2.resize(gray, (w // 2, h // 2))
        blurred = cv2.bilateralFilter(small_gray, 5, 50, 50)
        blurred = cv2.resize(blurred, (w, h)).astype(np.float32) / 255.0

        # Combine cues into depth map
        depth = base_depth * 0.65 + blurred * 0.25 + edge_mag * 0.10
        cv2.normalize(depth, depth, 0.0, 1.0, cv2.NORM_MINMAX)

        return depth.astype(np.float32)

    def depth_to_colormap(self, depth_map: np.ndarray, colormap: int = cv2.COLORMAP_TURBO) -> np.ndarray:
        """Converts a single-channel depth map to a beautiful colorized heatmap (BGR image)."""
        d_min, d_max = depth_map.min(), depth_map.max()
        if d_max - d_min > 1e-6:
            depth_norm = ((depth_map - d_min) / (d_max - d_min) * 255).astype(np.uint8)
        else:
            depth_norm = np.zeros_like(depth_map, dtype=np.uint8)

        return cv2.applyColorMap(depth_norm, colormap)
