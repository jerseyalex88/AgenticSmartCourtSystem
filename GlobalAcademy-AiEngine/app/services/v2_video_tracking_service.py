# File: GlobalAcademy-AiEngine/app/services/v2_video_tracking_service.py
import os
import time
import cv2
import httpx
import numpy as np
from typing import Optional
from uuid import uuid4
from ultralytics import YOLO
from fastapi import BackgroundTasks

# Inherit and preserve your existing specialized mathematical domain services
from app.services.spatial_calibration_service import SpatialCalibrationService
from app.services.trajectory_math_service import TrajectoryMathService
from app.services.sector_aggregation_service import SectorAggregationService

class v2VideoTrackingService:
    # Maintain a single shared weights definition across our application
    _yolo_model = YOLO("yolo11n.pt")

    @classmethod
    def queue_video_analysis(
        cls, 
        background_tasks: BackgroundTasks, 
        shared_client: httpx.AsyncClient,
        court_id: str, 
        academy_id: str, 
        video_file_path: str,
        calibration_raw_package: Optional[dict] = None
    ) -> str:
        job_id = str(uuid4())
        
        # 🚀 REPLACED: Raw Thread allocations replaced with FastAPI's managed async loop task queue
        background_tasks.add_task(
            cls._execute_frame_tracking_pipeline,
            shared_client, court_id, academy_id, job_id, video_file_path, calibration_raw_package
        )
        return job_id

    @classmethod
    async def _execute_frame_tracking_pipeline(
        cls, 
        client: httpx.AsyncClient, # Injecting our centralized persistent connection pool
        court_id: str, 
        academy_id: str, 
        job_id: str, 
        video_path: str, 
        calibration_raw_package: Optional[dict] = None
    ):
        # ⏱️ 1. Start the High-Resolution Background Stopwatch
        job_start_time = time.perf_counter()

        print(f"\n📡 [v2 BACKGROUND WORKER START]: Executing Job {job_id} for Court {court_id}")
        
        # 🚀 DEFERRED Homing Calculation: Compute the perspective transformation matrix on the background task engine
        if calibration_raw_package is not None:
            try:
                clean_key = str(court_id).strip().replace('"', '').replace("'", "").lower()
                
                # Reconstruct source points from raw string numbers passed across the gateway
                src_points = np.array([
                    [float(p[0]), float(p[1])] for p in calibration_raw_package["points"]
                ], dtype=np.float32)
                
                # Standard tennis court coordinate transformation metrics mapped onto system grids
                dst_points = np.array([[5.0, 5.0], [95.0, 5.0], [5.0, 45.0], [95.0, 45.0]], dtype=np.float32)
                
                computed_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
                SpatialCalibrationService._matrix_cache[clean_key] = computed_matrix
                print(f"🧠 [v2 THREAD MEMORY SEEDED]: Computed and locked active matrix for key: {clean_key}")
            except Exception as cv_err:
                print(f"⚠️ [v2 CALIBRATION FAULT]: Error calculating matrix in background: {cv_err}")

        video_capture = cv2.VideoCapture(video_path)
        if not video_capture.isOpened():
            print(f"❌ [v2 IO ERROR] Failed to mount stream path: {video_path}")
            return

        frame_index = 0
        ball_trajectory_coordinates = []

        try:
            # 1. Run full frame iteration. YOLO operations operate inside non-blocking steps
            while video_capture.isOpened():
                success, frame_matrix = video_capture.read()
                if not success:
                    break
                frame_index += 1

                model_results_list = cls._yolo_model.predict(frame_matrix, classes=[29], verbose=False)

                if len(model_results_list) > 0:
                    frame_result = model_results_list[0]
                    if frame_result.boxes is not None and len(frame_result.boxes) > 0:
                        box = frame_result.boxes[0]
                        conf_tensor = box.conf.cpu().item() if hasattr(box.conf, "cpu") else float(box.conf)
                        
                        if conf_tensor > 0.20:
                            coords_list = box.xyxy.cpu().numpy()[0].tolist() if hasattr(box.xyxy, "cpu") else box.xyxy[0].tolist()
                            x1, y1, x2, y2 = coords_list[0], coords_list[1], coords_list[2], coords_list[3]
                            
                            pixel_x_center = (x1 + x2) / 2.0
                            pixel_y_center = (y1 + y2) / 2.0
                            ball_trajectory_coordinates.append((frame_index, pixel_x_center, pixel_y_center))

            video_capture.release()
            print(f"✅ [v2 YOLO COMPLETE]: Extracted {len(ball_trajectory_coordinates)} valid ball frames.")

            # Isolate bounce coordinates using your existing math infrastructure
            unwarped_bounce_coordinates = TrajectoryMathService.extract_court_bounce_events(
                court_id=court_id,
                raw_trajectory=ball_trajectory_coordinates
            )

            # Build final 12-sector matrix payload via your standard aggregate generator
            extracted_filename = os.path.basename(video_path)
            final_spatial_matrix_payload = SectorAggregationService.compile_spatial_summary(
                court_id=court_id,
                video_filename=extracted_filename,
                bounce_points=unwarped_bounce_coordinates
            )
            final_spatial_matrix_payload["academy_id"] = academy_id

            # ⏱️ 2. Stop the Stopwatch and Compute Elapsed Execution Time
            execution_seconds = time.perf_counter() - job_start_time
            execution_minutes = execution_seconds / 60.0
            
            # Injecting the calculation metrics directly into the network payload contract to inform .NET
            final_spatial_matrix_payload["pipeline_performance"] = {
                "elapsed_seconds": round(execution_seconds, 2),
                "elapsed_minutes": round(execution_minutes, 2)
            }
            
            print(f"⏱️ [v2 JOB METRICS]: Job {job_id} processing finalized in {execution_minutes:.2f} minutes ({execution_seconds:.2f} seconds).")

            # 2. Build our Async Connection Routing parameters
            base_gateway_url = os.getenv("DOTNET_GATEWAY_URL", "https://localhost:7290").strip("/")
            dotnet_callback_url = f"{base_gateway_url}/api/maintenance/court-spatial-heatmap/callback"
            
            try:
                # 🚀 REPLACED: Non-blocking async post method. 
                # This suspends this worker routine instantly, releasing execution back to FastAPI's event loop
                response = await client.post(dotnet_callback_url, json=final_spatial_matrix_payload)
                if response.status_code == 200:
                    print(f"🚀 [v2 NETWORK SYNC SUCCESS]: Live tracking coordinates safely delivered over async channels!")
                else:
                    print(f"❌ [v2 NETWORK SYNC FAULT]: .NET rejected callback payload. Status: {response.status_code}")
            except Exception as net_err:
                print(f"❌ [v2 NETWORK BRIDGE FAILURE]: Target gateway endpoint unreachable: {net_err}")

        except Exception as crash_error:
            print(f"❌ [v2 CRITICAL PIPELINE CRASH]: Vision loop engine failure: {crash_error}")
        finally:
            video_capture.release()
            if os.path.exists(video_path):
                try: os.remove(video_path)
                except OSError: pass
