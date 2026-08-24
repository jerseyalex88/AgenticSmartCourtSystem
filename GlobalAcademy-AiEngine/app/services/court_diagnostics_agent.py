# app/services/court_diagnostics_agent.py
from app.schemas. court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
import uuid
from datetime import datetime, timezone
from app.schemas.court_diagnostics import (
    RawTelemetryInputSchema,
    CourtDiagnosticsPayloadSchema,
    DiagnosticsMetricsSchema,
    DiagnosticsAnomalySchema
)

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

class CourtDiagnosticsService:
    @staticmethod
    def process_and_analyze_telemetry(raw_input: RawTelemetryInputSchema) -> CourtDiagnosticsPayloadSchema:
        """
        Executes structural baseline calculations, checks threshold business rules,
        and aggregates the analytics into a validated mirror DTO model.
        """
        # 1. Deterministic environmental baseline degradation math
        humidity_penalty = (raw_input.humidity_percentage - 50.0) * 0.1 if raw_input.humidity_percentage > 50.0 else 0.0
        calculated_bounce = max(80.0, min(100.0, 98.0 - humidity_penalty))

        detected_anomalies = []

        # 2. Rule Evaluation Alpha: Tensile Net Force Ceilings
        if raw_input.net_tension_newtons < 400.0:
            detected_anomalies.append(
                DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="High" if raw_input.net_tension_newtons < 380.0 else "Medium",
                    category="Structural Hardware",
                    description=f"Net structural tension dropped to {raw_input.net_tension_newtons:.1f}N.",
                    confidence_score=0.96,
                    recommended_action="Deploy groundskeeper to re-tension net ratchets."
                )
            )

        # 3. Rule Evaluation Beta: Surface Friction Safeguards
        if raw_input.surface_friction_index < 0.75:
            detected_anomalies.append(
                DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="Critical",
                    category="Surface Degradation",
                    description=f"Surface friction index at {raw_input.surface_friction_index:.2f} breaches safety limits.",
                    confidence_score=0.91,
                    recommended_action="Lock court and schedule pressure wash sweep."
                )
            )

        # 4. Return complete, validated downstream layout contract
        return CourtDiagnosticsPayloadSchema(
            session_id=str(uuid.uuid4()),
            court_id=raw_input.court_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            metrics=DiagnosticsMetricsSchema(
                surface_friction_index=round(raw_input.surface_friction_index, 2),
                bounce_uniformity_percentage=round(calculated_bounce, 1),
                net_tension_newtons=round(raw_input.net_tension_newtons, 1),
                ambient_temperature_celsius=round(raw_input.ambient_temperature_celsius, 1),
                humidity_percentage=round(raw_input.humidity_percentage, 1)
            ),
            anomalies=detected_anomalies,
            agent_version="v1.6.5-service-layer"
        )
