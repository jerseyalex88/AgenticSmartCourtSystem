# File: GlobalAcademy-AiEngine/app/services/video_tracking_service.py
import os
import cv2
import httpx
import threading
from typing import List, Tuple
from uuid import uuid4
from ultralytics import YOLO
from app.services.spatial_calibration_service import SpatialCalibrationService
from app.services.sector_aggregation_service import SectorAggregationService
from app.services.trajectory_math_service import TrajectoryMathService
from app.services.sector_aggregation_service import SectorAggregationService

class VideoTrackingService:
    # Initialize the high-performance YOLOv11 nano model weights layer in headless memory
    # The 'n' (nano) model variant is ultra-fast, optimized for high-speed frame processing
    _yolo_model = YOLO("yolo11n.pt")

    @classmethod
    def queue_video_analysis(cls, court_id: str, video_file_path: str) -> str:
        """
        Registers an inbound video clip, generates a unique background job tracking ID,
        and fires off the heavy YOLOv11 frame-by-frame matrix calculations on a background thread.
        """
        job_id = str(uuid4())
        
        # Spin up an isolated background thread worker so the main API gateway loop never chokes or freezes
        worker_thread = threading.Thread(
            target=cls._execute_frame_tracking_pipeline,
            args=(court_id, job_id, video_file_path)
        )
        worker_thread.daemon = True # Allows the OS shell thread to clean up cleanly on system reboots
        worker_thread.start()

        return job_id

    @classmethod
    def _execute_frame_tracking_pipeline(cls, court_id: str, job_id: str, video_path: str):
        """
        Background Worker Loop: Spans across video frames, extracts moving target 
        coordinates via YOLOv11, and tracks the trajectory index map array.
        """
        print(f"📡 [BACKGROUND JOB STARTED]: Processing Vision Job {job_id} for Court {court_id}...")
        
        # 1. Mount the local video clip handle into OpenCV file stream buffers
        video_capture = cv2.VideoCapture(video_path)
        if not video_capture.isOpened():
            print(f"❌ [IO ERROR] Failed to mount file stream target path: {video_path}")
            return

        frame_index = 0
        ball_trajectory_coordinates: List[Tuple[int, float, float]] = [] # Tracking: (FrameNum, RawPixelX, RawPixelY)

        try:
            # 2. Sequential frame-by-frame image matrix extraction loop
            while video_capture.isOpened():
                success, frame_matrix = video_capture.read()
                if not success:
                    break # Breaks gracefully when reaching the exact end boundary of the video clip

                frame_index += 1

                # To maintain high server processing performance, analyze every single frame sequentially,
                # but target class index 32 ('sports ball') specifically within YOLO's internal object tracking dictionary.
                # verbose=False suppresses unneeded text outputs to optimize thread memory execution loops
                model_results = cls._yolo_model.predict(frame_matrix, classes=[32], verbose=False)

                if len(model_results) > 0:
                    bounding_boxes = model_results[0].boxes
                    
                    for box in bounding_boxes:
                        # Extract 2D boundary pixel center points out of the tensor array data matrix
                        xyxy_coordinates = box.xyxy[0].tolist()
                        confidence_score = float(box.conf[0])

                        if confidence_score > 0.35: # Only record items matching solid confidence limits
                            pixel_x_center = (xyxy_coordinates[0] + xyxy_coordinates[2]) / 2.0
                            pixel_y_center = (xyxy_coordinates[1] + xyxy_coordinates[3]) / 2.0
                            
                            # Append the coordinates into our continuous trajectory index trail tracking list
                            ball_trajectory_coordinates.append((frame_index, pixel_x_center, pixel_y_center))
                            break # Track the highest-confidence ball candidate point inside this frame slice

            print(f"✅ [YOLO TRACKING COMPLETE]: Processed {frame_index} total frames for Job {job_id}.")
            print(f"📈 Total Ball Vectors Tracked: {len(ball_trajectory_coordinates)} point coordinates found.")

            # --- 🛠️ STEP 3 & 4 INTERCEPT HANDSHAKES ACTIVATED ---
            # Pass your raw neural network pixel coordinates array directly into the physics engine
            unwarped_bounce_coordinates = TrajectoryMathService.extract_court_bounce_events(
                court_id=court_id,
                raw_trajectory=ball_trajectory_coordinates
            )
            
            print(f"🔮 [PHYSICS PIPELINE SUCCESS]: Isolated {len(unwarped_bounce_coordinates)} true ground strike impact events.")
            
            # for index, pt in enumerate(unwarped_bounce_coordinates[:5]):
            #     print(f"   💥 Impact Event Point {index+1} -> Canvas coordinates X: {pt}, Y: {pt} [{pt}]")

            # --- 🛠️ STEP 5 CORES ACTIVATED ---
            # Compile the flat points list into your final structured 12-sector matrix payload data contracts
            final_spatial_matrix_payload = SectorAggregationService.compile_spatial_summary(
                court_id=court_id,
                bounce_points=unwarped_bounce_coordinates
            )

            print(f"📦 [SPATIAL AGGREGATION DISPATCH]: Data package successfully compiled for Job {job_id}.")
            print(f"   📊 Total Matrix Points Registered: {final_spatial_matrix_payload['total_processed_bounces']} Units.")

            print(f"📦 [SPATIAL AGGREGATION DISPATCH]: Data package successfully compiled for Job {job_id}.")
            print(f"   📊 Total Matrix Points Registered: {final_spatial_matrix_payload['total_processed_bounces']} Units.")

            # =========================================================================
            # 📡 🛠️ ENVIRONMENT-AWARE CONFIGURATION BRIDGE HANDSHAKE
            # =========================================================================
            # Dynamically pull down the base routing gateway URL from operating system environment memory,
            # applying an explicit local fallback to prevent connection drops if the variable isn't declared.
            base_gateway_url = os.getenv("DOTNET_GATEWAY_URL", "https://localhost:7290").strip("/")
            
            # Combine the base URL with your static internal endpoint callback controller token
            dotnet_callback_url = f"{base_gateway_url}/api/maintenance/court-spatial-heatmap/callback"
            
            print(f"📡 [NETWORK ROUTING ENGINE]: Directing telemetry package over stream interface to: {dotnet_callback_url}")

            try:
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(dotnet_callback_url, json=final_spatial_matrix_payload)
                    if response.status_code == 200:
                        print(f"🚀 [NETWORK SYNC SUCCESS]: Spatial heatmap telemetry successfully pushed to .NET gateway for court {court_id}!")
                    else:
                        print(f"❌ [NETWORK SYNC FAULT]: .NET gateway rejected callback stream. Status: {response.status_code} - Reason: {response.text}")
            except Exception as net_err:
                print(f"❌ [NETWORK BRIDGE FAILURE]: Failed to reach .NET Core gateway over internal container interfaces: {net_err}")
            # =========================================================================

        except Exception as crash_error:
            print(f"❌ [CRITICAL JOB RECONCILIATION FAULT] Vision Thread crashed: {crash_error}")
        finally:
            # 3. Flush the file buffers and release video locks to prevent operating system memory leaks
            video_capture.release()
            if os.path.exists(video_path):
                try:
                    os.remove(video_path) # Clean up temporary disk file workspace
                except OSError:
                    pass
