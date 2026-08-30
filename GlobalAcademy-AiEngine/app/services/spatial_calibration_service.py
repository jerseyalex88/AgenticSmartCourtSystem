# File: GlobalAcademy-AiEngine/app/services/spatial_calibration_service.py
import cv2
import numpy as np
from typing import Tuple, Dict, List
from app.schemas.court_diagnostics import CourtCalibrationInputSchema

class SpatialCalibrationService:
    # In-memory thread cache to hold calculated transformation matrices by court ID
    # Avoids reading disk storage files repeatedly during high-speed YOLO frame loops
    _matrix_cache: Dict[str, np.ndarray] = {}

    @classmethod
    def compute_homography_matrix(cls, payload: CourtCalibrationInputSchema) -> bool:
        """
        Takes 4 distorted camera screen pixels and computes an OpenCV Homography
        transformation matrix mapping them directly onto a pristine flat 2D layout grid surface.
        """
        if len(payload.corners) != 4:
            raise ValueError("Perspective calibration requires exactly 4 corner coordinates mapping boundary vertices.")

        # 1. Standardize input coordinate arrays (Source Points)
        src_points = np.array([
            [payload.corners[0].x, payload.corners[0].y],  # Top-Left
            [payload.corners[1].x, payload.corners[1].y],  # Top-Right
            [payload.corners[2].x, payload.corners[2].y],  # Bottom-Left
            [payload.corners[3].x, payload.corners[3].y]   # Bottom-Right
        ], dtype=np.float32)

        # 2. Define our clean Destination Target Grid (Destination Points)
        # We project directly onto an optimized 0-100 percentage grid space matrix,
        # which matches the absolute positioning coordinates expected by our React component canvas layer.
        dst_points = np.array([
            [5.0, 5.0],    # Top-Left inner court marker anchor (matches SVG viewBox buffer)
            [95.0, 5.0],   # Top-Right inner court marker anchor
            [5.0, 45.0],   # Bottom-Left inner court marker anchor
            [95.0, 45.0]   # Bottom-Right inner court marker anchor
        ], dtype=np.float32)

        try:
            # 3. Compute OpenCV perspective transformation matrix sheet parameters
            transform_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            
            # 4. Cache compiled result matrix securely in worker thread memory
            cls._matrix_cache[payload.court_id] = transform_matrix
            
            # Optional: Log out matrix summary strings for verification diagnostics
            print(f"\n📡 [SPATIAL CALIBRATION SUCCESS]: Calculated homography mapping for court {payload.court_id}.")
            return True
        except Exception as err:
            print(f"❌ [CALIBRATION CRASH] OpenCV matrix processing failure: {err}")
            return False

    @classmethod
    def unwarp_coordinate(cls, court_id: str, raw_x: float, raw_y: float) -> Tuple[float, float]:
        """
        Applies matrix multiplication over a single raw camera screen pixel coordinate (x,y),
        un-warping perspective distortion to output precise top-down percentage canvas coordinates.
        """
        matrix = cls._matrix_cache.get(court_id)
        
        if matrix is None:
            # Fallback envelope: If no matrix is calibrated yet, return central default ratios safely
            return (50.0, 25.0)

        # 1. Format raw input into a 3D matrix coordinate vector for projective geometry space
        input_vector = np.array([raw_x, raw_y, 1.0], dtype=np.float32)

        # 2. Run matrix dot-product translation multiplication
        transformed_vector = np.dot(matrix, input_vector)

        # 3. Normalize projective coordinate scale parameter back down to flat space arrays (Divide by Z-axis)
        z_scale = transformed_vector[2]
        if z_scale == 0:
            return (50.0, 25.0) # Safety boundary check to prevent division-by-zero crashes

        unwarped_x = float(transformed_vector[0] / z_scale)
        unwarped_y = float(transformed_vector[1] / z_scale)

        # 4. Clamp calculations safely within our SVG 0-100 canvas view percentages bounds
        unwarped_x = max(0.0, min(100.0, unwarped_x))
        unwarped_y = max(0.0, min(50.0, unwarped_y)) # Maximum height bounded cleanly inside our 100x50 court SVG box

        return (round(unwarped_x, 2), round(unwarped_y, 2))
