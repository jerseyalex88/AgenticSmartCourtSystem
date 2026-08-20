# app/services/maintenance_agent.py
from fastapi import HTTPException
from app.schemas.maintenance import CourtWearRequest

def process_court_fatigue_telemetry(payload: CourtWearRequest) -> dict:
    """Evaluates telemetry data vectors to calculate structural wear and auto-schedule upkeep."""
    
    # 🛡️ DEFENSIVE SANITIZATION: Clean up string whitespaces and convert to lowercase
    surface = str(payload.surface_type).strip().lower()
    
    # Define exact baseline boundaries per surface configuration profile
    if surface == "clay":
        max_minutes_lifespan = 40000
        wear_multiplier = 1.4
    elif surface == "grass":
        max_minutes_lifespan = 25000
        wear_multiplier = 1.8
    elif surface == "hard":
        max_minutes_lifespan = 80000
        wear_multiplier = 1.0
    else:
        # Catch unexpected string text shapes cleanly before math operations begin
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported surface configuration material: '{payload.surface_type}'"
        )

    # 🌧️ ENVIRONMENTAL CALCULATIONS
    # Coerce to float to guarantee absolute numeric consistency during division
    environmental_days_factor = float(payload.days_since_last_resurface)
    if not payload.is_indoor:
        environmental_days_factor *= 1.35

    # 📐 COMPUTE COMBINED SURFACE FATIGUE METRICS
    usage_wear_pct = (float(payload.aggregate_minutes_played) * wear_multiplier) / max_minutes_lifespan * 100.0
    time_wear_pct = (environmental_days_factor / 1095.0) * 100.0
    
    # Calculate unified fatigue parameter capped cleanly at 100.0% maximum threshold
    structural_degradation_pct = min(round(usage_wear_pct + time_wear_pct, 2), 100.0)

    # 🚨 AGENTIC DECISION MATRIX RULES
    maintenance_action = "Optimal"
    severity = "Low"
    lock_court = False
    action_memo = "Court structural integrity is stable. Proceed with standard daily brushing protocols."

    if structural_degradation_pct >= 85.0:
        maintenance_action = "Full Resurfacing Required"
        severity = "Critical"
        lock_court = True
        action_memo = "CRITICAL RUPTURE WARNING: Severe structural friction threshold reached. Schedule emergency closure."
    elif structural_degradation_pct >= 60.0:
        maintenance_action = "Preventative Line Repainting & Pressure Wash"
        severity = "Medium"
        action_memo = "MODERATE WEAR: Visible fade tracking observed on playing baselines. Schedule maintenance window within 14 days."
    elif structural_degradation_pct >= 35.0:
        maintenance_action = "Routine Asset Safety Inspection"
        severity = "Low"
        action_memo = "MINOR WEAR: Core indicators are within safe thresholds. Schedule localized staff inspection pass."

    # Return structured dictionary mapping metrics back to caller route
    return {
        "court_id": str(payload.court_id),
        "surface_type": payload.surface_type,
        "calculated_surface_fatigue_pct": structural_degradation_pct,
        "maintenance_severity": severity,
        "recommended_action": maintenance_action,
        "system_lockout_triggered": lock_court,
        "operational_coaching_memo": action_memo
    }
