# File: GlobalAcademy-AiEngine/app/services/trajectory_math_service.py
import math
from typing import List, Tuple
from app.services.spatial_calibration_service import SpatialCalibrationService

class TrajectoryMathService:

    @classmethod
    def extract_court_bounce_events(cls, court_id: str, raw_trajectory: List[Tuple[int, float, float]]) -> List[Tuple[float, float, str]]:
        """
        Processes a raw frame-by-frame pixel coordinate trail to catch tennis ball bounces:
        1. Step 3: Implements a calculus deflection filter tracing vertical velocity shifts.
        2. Step 4: Invokes the cached OpenCV Homography matrix to un-warp pixel bounds into court percentages.
        """
        if len(raw_trajectory) < 5:
            return [] # Insufficient frame records to evaluate derivatives

        detected_bounce_points: List[Tuple[float, float, str]] = []
        
        # --- 🛠️ STEP 3: TRAJECTORY VELOCITY INTERCEPT DEFLECTION LOGIC ---
        # We look for the exact frame coordinate where the ball's downward vertical motion 
        # instantly shifts into a sharp upward rebound vector (the physics inflection point).
        for i in range(2, len(raw_trajectory) - 2):
            prev_frame, _, prev_y = raw_trajectory[i - 1]
            curr_frame, curr_x, curr_y = raw_trajectory[i]
            next_frame, _, next_y = raw_trajectory[i + 1]

            # Calculate immediate vertical direction displacements (Delta Y)
            # Note: In screen computer vision pixels, Y=0 is at the top, so moving down increases Y.
            downward_velocity_inbound = curr_y - prev_y
            upward_velocity_outbound = next_y - curr_y

            # Catch the deflection: ball was moving down (displacement > 0) 
            # and instantly snapped to moving upwards (displacement < 0)
            if downward_velocity_inbound > 1.5 and upward_velocity_outbound < -1.5:
                
                # Verify stability by looking one step further ahead to filter out camera noise jitter
                _, _, far_next_y = raw_trajectory[i + 2]
                if far_next_y < next_y: # Confirms the ball is steadily climbing back up into the air
                    
                    # --- 🛠️ STEP 4: SPATIAL 2D COORDINATE TRANSFORMATION ---
                    # We have a verified bounce! Pass the raw screen pixel coordinates (curr_x, curr_y) 
                    # straight into your cached OpenCV homography service to un-warp the perspective distortion.
                    unwarped_x, unwarped_y = SpatialCalibrationService.unwarp_coordinate(
                        court_id=court_id, 
                        raw_x=curr_x, 
                        raw_y=curr_y
                    )

                    # Determine heat intensity classifications based on proximity to the deep baseline areas
                    # Baseline sectors typically sustain much heavier structural impact erosion force
                    intensity = "High" if (unwarped_x < 28.0 or unwarped_x > 72.0) else "Moderate"
                    if 35.0 < unwarped_x < 65.0 and 15.0 < unwarped_y < 35.0:
                        intensity = "Low" # Volleys inside the service boxes register a lower structural fatigue footprint

                    detected_bounce_points.append((unwarped_x, unwarped_y, intensity))

        return detected_bounce_points
