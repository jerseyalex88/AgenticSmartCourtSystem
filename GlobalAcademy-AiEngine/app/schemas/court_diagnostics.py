# app/schemas/court_diagnostics.py
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field, UUID4
from typing import List, Literal

class CourtDiagnosticRequest(BaseModel):
    """🛡️ Validates incoming .NET multi-tenant court telemetry vectors."""
    tenant_id: UUID4 = Field(..., description="System Guid bounding multi-tenant segregation")
    court_id: UUID4 = Field(..., description="Target database identifier for the court asset")
    surface_material: Literal["Clay", "Grass", "Hard"] = Field(..., description="Strict material type constraints")
    cumulative_use_hours: float = Field(..., ge=0.0, description="Rolling runtime hours since last full resurfacing")
    environmental_moisture_pct: float = Field(..., ge=0.0, le=100.0, description="Real-time moisture sensor scale")

class CourtDiagnosticResponse(BaseModel):
    """🧠 Guarantees the output structure sent back over the .NET network bridge."""
    is_processed_successfully: bool
    structural_fatigue_index: float = Field(..., ge=0.0, le=100.0)
    safety_lockout_active: bool
    maintenance_urgency_tier: Literal["Routine", "Urgent", "Emergency"]
    next_upkeep_window_days: int

class DiagnosticsMetricsSchema(BaseModel):
    surface_friction_index: float = 0.82
    bounce_uniformity_percentage: float = 94.5
    net_tension_newtons: float = 385.0
    ambient_temperature_celsius: float = 22.4
    humidity_percentage: float = 58.0

class DiagnosticsAnomalySchema(BaseModel):
    # Use default_factory so a new Guid is generated for EVERY iteration
    anomaly_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    severity: str = "Medium"
    category: str = "Structural Hardware"
    description: str = "Net tension dropped below regulatory 400N baseline."
    confidence_score: float = 0.98
    recommended_action: str = "Tighten net ratchets to standard physical operating bounds."

class CourtDiagnosticsPayloadSchema(BaseModel):
    # Use default_factory for the root session_id as well
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    court_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metrics: DiagnosticsMetricsSchema = Field(default_factory=DiagnosticsMetricsSchema)
    
    # Use default_factory for the list to guarantee unique sub-anomaly objects
    anomalies: List[DiagnosticsAnomalySchema] = Field(
        default_factory=lambda: [DiagnosticsAnomalySchema()]
    )
    agent_version: str = "v1.4.2"