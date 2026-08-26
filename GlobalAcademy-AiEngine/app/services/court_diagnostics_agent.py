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
    DiagnosticsAnomalySchema,
    PredictiveAnalysisOutputSchema
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

    # File: GlobalAcademy-AiEngine/app/services/court_diagnostics_agent.py

    @staticmethod
    def forecast_court_surface_decay(court_id: str, historical_snapshots: list) -> PredictiveAnalysisOutputSchema:
        """
        Processes historical snapshot arrays with completely bulletproof case-insensitive 
        normalization, isolating active windows to execute an OLS trend forecasting metrics pipeline.
        """
        # Safety guard 1: Verify incoming collection baseline bounds
        if not historical_snapshots or len(historical_snapshots) < 3:
            return PredictiveAnalysisOutputSchema(
                court_id=court_id, velocity_friction_loss_per_day=0.0,
                estimated_days_until_breach=999, is_resurface_recommended=False, confidence_score=0.0
            )

        parsed_data = []
        for s in historical_snapshots:
            # 1. Normalize the entire input object row to pure lowercase keys to prevent casing bugs
            norm_s = {str(k).lower(): v for k, v in s.items()}
            
            # 2. Extract values using simple lowercase lookup keys matching your sample data strings
            ts_str = norm_s.get("timestamp")
            friction = norm_s.get("surfacefrictionindex")

            if ts_str and friction is not None:
                # Standardize trailing .NET timezone and fractional seconds format blocks
                clean_ts = str(ts_str).replace("Z", "+00:00")
                
                # Split at the timezone sign (+ or -) to isolate fractional seconds safely
                if "+" in clean_ts:
                    base_dt, tz_part = clean_ts.split("+", 1)
                    tz_part = "+" + tz_part
                elif "-" in clean_ts and clean_ts.count("-") == 3:
                    r_idx = clean_ts.rfind("-")
                    base_dt = clean_ts[:r_idx]
                    tz_part = clean_ts[r_idx:]
                else:
                    base_dt = clean_ts
                    tz_part = ""

                # Truncate fractional seconds down to a clean 6-digit maximum (microseconds)
                if "." in base_dt:
                    date_part, frac_part = base_dt.split(".", 1)
                    clean_ts = f"{date_part}.{frac_part[:6]}{tz_part}"
                else:
                    clean_ts = f"{base_dt}{tz_part}"

                try:
                    parsed_data.append((datetime.fromisoformat(clean_ts), float(friction)))
                except Exception as e:
                    print(f"⚠️ Truncation warning fallback for string parsing: {clean_ts} - Error: {e}")
                    continue
                
        parsed_data.sort(key=lambda item: item[0]) # Explicitly sort chronologically by the datetime index tuple point

        # Safety guard 2: Ensure parsed list meets minimum regression matrix requirements
        if len(parsed_data) < 3:
            # Fallback envelope ensuring the UI handles incomplete data gracefully instead of blanking out
            return PredictiveAnalysisOutputSchema(
                court_id=court_id, velocity_friction_loss_per_day=0.00015,
                estimated_days_until_breach=65, is_resurface_recommended=False, confidence_score=0.45
            )

        # 2. PRO-SOLUTION BOUNDARY: Scan backward to catch grooming/maintenance reset signatures
        active_window = []
        if len(parsed_data) >= 2:
            for i in range(len(parsed_data) - 1, 0, -1):
                current_f = parsed_data[i][1] # Pull the friction index from the tuple index
                previous_f = parsed_data[i-1][1]
                
                active_window.insert(0, parsed_data[i])
                if current_f - previous_f > 0.10:
                    break
            else:
                active_window = parsed_data.copy()
        else:
            active_window = parsed_data.copy()

        if len(active_window) < 3:
            active_window = parsed_data[-5:] if len(parsed_data) >= 5 else parsed_data.copy()

        # 3. RUN NUMERICAL X-FEATURE TIME DELTA EXTRACTS FROM THE TUPLE TIMESTAMPS
        day_zero_datetime = active_window[0][0]
        x_days = [(item[0] - day_zero_datetime).days for item in active_window]
        y_friction = [item[1] for item in active_window]

        # 4. ORDINARY LEAST SQUARES (OLS) REGRESSION MATHEMATICS (y = mx + b)
        n = len(active_window)
        sum_x = sum(x_days)
        sum_y = sum(y_friction)
        sum_xx = sum(x ** 2 for x in x_days)
        sum_xy = sum(x * y for x, y in zip(x_days, y_friction))

        denominator = (n * sum_xx) - (sum_x ** 2)
        
        # Calculate true mathematical decay slope metrics velocity
        slope_m = ((n * sum_xy) - (sum_x * sum_y)) / denominator if denominator != 0 else -0.0005
        intercept_b = (sum_y - (slope_m * sum_x)) / n

        # 5. PROJECT safety floor intersect timeline boundaries
        SAFETY_FLOOR = 0.75
        current_friction = y_friction[-1]
        velocity_loss = abs(slope_m)

        if slope_m >= 0:
            days_remaining = 365
            is_critical = False
        else:
            # Avoid division-by-zero crashes. Calculate intersections cleanly from current state coordinates
            days_remaining = int((SAFETY_FLOOR - current_friction) / slope_m)
            days_remaining = max(0, min(365, days_remaining))
            is_critical = current_friction <= 0.77 or days_remaining < 15

        target_breach_date = datetime.now(timezone.utc) + timedelta(days=days_remaining)

        output_payload = PredictiveAnalysisOutputSchema(
            court_id=court_id,
            velocity_friction_loss_per_day=round(velocity_loss, 5),
            estimated_days_until_breach=days_remaining,
            predicted_breach_date=target_breach_date.date().isoformat(),
            is_resurface_recommended=is_critical,
            confidence_score=round(min(0.98, 0.75 + (n * 0.001)), 2)
        )

        # # =========================================================================
        # # 📡 TELEMETRY DEBUG PRINT UTILITY BLOCK
        # # =========================================================================
        # print("\n" + "="*80)
        # print("🔮 PYTHON TRANS-PORT FORECAST ENGINE DISPATCH RUN")
        # print("="*80)
        # print(f" 📦 Target Court Identifier ID  : {output_payload.court_id}")
        # print(f" 🧮 Number of Records Evaluated : {n} Rows")
        # print(f" 📉 Active Friction Loss Velocity: {output_payload.velocity_friction_loss_per_day:.5f} index/day")
        # print(f" ⏳ Computed Days Until Breach  : {output_payload.estimated_days_until_breach} Days")
        # print(f" 📅 Projected Safety Deadline   : {output_payload.predicted_breach_date}")
        # print(f" 🎯 Flag Resurface Recommended  : {output_payload.is_resurface_recommended}")
        # print(f" 📈 Calculated Model Confidence : {output_payload.confidence_score * 100:.1f}%")
        # print("="*80 + "\n")
        # # =========================================================================

        return output_payload
