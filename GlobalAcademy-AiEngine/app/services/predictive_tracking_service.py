# File: GlobalAcademy-AiEngine/app/services/predictive_tracking_service.py
import os
import cv2
import threading
import httpx
import numpy as np
from typing import List, Tuple, Optional
from uuid import uuid4
from ultralytics import YOLO
from app.services.spatial_calibration_service import SpatialCalibrationService
from app.services.trajectory_math_service import TrajectoryMathService
from app.services.sector_aggregation_service import SectorAggregationService
# 🔮 NEW: Import your Kalman Trajectory Estimation module
from app.services.trajectory_estimation_service import TrajectoryEstimationService

class PredictiveTrackingService:
    _yolo_model = YOLO("yolo11n.pt")

    @classmethod
    def queue_predictive_analysis(cls, court_id: str, academy_id: str, video_file_path: str, homography_matrix: Optional[np.ndarray] = None) -> str:
        job_id = str(uuid4())
        
        # Spawn an isolated parallel background worker thread
        worker_thread = threading.Thread(
            target=cls._execute_predictive_pipeline,
            args=(court_id, academy_id, job_id, video_file_path, homography_matrix)
        )
        worker_thread.daemon = True
        worker_thread.start()
        return job_id

    @classmethod
    def _execute_predictive_pipeline(cls, court_id: str, academy_id: str, job_id: str, video_path: str, homography_matrix: Optional[np.ndarray] = None):
        print(f"\n🔮 [PREDICTIVE BACKGROUND WORKER START]: Executing Job {job_id} for Court {court_id}")
        
        if homography_matrix is not None:
            clean_key = str(court_id).strip().replace('"', '').replace("'", "").lower()
            SpatialCalibrationService._matrix_cache[clean_key] = homography_matrix

        video_capture = cv2.VideoCapture(video_path)
        if not video_capture.isOpened():
            return

        frame_index = 0
        ball_trajectory_coordinates = []

        try:
            while video_capture.isOpened():
                success, frame_matrix = video_capture.read()
                if not success:
                    break
                frame_index += 1

                # Track moving items using YOLOv11 (sports ball class 29)
                model_results_list = cls._yolo_model.predict(frame_matrix, classes=[29], verbose=False)

                if len(model_results_list) > 0:
                    frame_result = model_results_list[0]
                    if frame_result.boxes is not None and len(frame_result.boxes) > 0:
                        box = frame_result.boxes[0]
                        conf_tensor = box.conf.cpu().item() if hasattr(box.conf, "cpu") else float(box.conf)
                        
                        if conf_tensor > 0.20:
                            coords_list = box.xyxy.cpu().numpy().tolist() if hasattr(box.xyxy, "cpu") else box.xyxy.tolist()
                            
                            # 🎯 FIXED: Extract from row index 0 to target the floating point coordinates directly!
                            if len(coords_list) > 0 and isinstance(coords_list[0], list):
                                flat_coords = coords_list[0]
                                x1, y1, x2, y2 = flat_coords[0], flat_coords[1], flat_coords[2], flat_coords[3]
                                
                                pixel_x_center = (x1 + x2) / 2.0
                                pixel_y_center = (y1 + y2) / 2.0
                                ball_trajectory_coordinates.append((frame_index, pixel_x_center, pixel_y_center))

            video_capture.release()
            print(f"✅ [PREDICTIVE YOLO COMPLETE]: Extracted {len(ball_trajectory_coordinates)} base coordinate nodes.")

            # =========================================================================
            # 🔮 KALMAN STATE EXTRAPOLATION ENGINE ACTIVATED
            # =========================================================================
            # Reconstruct missing coordinate trails lost to rapid frame motion blur
            interpolated_trajectory = TrajectoryEstimationService.optimize_and_interpolate_trajectory(
                raw_trajectory=ball_trajectory_coordinates
            )
            # =========================================================================

            # Pass the rich, continuous trajectory through your 2D velocity math filter
            unwarped_bounce_coordinates = TrajectoryMathService.extract_court_bounce_events(
                court_id=court_id,
                raw_trajectory=interpolated_trajectory
            )

            # Compile into our 12-sector matrix payload structure
            extracted_filename = os.path.basename(video_path)
            final_spatial_matrix_payload = SectorAggregationService.compile_spatial_summary(
                court_id=court_id,
                video_filename=extracted_filename,
                bounce_points=unwarped_bounce_coordinates
            )

            final_spatial_matrix_payload["academy_id"] = academy_id

            # Dispatch back across internal network bridges to your new C# predictive controller endpoint
            base_gateway_url = os.getenv("DOTNET_GATEWAY_URL", "https://localhost:7290").strip("/")
            dotnet_callback_url = f"{base_gateway_url}/api/maintenance/court-predictive-heatmap/callback"

            print(f"dotnet_callback_url: {dotnet_callback_url}")
            print(f"final_spatial_matrix_payload: {final_spatial_matrix_payload}")

            try:
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(dotnet_callback_url, json=final_spatial_matrix_payload)
                    if response.status_code == 200:
                        print(f"🚀 [PREDICTIVE SYNC SUCCESS]: Advanced Kalman analytics committed to Postgres columns!")
                    else:
                        print(f"❌ [PREDICTIVE SYNC FAULT]: .NET rejected callback. Status: {response.status_code}")
            except Exception as net_err:
                print(f"❌ [PREDICTIVE NET FAILURE]: Failed to reach .NET gateway: {net_err}")

        except Exception as crash_error:
            print(f"❌ [PREDICTIVE PIPELINE CRASH]: {crash_error}")
        finally:
            video_capture.release()
            if os.path.exists(video_path):
                try: os.remove(video_path)
                except OSError: pass
