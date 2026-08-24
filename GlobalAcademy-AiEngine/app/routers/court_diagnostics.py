# app/routers/court_diagnostics.py
from fastapi import APIRouter
from app.schemas.court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
from app.services.court_diagnostics_agent import compute_court_structural_analytics

router = APIRouter(prefix="/api/ai/diagnostics", tags=["Facility Automation Agents"])

@router.post("/evaluate-court-surface", response_model=CourtDiagnosticResponse)
def evaluate_court_surface_endpoint(payload: CourtDiagnosticRequest):
    """Exposes telemetry processing pathways to the external .NET microservice ecosystem."""
    return compute_court_structural_analytics(payload)
