# app/services/court_diagnostics_agent.py
from app.schemas. court_diagnostics import CourtDiagnosticRequest, CourtDiagnosticResponse
import uuid
import random
from datetime import datetime, timedelta, timezone
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

    @staticmethod
    def generate_synthetic_history(court_id: str, surface_type: str, is_indoor: bool, days_back: int = 180) -> list:
        """
        Generates a 180-day chronological dataset modeling surface friction decay,
        weekend activity spikes, and localized net tension loss.
        """
        historical_payloads = []
        current_time = datetime.now(timezone.utc)
        
        # Define surface wear factors matching requirement (2) faster lifecycles
        if surface_type == "Grass":
            base_friction = 0.88
            decay_rate_per_day = 0.0012   # Rapid degradation profile
            base_bounce = 82.0
        elif surface_type == "Clay":
            base_friction = 0.82
            decay_rate_per_day = 0.0007   # Moderate wear, requires frequent grooming
            base_bounce = 94.0
        else: # Hard Court
            base_friction = 0.85
            decay_rate_per_day = 0.0004   # Durable structural threshold baseline
            base_bounce = 96.0

        # Loop backward through time day-by-day to simulate continuous play logs
        for day in range(days_back, 0, -1):
            log_date = current_time - timedelta(days=day)
            is_weekend = log_date.weekday() >= 5
            
            # Simulate aggregate daily minutes played (Weekend tournaments track double traffic)
            daily_minutes = random.randint(240, 480) if is_weekend else random.randint(60, 180)
            
            # Deduct cumulative surface degradation friction coefficients
            base_friction -= (daily_minutes * 0.000002) * (1.5 if surface_type == "Grass" else 1.0)
            # Clip friction floor back up if a periodic resurface maintenance cycle is randomly met
            if base_friction < 0.68:
                base_friction = 0.84 # Reset following simulation grooming threshold
                
            # Calibrate net tension sag over time
            net_sag = random.uniform(0.1, 0.4) * (1.0 if is_indoor else 1.5)
            simulated_tension = max(360.0, 430.0 - (day * net_sag) % 70)
            
            # Calculate ambient parameters
            humidity = random.uniform(40.0, 85.0)
            temperature = random.uniform(15.0, 32.0)
            
            metrics = DiagnosticsMetricsSchema(
                surface_friction_index=round(max(0.60, base_friction), 2),
                bounce_uniformity_percentage=round(max(75.0, base_bounce - (day * 0.02) % 10), 1),
                net_tension_newtons=round(simulated_tension, 1),
                ambient_temperature_celsius=round(temperature, 1),
                humidity_percentage=round(humidity, 1)
            )
            
            # Append realistic anomalies if boundaries cross
            anomalies = []
            session_guid = str(uuid.uuid4())
            
            if metrics.net_tension_newtons < 400.0:
                anomalies.append(DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="Medium" if metrics.net_tension_newtons > 380.0 else "High",
                    category="Structural Hardware",
                    description=f"Net tension fell to {metrics.net_tension_newtons}N during simulation cycles.",
                    confidence_score=0.95,
                    recommended_action="Tighten manual net rachets."
                ))

            if metrics.surface_friction_index < 0.75:
                anomalies.append(DiagnosticsAnomalySchema(
                    anomaly_id=str(uuid.uuid4()),
                    severity="Critical",
                    category="Surface Degradation",
                    description=f"Friction boundary index breached on {surface_type} asset interface.",
                    confidence_score=0.92,
                    recommended_action="Lock surface entrance gates and schedule maintenance sweep."
                ))

            payload = CourtDiagnosticsPayloadSchema(
                session_id=session_guid,
                court_id=court_id,
                timestamp=log_date.isoformat(),
                metrics=metrics,
                anomalies=anomalies,
                agent_version="v1.7.5-historical-seeder"
            )
            historical_payloads.append(payload.model_dump(mode="json"))
            
        return historical_payloads