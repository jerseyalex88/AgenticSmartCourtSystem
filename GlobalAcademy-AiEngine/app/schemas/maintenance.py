# app/schemas/maintenance.py
from pydantic import BaseModel, Field

class CourtWearRequest(BaseModel):
    """Validation schema specifying telemetry data requirements for court surface degradation analysis."""
    court_id: str = Field(..., description="The unique system identifier for the target court node asset.")
    surface_type: str = Field(..., description="Surface texture type material (Hard, Clay, Grass).")
    aggregate_minutes_played: int = Field(..., ge=0, description="Cumulative play time elapsed since last overhaul.")
    days_since_last_resurface: int = Field(..., ge=0, description="Erosion duration timestamp tracker component.")
    is_indoor: bool = Field(..., description="Weather shields tracker variable indicator.")
