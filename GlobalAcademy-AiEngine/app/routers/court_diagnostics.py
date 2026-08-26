# app/routers/court_diagnostics.py
from fastapi import APIRouter, status
from app.schemas.court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
from app.services.court_diagnostics_agent import compute_court_structural_analytics
import uuid
import random
from datetime import datetime, timezone
from app.services.court_diagnostics_agent import CourtDiagnosticsService
from app.schemas.court_diagnostics import MasterOrchestrationInputSchema, CourtDiagnosticsPayloadSchema

router = APIRouter(prefix="/api/ai/diagnostics", tags=["Facility Automation Agents"])

@router.post("/evaluate-court-surface", response_model=CourtDiagnosticResponse)
def evaluate_court_surface_endpoint(payload: CourtDiagnosticRequest):
    """Exposes telemetry processing pathways to the external .NET microservice ecosystem."""
    return compute_court_structural_analytics(payload)

@router.post(
    "/analyze-court-telemetry", 
    response_model=CourtDiagnosticsPayloadSchema,
    status_code=status.HTTP_200_OK
)
async def analyze_court_telemetry(payload: MasterOrchestrationInputSchema):
    """
    Receives the nested master object wrapper and routes the sub-properties
    straight into the analytic business service rule engine.
    """
    # Unpack properties dynamically to pass to our service processor layer
    return CourtDiagnosticsService.process_and_analyze_telemetry(
        payload.telemetry_signals, 
        payload.court_metadata
    )

@router.post("/seed-court-history")
async def seed_court_history(request_payload: dict):
    """
    Generates a dense historical dataset wrapper array for a targeted court asset 
    to populate downstream multi-tenant PostgreSQL tables.
    """
    court_id = request_payload.get("court_id")
    surface_type = request_payload.get("surface_type", "Hard")
    is_indoor = request_payload.get("is_indoor", False)
    
    # Generate the backdated dataset matrix array
    history_records = CourtDiagnosticsService.generate_synthetic_history(
        court_id=court_id,
        surface_type=surface_type,
        is_indoor=is_indoor,
        days_back=180
    )
    
    return {"court_id": court_id, "total_records_generated": len(history_records), "records": history_records}
