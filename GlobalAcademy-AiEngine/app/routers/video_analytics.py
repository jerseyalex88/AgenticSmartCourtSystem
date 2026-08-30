# File: GlobalAcademy-AiEngine/app/routers/video_analytics.py
import os
import shutil
import numpy as np
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.schemas.court_diagnostics import VideoAnalysisStartResponseSchema
from app.services.video_tracking_service import VideoTrackingService
from app.schemas.court_diagnostics import CourtCalibrationInputSchema, CoordinatePoint
from app.services.spatial_calibration_service import SpatialCalibrationService

router = APIRouter(prefix="/api/ai/video", tags=["Computer Vision Analytics Engines"])

@router.post("/upload-match-clip", response_model=VideoAnalysisStartResponseSchema, status_code=status.HTTP_202_ACCEPTED)
async def upload_match_clip(
    court_id: str = Form(...),
    academy_id: str = Form(...),
    video_file: UploadFile = File(...),
    # 🎯 FIX: Explicitly accept all 4 persistent corners passed over from .NET Core
    calib_width: Optional[str] = Form(None),
    calib_height: Optional[str] = Form(None),
    tl_x: Optional[str] = Form(None),
    tl_y: Optional[str] = Form(None),
    tr_x: Optional[str] = Form(None),
    tr_y: Optional[str] = Form(None),
    bl_x: Optional[str] = Form(None),
    bl_y: Optional[str] = Form(None),
    br_x: Optional[str] = Form(None),
    br_y: Optional[str] = Form(None)
):
    print("\n" + "="*80)
    print("📡 [PYTHON INGESTION SECURE DEEP FORMDATA HANDSHAKE]")
    print("="*80)
    print(f"   👉 Inbound Court GUID : {court_id}")
    print(f"   👉 Passed Width x H   : {calib_width}x{calib_height}")
    print(f"   👉 Top-Left Corner    : X:{tl_x} Y:{tl_y}")
    
    active_homography_matrix = None

    # Verify if all 4 corners exist in the payload
    if calib_width and tl_x and tl_y and tr_x and tr_y and bl_x and bl_y and br_x and br_y:
        try:
            # Construct a clean, sanitized validation schema contract matching Step 1
            hydration_payload = CourtCalibrationInputSchema(
                court_id=str(court_id).strip().replace('"', '').replace("'", "").lower(),
                video_width=int(float(calib_width)),
                video_height=int(float(calib_height)),
                corners=[
                    CoordinatePoint(x=float(tl_x), y=float(tl_y)),  # 1. Top-Left
                    CoordinatePoint(x=float(tr_x), y=float(tr_y)),  # 2. Top-Right
                    CoordinatePoint(x=float(bl_x), y=float(bl_y)),  # 3. Bottom-Left
                    CoordinatePoint(x=float(br_x), y=float(br_y))   # 4. Bottom-Right
                ]
            )
            
            # Compute the perspective homography transformation matrix
            src_points = np.array([[p.x, p.y] for p in hydration_payload.corners], dtype=np.float32)
            dst_points = np.array([[5.0, 5.0], [95.0, 5.0], [5.0, 45.0], [95.0, 45.0]], dtype=np.float32)
            
            # Extract and capture the raw active matrix object array on the main thread
            import cv2
            active_homography_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            print("   ✅ [HYDRATION SUCCESS]: Successfully compiled raw matrix parameters on main thread!")
            
        except Exception as ex:
            print(f"   ⚠️ [HYDRATION FAULT]: Failed to build calibration matrix: {ex}")
            active_homography_matrix = None
    else:
        print("   ⚠️ [HYDRATION SKIPPED]: Missing calibration form parameters fields.")
    
    print("="*80 + "\n")

    # Ingest the clip format extensions
    allowed_extensions = [".mp4", ".mov", ".avi", ".mkv"]
    file_extension = "".join(video_file.filename.split(".")[-1:]).lower()
    if not any(ext in f".{file_extension}" for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Unsupported video format.")

    scratch_workspace_dir = "/tmp/globalacademy_scratch"
    os.makedirs(scratch_workspace_dir, exist_ok=True)
    temporary_target_path = os.path.join(scratch_workspace_dir, f"{video_file.filename}")

    try:
        with open(temporary_target_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
    except Exception as io_err:
        raise HTTPException(status_code=500, detail=f"Disk write failure: {io_err}")

    # 🚀 SECURE DISPATCH: Pass the active matrix array straight down into the background tracking queue worker!
    background_job_id = VideoTrackingService.queue_video_analysis(
        court_id=court_id, 
        academy_id=academy_id, 
        video_file_path=temporary_target_path,
        homography_matrix=active_homography_matrix
    )

    return VideoAnalysisStartResponseSchema(
        court_id=court_id,
        job_id=background_job_id,
        academy_id=academy_id,
        status="ACCEPTED",
        message="Video analysis tracking request successfully queued. Memory matrices locked into thread scope."
    )
