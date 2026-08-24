# app/services/court_diagnostics_agent.py
from app.schemas. court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse

def compute_court_structural_analytics(payload: CourtDiagnosticRequest) -> CourtDiagnosticResponse:
    """Evaluates multi-variable surface degradation logs to infer scheduling urgencies."""
    
    # Baseline wear speed coefficients per material matrix
    material_coefficients = {
        "Clay": {"base_wear": 1.25, "moisture_sensitivity": 1.50, "max_hours": 400.0},
        "Grass": {"base_wear": 1.60, "moisture_sensitivity": 1.95, "max_hours": 250.0},
        "Hard": {"base_wear": 1.00, "moisture_sensitivity": 1.10, "max_hours": 900.0}
    }
    
    config = material_coefficients[payload.surface_material]
    
    # 📐 Compute degradation curve equations
    usage_factor = (payload.cumulative_use_hours * config["base_wear"]) / config["max_hours"] * 100.0
    moisture_multiplier = 1.0 + ((payload.environmental_moisture_pct / 100.0) * config["moisture_sensitivity"])
    
    # Unified Fatigue Index capped safely at 100.0%
    fatigue_index = min(round(usage_factor * moisture_multiplier, 2), 100.0)
    
    # 🚨 Evaluate System Rules Criteria
    lockout = False
    urgency = "Routine"
    days_remaining = max(1, int((100.0 - fatigue_index) * 0.9))
    
    if fatigue_index >= 80.0:
        lockout = True
        urgency = "Emergency"
        days_remaining = 0
    elif fatigue_index >= 45.0:
        urgency = "Urgent"
        days_remaining = min(days_remaining, 14)
        
    return CourtDiagnosticResponse(
        is_processed_successfully=True,
        structural_fatigue_index=fatigue_index,
        safety_lockout_active=lockout,
        maintenance_urgency_tier=urgency,
        next_upkeep_window_days=days_remaining
    )
