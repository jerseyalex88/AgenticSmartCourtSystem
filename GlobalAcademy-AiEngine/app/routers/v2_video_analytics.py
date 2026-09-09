# File: GlobalAcademy-AiEngine/app/routers/v2_video_analytics.py
import os
import shutil
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Request, BackgroundTasks
import numpy as np
import cv2

# Keep utilizing your existing schemas to preserve contract compatibility with your React/.NET frontends
from app.schemas.court_diagnostics import VideoAnalysisStartResponseSchema
from app.schemas.court_diagnostics import CourtCalibrationInputSchema, CoordinatePoint

# Import our new v2 tracking service handler
from app.services.v2_video_tracking_service import v2VideoTrackingService

router = APIRouter(prefix="/api/ai/video", tags=["v2 Asynchronous Computer Vision Analytics Engines"])

@router.post("/upload-match-clip", response_model=VideoAnalysisStartResponseSchema, status_code=status.HTTP_202_ACCEPTED)
async def upload_match_clip(
    request: Request,
    background_tasks: BackgroundTasks, # 🚀 Injecting FastAPI's optimized async task manager
    court_id: str = Form(...),
    academy_id: str = Form(...),
    video_file: UploadFile = File(...),
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
    # 1. Format and extension validation (Non-blocking check)
    allowed_extensions = [".mp4", ".mov", ".avi", ".mkv"]
    file_extension = os.path.splitext(video_file.filename)[1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported video format.")

    # 2. Disk writing operations using standard files inside isolated workspaces
    scratch_workspace_dir = "/tmp/globalacademy_scratch"
    os.makedirs(scratch_workspace_dir, exist_ok=True)
    temporary_target_path = os.path.join(scratch_workspace_dir, f"{video_file.filename}")

    try:
        # FastAPI's UploadFile reads asynchronously under the hood, preserving execution rails
        with open(temporary_target_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
    except Exception as io_err:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Disk write failure: {io_err}")

    # 3. Package calibration parameters into a clean primitive tuple payload block
    # Instead of running cv2 math on the router main thread, we defer execution to background loops
    calibration_raw_package = None
    if calib_width and tl_x and tl_y and tr_x and tr_y and bl_x and bl_y and br_x and br_y:
        calibration_raw_package = {
            "court_id": court_id,
            "width": calib_width,
            "height": calib_height,
            "points": [(tl_x, tl_y), (tr_x, tr_y), (bl_x, bl_y), (br_x, br_y)]
        }

    # 4. Pull our warm, secure client context state pool constructed in v2main.py
    shared_client = request.app.state.async_http_client

    # 5. Dispatch task execution directly down into the async worker matrix queue
    background_job_id = v2VideoTrackingService.queue_video_analysis(
        background_tasks=background_tasks,
        shared_client=shared_client,
        court_id=court_id,
        academy_id=academy_id,
        video_file_path=temporary_target_path,
        calibration_raw_package=calibration_raw_package
    )

    return VideoAnalysisStartResponseSchema(
        court_id=court_id,
        job_id=background_job_id,
        academy_id=academy_id,
        status="ACCEPTED",
        message="V2 Async Video tracking successfully queued. Telemetry pipelines isolated from core router threads."
    )
