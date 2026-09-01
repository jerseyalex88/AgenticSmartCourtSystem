# File: GlobalAcademy-AiEngine/app/routers/predictive_video_analytics.py
import os
import shutil
import cv2
import numpy as np
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.schemas.court_diagnostics import VideoAnalysisStartResponseSchema
from app.services.predictive_tracking_service import PredictiveTrackingService
from app.schemas.court_diagnostics import CourtCalibrationInputSchema, CoordinatePoint

router = APIRouter(prefix="/api/ai/predictive-video", tags=["Predictive Computer Vision Engines"])

@router.post("/upload-match-clip", response_model=VideoAnalysisStartResponseSchema, status_code=status.HTTP_202_ACCEPTED)
async def upload_predictive_match_clip(
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
    print("\n" + "="*80)
    print("📡 [PYTHON INGESTION SECURE PREDICTIVE HANDSHAKE]")
    print("="*80)
    
    active_homography_matrix = None

    if calib_width and tl_x and tl_y and tr_x and tr_y and bl_x and bl_y and br_x and br_y:
        try:
            hydration_payload = CourtCalibrationInputSchema(
                court_id=str(court_id).strip().replace('"', '').replace("'", "").lower(),
                video_width=int(float(calib_width)),
                video_height=int(float(calib_height)),
                corners=[
                    CoordinatePoint(x=float(tl_x), y=float(tl_y)),
                    CoordinatePoint(x=float(tr_x), y=float(tr_y)),
                    CoordinatePoint(x=float(bl_x), y=float(bl_y)),
                    CoordinatePoint(x=float(br_x), y=float(br_y))
                ]
            )
            src_points = np.array([[p.x, p.y] for p in hydration_payload.corners], dtype=np.float32)
            dst_points = np.array([[5.0, 5.0], [95.0, 5.0], [5.0, 45.0], [95.0, 45.0]], dtype=np.float32)
            active_homography_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            print("   ✅ [PREDICTIVE ONSITE HYDRATION SUCCESS]: Matrix compiled on main thread.")
        except Exception as ex:
            print(f"   ⚠️ [PREDICTIVE HYDRATION FAULT]: {ex}")

    print("="*80 + "\n")

    scratch_workspace_dir = "/tmp/globalacademy_scratch"
    os.makedirs(scratch_workspace_dir, exist_ok=True)
    temporary_target_path = os.path.join(scratch_workspace_dir, f"predictive_{video_file.filename}")

    try:
        with open(temporary_target_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
    except Exception as io_err:
        raise HTTPException(status_code=500, detail=f"Disk buffering write failure: {io_err}")

    # Launch your separate Predictive background pipeline thread
    background_job_id = PredictiveTrackingService.queue_predictive_analysis(
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
        message="Advanced predictive analysis request successfully queued."
    )
