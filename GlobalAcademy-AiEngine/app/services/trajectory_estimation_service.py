# File: GlobalAcademy-AiEngine/app/services/trajectory_estimation_service.py
import numpy as np
from typing import List, Tuple

class TrajectoryEstimationService:

    @classmethod
    def optimize_and_interpolate_trajectory(cls, raw_trajectory: List[Tuple[int, float, float]]) -> List[Tuple[int, float, float]]:
        """
        Applies a Linear Kalman Filter to remove camera jitter noise, 
        then uses linear state estimation to fill frame drops caused by high-speed motion blur.
        """
        if len(raw_trajectory) < 3:
            return raw_trajectory

        # 1. Initialize Kalman Filter State Matrix Parameters
        # State Vector: [Position_X, Position_Y, Velocity_X, Velocity_Y]
        dt = 1.0  # Frame step delta
        
        # State Transition Matrix (Constant Velocity Physics Model)
        A = np.array([
            [1.0, 0.0,  dt, 0.0],
            [0.0, 1.0, 0.0,  dt],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=np.float32)

        # Observation Matrix (We only directly measure screen pixel positions X and Y)
        H = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0]
        ], dtype=np.float32)

        # Covariance Matrices (Noise filters)
        Q = np.eye(4, dtype=np.float32) * 0.1   # Process Noise Covariance
        R = np.eye(2, dtype=np.float32) * 2.0   # Measurement Noise Covariance
        P = np.eye(4, dtype=np.float32) * 10.0  # Initial State Estimation Error Covariance

        # Seed initial state with the first detected frame coordinates
        first_frame, first_x, first_y = raw_trajectory[0]
        state = np.array([first_x, first_y, 0.0, 0.0], dtype=np.float32)

        # Map raw coordinate timeline into a rapid lookup dictionary
        raw_map = {frame: (x, y) for frame, x, y in raw_trajectory}
        start_frame = raw_trajectory[0][0]
        end_frame = raw_trajectory[-1][0]

        optimized_trajectory: List[Tuple[int, float, float]] = []

        # 2. Continuous State Estimation Tracking Loop
        for frame in range(start_frame, end_frame + 1):
            
            # --- KALMAN PREDICT STEP ---
            state = np.dot(A, state)
            P = np.dot(A, np.dot(P, A.T)) + Q

            # Check if YOLO successfully captured the ball inside this frame slice
            if frame in raw_map:
                measured_x, measured_y = raw_map[frame]
                z = np.array([measured_x, measured_y], dtype=np.float32)

                # --- KALMAN UPDATE/CORRECT STEP ---
                y = z - np.dot(H, state)  # Measurement residual innovation
                S = np.dot(H, np.dot(P, H.T)) + R
                K = np.dot(P, np.dot(H.T, np.linalg.inv(S)))  # Optimal Kalman Gain Matrix
                
                state = state + np.dot(K, y)
                P = P - np.dot(K, np.dot(H, P))
                
                # Append verified, smoothed coordinate
                optimized_trajectory.append((frame, float(state[0]), float(state[1])))
            else:
                # 🧠 MOTION BLUR INTERPOLATION EXTRACTION
                # If YOLO missed this frame, use the Kalman Filter's internal predictive velocity 
                # coefficients to estimate the ball's coordinates as it travels through hidden space!
                if len(optimized_trajectory) > 0:
                    consecutive_misses = frame - optimized_trajectory[-1][0]
                    
                    if consecutive_misses <= 5:  # Only interpolate short blur gaps to prevent tracking anomalies
                        optimized_trajectory.append((frame, float(state[0]), float(state[1])))

        print(f"📈 [KALMAN FILTER INTENSITY]: Reclaimed {len(optimized_trajectory) - len(raw_trajectory)} blurred motion frames!")
        return optimized_trajectory
