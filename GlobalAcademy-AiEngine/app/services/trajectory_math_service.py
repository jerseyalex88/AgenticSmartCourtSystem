# File: GlobalAcademy-AiEngine/app/services/trajectory_math_service.py
import math
from typing import List, Tuple
from app.services.spatial_calibration_service import SpatialCalibrationService

class TrajectoryMathService:

    @classmethod
    def extract_court_bounce_events(cls, court_id: str, raw_trajectory: List[Tuple[int, float, float]]) -> List[Tuple[float, float, str]]:
        """
        Advanced 2D Velocity Vector Magnitude Filter:
        Traces sudden acceleration and directional inflections across both X and Y space
        simultaneously to catch high-speed shots and slices accurately.
        """
        if len(raw_trajectory) < 5:
            return []

        detected_bounce_points: List[Tuple[float, float, str]] = []
        clean_court_key = str(court_id).strip().replace('"', '').replace("'", "").lower()

        # Step through frame coordinate sequences
        for i in range(2, len(raw_trajectory) - 2):
            prev_frame, prev_x, prev_y = raw_trajectory[i - 1]
            curr_frame, curr_x, curr_y = raw_trajectory[i]
            next_frame, next_x, next_y = raw_trajectory[i + 1]

            # 1. Calculate incoming and outgoing 2D velocity vector components (Delta X, Delta Y)
            v_in_x = curr_x - prev_x
            v_in_y = curr_y - prev_y
            
            v_out_x = next_x - curr_x
            v_out_y = next_y - curr_y

            # 2. Compute absolute velocity magnitudes (speeds) using Pythagorean theorem
            speed_inbound = math.sqrt(v_in_x**2 + v_in_y**2)
            speed_outbound = math.sqrt(v_out_x**2 + v_out_y**2)

            # 3. Trace vector dot product inflection shifts
            # If the ball changes direction sharply, the dot product of its velocity vectors drops significantly
            dot_product = (v_in_x * v_out_x) + (v_in_y * v_out_y)
            
            # Prevent division by zero errors safely
            if speed_inbound == 0 or speed_outbound == 0:
                continue

            # Calculate the cosine of the angle change (1.0 means perfectly straight line, lower means curving/snapping)
            cos_angle = dot_product / (speed_inbound * speed_outbound)

            # 🎯 THE REBOUND DETECTOR:
            # A true ground strike occurs when there is a sharp angle deflection (cos_angle < 0.85)
            # OR a sudden change in vertical Y velocity acceleration signs (ball bouncing off the ground)
            is_deflection = cos_angle < 0.85
            is_y_bounce = v_in_y > 0.2 and v_out_y < -0.2

            if is_deflection or is_y_bounce:
                # Run lookahead verification to filter out camera noise jitter
                _, future_x, future_y = raw_trajectory[i + 1]
                v_future_y = future_y - next_y
                
                # Check that the trajectory continues smoothly after the bounce point
                if abs(v_future_y - v_out_y) < 15.0:
                    
                    # Compute un-warped top-down percentage coordinates using your cached matrix
                    unwarped_x, unwarped_y = SpatialCalibrationService.unwarp_coordinate(
                        court_id=clean_court_key, 
                        raw_x=curr_x, 
                        raw_y=curr_y
                    )

                    # Classify wear intensities based on baseline proximity
                    intensity = "High" if (unwarped_x < 28.0 or unwarped_x > 72.0) else "Moderate"
                    if 35.0 < unwarped_x < 65.0 and 15.0 < unwarped_y < 35.0:
                        intensity = "Low"

                    # Avoid recording duplicate clicks across consecutive frames of the same bounce bounce
                    if len(detected_bounce_points) > 0:
                        last_x, last_y, _ = detected_bounce_points[-1]
                        if abs(unwarped_x - last_x) < 2.0 and abs(unwarped_y - last_y) < 2.0:
                            continue # Skip duplicate frame captures of the exact same event

                    detected_bounce_points.append((unwarped_x, unwarped_y, intensity))
                    print(f"   🎯 PHYSICAL BOUNCE REGISTERED at Frame {curr_frame} -> X: {unwarped_x}%, Y: {unwarped_y}%")

        print(f"✅ [TRAJECTORY CALCULATOR SUCCESS]: Isolated {len(detected_bounce_points)} true ground bounce events.")
        return detected_bounce_points
