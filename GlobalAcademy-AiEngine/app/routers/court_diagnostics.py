# app/routers/court_diagnostics.py
from fastapi import APIRouter, status
from app.schemas.court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
from app.services.court_diagnostics_agent import compute_court_structural_analytics
import uuid
import random
from datetime import datetime, timezone
from app.schemas.court_diagnostics import (
    CourtDiagnosticsPayloadSchema, 
    DiagnosticsMetricsSchema, 
    DiagnosticsAnomalySchema
)
from app.schemas.court_diagnostics import RawTelemetryInputSchema, CourtDiagnosticsPayloadSchema
from app.services.court_diagnostics_agent import CourtDiagnosticsService

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
async def analyze_court_telemetry(payload: RawTelemetryInputSchema):
    """
    Exposes the endpoint contract to incoming web requests, directing traffic
    straight through to the underlying decoupled analytical computation service.
    """
    return CourtDiagnosticsService.process_and_analyze_telemetry(payload)
