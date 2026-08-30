# File: GlobalAcademy-AiEngine/app/services/video_tracking_service.py
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

class VideoTrackingService:
    _yolo_model = YOLO("yolo11n.pt")

    @classmethod
    def queue_video_analysis(cls, court_id: str, academy_id: str, video_file_path: str, homography_matrix: Optional[np.ndarray] = None) -> str:
        job_id = str(uuid4())
        
        # 🎯 THE MATRIC THREAD TUNNEL: Force the background operating system thread worker 
        # to accept the compiled matrix array directly inside its execution argument package
        worker_thread = threading.Thread(
            target=cls._execute_frame_tracking_pipeline,
            args=(court_id, academy_id, job_id, video_file_path, homography_matrix)
        )
        worker_thread.daemon = True
        worker_thread.start()
        return job_id

    @classmethod
    def _execute_frame_tracking_pipeline(cls, court_id: str, academy_id: str, job_id: str, video_path: str, homography_matrix: Optional[np.ndarray] = None):
        print(f"\n📡 [BACKGROUND WORKER START]: Executing Job {job_id} for Court {court_id}")
        
        # Hydrate local thread cache memories instantly if a matrix is passed
        if homography_matrix is not None:
            clean_key = str(court_id).strip().replace('"', '').replace("'", "").lower()
            SpatialCalibrationService._matrix_cache[clean_key] = homography_matrix
            print(f"🧠 [THREAD MEMORY SEEDED]: Locked active calibration matrix for key: {clean_key}")

        video_capture = cv2.VideoCapture(video_path)
        if not video_capture.isOpened():
            print(f"❌ [IO ERROR] Failed to mount stream path: {video_path}")
            return

        frame_index = 0
        ball_trajectory_coordinates = []

        try:
            while video_capture.isOpened():
                success, frame_matrix = video_capture.read()
                if not success:
                    break
                frame_index += 1

                # 1. Track moving objects using YOLOv11 class 29 ('sports ball') specifically
                model_results_list = cls._yolo_model.predict(frame_matrix, classes=[29], verbose=False)

                if len(model_results_list) > 0:
                    frame_result = model_results_list[0]
                    
                    if frame_result.boxes is not None and len(frame_result.boxes) > 0:
                        # 🎯 FIXED: Access the first bounding box item safely
                        box = frame_result.boxes[0]
                        
                        # Flatten the confidence tensor into a clean float value
                        conf_tensor = box.conf.cpu().item() if hasattr(box.conf, "cpu") else float(box.conf)
                        
                        if conf_tensor > 0.20:
                            # 🎯 FIXED: Flatten the bounding box tensor directly into a standard flat 4-point list
                            coords_list = box.xyxy.cpu().numpy()[0].tolist() if hasattr(box.xyxy, "cpu") else box.xyxy[0].tolist()
                            
                            # coords_list is now guaranteed to be a flat array: [x1, y1, x2, y2]
                            x1, y1, x2, y2 = coords_list[0], coords_list[1], coords_list[2], coords_list[3]
                            
                            pixel_x_center = (x1 + x2) / 2.0
                            pixel_y_center = (y1 + y2) / 2.0
                            
                            ball_trajectory_coordinates.append((frame_index, pixel_x_center, pixel_y_center))

            video_capture.release()
            print(f"✅ [YOLO COMPLETE]: Extracted {len(ball_trajectory_coordinates)} valid ball frames trajectories.")

            # Pass clean points array into physics derivative calculator to isolate ground bounces
            unwarped_bounce_coordinates = TrajectoryMathService.extract_court_bounce_events(
                court_id=court_id,
                raw_trajectory=ball_trajectory_coordinates
            )

            # Compile into final 12-sector contract schema summary
            extracted_filename = os.path.basename(video_path)
            final_spatial_matrix_payload = SectorAggregationService.compile_spatial_summary(
                court_id=court_id,
                video_filename=extracted_filename,
                bounce_points=unwarped_bounce_coordinates
            )

            # Append the active academy identifier
            final_spatial_matrix_payload["academy_id"] = academy_id

            # Dispatch over network bridge straight to .NET Core gateway callback port
            base_gateway_url = os.getenv("DOTNET_GATEWAY_URL", "https://localhost:7290").strip("/")
            dotnet_callback_url = f"{base_gateway_url}/api/maintenance/court-spatial-heatmap/callback"
            
            try:
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(dotnet_callback_url, json=final_spatial_matrix_payload)
                    if response.status_code == 200:
                        print(f"🚀 [NETWORK SYNC SUCCESS]: Live data tracking coordinates pushed securely to .NET database channels!")
                    else:
                        print(f"❌ [NETWORK SYNC FAULT]: .NET rejected callback. Status: {response.status_code}")
            except Exception as net_err:
                print(f"❌ [NETWORK BRIDGE FAILURE]: Failed to reach .NET gateway: {net_err}")

        except Exception as crash_error:
            print(f"❌ [CRITICAL JOB RECONCILIATION FAULT] Vision Thread crashed: {crash_error}")
        finally:
            video_capture.release()
            if os.path.exists(video_path):
                try: os.remove(video_path)
                except OSError: pass

