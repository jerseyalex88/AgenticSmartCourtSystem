# app/routers/maintenance.py
from fastapi import APIRouter
from app.schemas.maintenance import CourtWearRequest
from app.services.maintenance_agent import process_court_fatigue_telemetry

router = APIRouter(prefix="/api/ai", tags=["Facility Upkeep AI Agents"])

@router.post("/predict-court-maintenance")
def predict_court_maintenance_endpoint(payload: CourtWearRequest):
    """Processes surface telemetry profiles to output upkeep schedules and automatic lockouts."""
    return process_court_fatigue_telemetry(payload)
