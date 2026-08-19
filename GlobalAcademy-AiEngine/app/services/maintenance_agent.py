# app/services/maintenance_agent.py
from fastapi import HTTPException
from app.schemas.maintenance import CourtWearRequest

def predict_court_maintenance_endpoint(payload: CourtWearRequest):
    """
    POST Request Endpoint exposed securely across internal network interfaces.
    Analyzes physical usage telemetry to calculate court surface degradation metrics
    and schedules proactive preventative maintenance alerts.
    """
    # 1. Enforce strict parameter validation rules
    if payload.aggregate_minutes_played < 0:
        raise HTTPException(status_code=400, detail="Telemetry Error: Aggregate minutes played cannot be negative.")
    if payload.days_since_last_resurface < 0:
        raise HTTPException(status_code=400, detail="Telemetry Error: Structural timeline metrics cannot be negative.")
    
    # 2. DEFINE SURFACE INTEGRITY THRESHOLDS (The Life-Cycle Boundaries)
    # Different surfaces erode at completely distinct speeds under player friction.
    surface = payload.surface_type.strip().lower()
    if surface == "clay":
        max_minutes_lifespan = 40000    # Clay needs heavy maintenance sweeping / loose topping top-offs fast
        wear_multiplier = 1.4           # Accelerated mechanical friction wear coefficient
    elif surface == "grass":
        max_minutes_lifespan = 25000    # Grass courts degrade rapidly and require tight baseline resting cycles
        wear_multiplier = 1.8           # Highest structural erosion score
    elif surface == "hard":
        max_minutes_lifespan = 80000    # Acrylic hard courts are highly durable but fade under friction over years
        wear_multiplier = 1.0           # Baseline standard wear metric
    else:
        # Safe boundary gate for input validation anomalies
        raise HTTPException(status_code=400, detail=f"Unsupported surface configuration designation: '{payload.surface_type}'")

    # 3. COMPUTE WEATHER AND ENVIRONMENTAL AGING FRICTION
    # Outdoor courts take heavy beatings from UV rays and rain, speed up the tracking clock.
    environmental_days_factor = payload.days_since_last_resurface
    if not payload.is_indoor:
        environmental_days_factor *= 1.35  # Outdoor exposure accelerates baseline material decay by 35%

    # 4. EXECUTE CALCULATIONS FOR SURFACE DEGRADATION PERCENTAGE
    # Combine player friction impact minutes with baseline environmental age factors
    usage_wear_pct = (payload.aggregate_minutes_played * wear_multiplier) / max_minutes_lifespan * 100.0
    time_wear_pct = (environmental_days_factor / 1095.0) * 100.0 # Normalized against a standard 3-year (1095 days) cycle major wear fence
    
    # Calculate combined structural degradation matrix value capped cleanly at 100% maximum fatigue
    structural_degradation_pct = min(round(usage_wear_pct + time_wear_pct, 2), 100.0)

    # 5. AGENTIC DECISION MATRIX MATRIX
    # Based on compiled surface fatigue numbers, determine operational upkeep categories
    # and issue automated warnings to the facility directory plane.
    maintenance_action = "Optimal"
    severity = "Low"
    lock_court_immediately = False
    action_memo = "Court structural integrity is stable. Proceed with standard daily brushing protocols."

    if structural_degradation_pct >= 85.0:
        maintenance_action = "Full Resurfacing Required"
        severity = "Critical"
        lock_court_immediately = True
        action_memo = "CRITICAL RUPTURE WARNING: Severe structural friction threshold reached. Surface friction index compromised. Schedule emergency closure."
    elif structural_degradation_pct >= 60.0:
        maintenance_action = "Preventative Line Repainting & Pressure Wash"
        severity = "Medium"
        action_memo = "MODERATE WEAR: Visible fade tracking observed on playing baselines. Schedule maintenance window during low-demand hours within 14 days."
    elif structural_degradation_pct >= 35.0:
        maintenance_action = "Routine Asset Safety Inspection"
        severity = "Low"
        action_memo = "MINOR WEAR: Core indicators are within safe thresholds. Schedule localized staff inspection pass during the next open shift sweep."

    # 6. RETURN STRUCTURAL PREDICTIVE INSIGHTS PACKETS
    return {
        "court_id": payload.court_id,
        "surface_type": payload.surface_type,
        "calculated_surface_fatigue_pct": structural_degradation_pct,
        "maintenance_severity": severity,
        "recommended_action": maintenance_action,
        "system_lockout_triggered": lock_court_immediately,
        "operational_coaching_memo": action_memo
    }
