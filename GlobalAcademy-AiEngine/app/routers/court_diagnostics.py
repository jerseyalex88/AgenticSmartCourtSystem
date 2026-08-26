# app/routers/court_diagnostics.py
from fastapi import APIRouter, status
from app.schemas.court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
from app.services.court_diagnostics_agent import compute_court_structural_analytics
from datetime import datetime, timezone
from app.services.court_diagnostics_agent import CourtDiagnosticsService
from app.schemas.court_diagnostics import MasterOrchestrationInputSchema, CourtDiagnosticsPayloadSchema, PredictiveAnalysisOutputSchema
from typing import List

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

@router.post(
    "/forecast-surface-decay", 
    response_model=PredictiveAnalysisOutputSchema
)
async def forecast_surface_decay(historical_snapshots: List[dict]):
    """
    Takes a list of raw historical snapshots directly from the database, extracts the first court ID,
    and runs our time-series OLS linear regression to forecast future surface wear.
    """
    if not historical_snapshots:
        return PredictiveAnalysisOutputSchema(
            court_id="unknown", velocity_friction_loss_per_day=0.0,
            estimated_days_until_breach=999, is_resurface_recommended=False, confidence_score=0.0
        )
        
    # Extract court identifier parameter from the initial item in the array list
    first_snapshot = historical_snapshots[0]
    court_id = first_snapshot.get("courtId") or first_snapshot.get("court_id") or "unknown"
    
    return CourtDiagnosticsService.forecast_court_surface_decay(
        court_id=str(court_id), 
        historical_snapshots=historical_snapshots
    )