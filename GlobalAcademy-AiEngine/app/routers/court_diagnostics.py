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