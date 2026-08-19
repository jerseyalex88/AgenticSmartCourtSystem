# app/schemas/pricing.py
from pydantic import BaseModel, Field

class PricingRequest(BaseModel):
    """Validation schema specifying parameter requirements for dynamic price optimization requests."""
    base_price: float = Field(..., description="The standard baseline cost tracking value of the resource.")
    month_of_year: int = Field(..., ge=1, le=12, description="Target calendar month tracking identifier.")
    current_occupancy_pct: float = Field(..., ge=0.0, le=100.0, description="Current asset utilization percentage rate.")
    days_until_arrival: int = Field(..., ge=0, description="Lead time countdown metrics tracking interval.")
    is_program_demand_spiking: bool = Field(..., description="Cross-module marker representing camp attendance spikes.")
