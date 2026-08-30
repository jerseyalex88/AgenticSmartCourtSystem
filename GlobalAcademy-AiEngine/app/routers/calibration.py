# File: GlobalAcademy-AiEngine/app/routers/calibration.py
from fastapi import APIRouter, HTTPException, status
from app.schemas.court_diagnostics import CourtCalibrationInputSchema, CalibrationResponseSchema
from app.services.spatial_calibration_service import SpatialCalibrationService

router = APIRouter(prefix="/api/ai/calibration", tags=["Facility Automation Agents"])

@router.post("/register-court-geometry", response_model=CalibrationResponseSchema)
async def register_court_geometry(payload: CourtCalibrationInputSchema):
    """
    Receives 4 raw camera feed coordinate configurations from the interface canvas view deck
    to establish the spatial un-warping homography boundaries inside OpenCV workspace memory.
    """
    if len(payload.corners) != 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perspective calibration pipeline requires exactly 4 corner coordinates mapping baseline nodes."
        )

    success = SpatialCalibrationService.compute_homography_matrix(payload)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenCV geometry translation failed. Check input corner data format specs."
        )

    return CalibrationResponseSchema(
        court_id=payload.court_id,
        status="SUCCESS",
        message="Perspective transformation homography matrix successfully built and locked into memory caching rows."
    )
