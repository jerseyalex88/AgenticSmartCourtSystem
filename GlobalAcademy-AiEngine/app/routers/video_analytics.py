# File: GlobalAcademy-AiEngine/app/routers/video_analytics.py
import os
import shutil
from pydantic import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.schemas.court_diagnostics import VideoAnalysisStartResponseSchema
from app.services.video_tracking_service import VideoTrackingService

router = APIRouter(prefix="/api/ai/video", tags=["Computer Vision Analytics Engines"])

@router.post("/upload-match-clip", response_model=VideoAnalysisStartResponseSchema, status_code=status.HTTP_202_ACCEPTED)
async def upload_match_clip(
    court_id: str = Form(...),
    video_file: UploadFile = File(...)
):
    """
    Receives an incoming CCTV match clip file chunk upload stream from .NET Core, saves it into
    a temporary scratch space workspace folder, and registers it to the async background tracking pipeline threads.
    """
    # Safety verification check: validate file extensions
    allowed_extensions = [".mp4", ".mov", ".avi", ".mkv"]
    file_extension = "".join(video_file.filename.split(".")[-1:]).lower()
    if not any(ext in f".{file_extension}" for ext in allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported video file extension format tracking parameters."
        )

    # 1. Establish temporary local file scratch workspace folder directories
    scratch_workspace_dir = "/tmp/globalacademy_scratch"
    os.makedirs(scratch_workspace_dir, exist_ok=True)
    temporary_target_path = os.path.join(scratch_workspace_dir, f"{video_file.filename}")

    try:
        # 2. Pipe incoming multipart binary chunk streams straight onto local scratch workspace disk
        with open(temporary_target_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
    except Exception as io_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multipart streaming buffer allocation disk write failure: {io_err}"
        )

    # 3. Schedule execution asynchronously right onto background worker service threads rows
    background_job_id = VideoTrackingService.queue_video_analysis(court_id, temporary_target_path)

    return VideoAnalysisStartResponseSchema(
        court_id=court_id,
        job_id=background_job_id,
        status="ACCEPTED",
        message="Video analysis tracking request successfully queued. Processing running asynchronously on background worker threads."
    )
