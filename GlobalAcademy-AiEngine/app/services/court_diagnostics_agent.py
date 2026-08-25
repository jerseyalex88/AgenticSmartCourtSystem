# app/services/court_diagnostics_agent.py
from app.schemas. court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
import uuid
from datetime import datetime, timezone
from app.schemas.court_diagnostics import (
    TelemetrySignalsInputSchema,
    CourtMetadataInputSchema,
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
    def process_and_analyze_telemetry(
        signals: TelemetrySignalsInputSchema, 
        meta: CourtMetadataInputSchema
    ) -> CourtDiagnosticsPayloadSchema:
        """
        Runs analytical threshold calculations based on real database parameters
        and environmental real-time hardware signals.
        """
        # Read parameters safely from type-safe Pydantic contracts
        surface_type = meta.surface_type
        is_indoor = meta.is_indoor
        minutes_played = meta.aggregate_minutes_played
        maintenance_threshold = meta.maintenance_threshold_minutes
        court_status = meta.status

        # Environmental Degradation Penalty Calculus
        humidity_penalty = 0.0
        if not is_indoor and signals.humidity_percentage > 50.0:
            humidity_penalty = (signals.humidity_percentage - 50.0) * 0.12

        surface_wear_multiplier = 1.25 if surface_type == "Grass" else 0.85 if surface_type == "Clay" else  1.0
        calculated_bounce = max(75.0, min(100.0, 99.0 - humidity_penalty - (minutes_played * 0.0001 * surface_wear_multiplier)))

        detected_anomalies = []

        # Rule 1: Maintenance Ceiling Overruns
        if minutes_played >= maintenance_threshold:
            detected_anomalies.append(
                DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="Critical" if minutes_played > (maintenance_threshold * 1.2) else "High",
                    category="Maintenance Threshold Breach",
                    description=f"Court has exceeded safe played limits ({minutes_played}/{maintenance_threshold} mins).",
                    confidence_score=0.99,
                    recommended_action=f"Lock court for standard {surface_type} maintenance resets."
                )
            )

        # Rule 2: Physical Tension Drop boundaries
        if signals.net_tension_newtons < 400.0:
            detected_anomalies.append(
                DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="High" if signals.net_tension_newtons < 380.0 else "Medium",
                    category="Structural Hardware",
                    description=f"Net structural tension dropped to {signals.net_tension_newtons:.1f}N.",
                    confidence_score=0.96,
                    recommended_action="Deploy groundskeeper to re-tension net ratchets."
                )
            )

        # Rule 3: Wet / Dangerous Surface Friction limits
        if court_status == "Rained_Out" or signals.surface_friction_index < 0.75:
            detected_anomalies.append(
                DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="Critical",
                    category="Surface Slip Hazard",
                    description=f"Surface state or friction coefficient index ({signals.surface_friction_index:.2f}) triggers hydroplaning risks.",
                    confidence_score=0.95,
                    recommended_action="Lock entry gates until court surface index completely dries."
                )
            )

        return CourtDiagnosticsPayloadSchema(
            session_id=str(uuid.uuid4()),
            court_id=signals.court_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            metrics=DiagnosticsMetricsSchema(
                surface_friction_index=round(signals.surface_friction_index, 2),
                bounce_uniformity_percentage=round(calculated_bounce, 1),
                net_tension_newtons=round(signals.net_tension_newtons, 1),
                ambient_temperature_celsius=round(signals.ambient_temperature_celsius, 1),
                humidity_percentage=round(signals.humidity_percentage, 1)
            ),
            anomalies=detected_anomalies,
            agent_version="v1.7.0-meta-aware"
        )
