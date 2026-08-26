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
    surface_friction_index: float
    bounce_uniformity_percentage: float
    net_tension_newtons: float
    ambient_temperature_celsius: float
    humidity_percentage: float

class DiagnosticsAnomalySchema(BaseModel):
    anomaly_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    severity: str
    category: str
    description: str
    confidence_score: float
    recommended_action: str

class CourtDiagnosticsPayloadSchema(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    court_id: str
    academy_id: str = ""
    branch_id: str = ""
    # FIX: Default to current time, but allow explicit historical strings to override it during seeding sweeps
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metrics: DiagnosticsMetricsSchema
    anomalies: List[DiagnosticsAnomalySchema] = Field(default_factory=list)
    agent_version: str = "v1.7.5-historical-seeder"

class RawTelemetryInputSchema(BaseModel):
    """
    Validates inbound raw physical telemetry streams sent directly 
    from the hardware array or simulation coordinators.
    """
    court_id: str = Field(..., description="Target system Guid matching the physical court record.")
    surface_friction_index: float = Field(..., ge=0.0, le=1.5, description="Raw frictional drag measurement.")
    humidity_percentage: float = Field(..., ge=0.0, le=100.0, description="Ambient air humidity sensor percentage.")
    ambient_temperature_celsius: float = Field(..., description="Ambient court sensor reading in Celsius.")
    net_tension_newtons: float = Field(..., ge=0.0, description="Tensile force metric in Newtons.")
    iteration_index: int = Field(0, description="Simulation tracking cycle parameter.")

class TelemetrySignalsInputSchema(BaseModel):
    court_id: str = Field(..., description="Target system Guid matching the physical court record.")
    surface_friction_index: float = Field(..., ge=0.0, le=1.5, description="Raw frictional drag measurement.")
    humidity_percentage: float = Field(..., ge=0.0, le=100.0, description="Ambient air humidity sensor percentage.")
    ambient_temperature_celsius: float = Field(..., description="Ambient court sensor reading in Celsius.")
    net_tension_newtons: float = Field(..., ge=0.0, description="Tensile force metric in Newtons.")
    iteration_index: int = Field(0, description="Simulation tracking cycle parameter.")

class CourtMetadataInputSchema(BaseModel):
    surface_type: str
    is_indoor: bool
    aggregate_minutes_played: int
    maintenance_threshold_minutes: int
    status: str
    dry_coefficient: float

class MasterOrchestrationInputSchema(BaseModel):
    """
    Matches the compiledWrapperPacket format sent directly
    from your C# RequestAgentAnalysisAsync method body.
    """
    telemetry_signals: TelemetrySignalsInputSchema
    court_metadata: CourtMetadataInputSchema