import math
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

# 🚀 Create an isolated router instance (Like an ASP.NET Controller class)
router = APIRouter(prefix="/api/ai", tags=["Financial AI Agents"])

# 🚀 Initialize your central Python AI Microservice App Context Instance
# app = FastAPI(
#     title="Smart Court Agentic AI Engine",
#     description="Advanced Operational Heart for Global Academy ERP Ecosystem Platforms",
#     version="1.0.0"
# )

# 📋 DATA STRUCTURE DEFINITION (The Input DTO)
# This class acts exactly like a C# Data Transfer Object (DTO). It defines and validates
# the precise parameters that your .NET 10 Web API core must send over the network to this engine.
class PricingRequest(BaseModel):
    base_price: float              # The default base cost of the asset (e.g., $200.00 room or $500.00 camp)
    month_of_year: int             # Seasonality tracer (1 = January, 12 = December)
    current_occupancy_pct: float   # Current inventory compression tracker (0.0 to 100.0 percent)
    days_until_arrival: int        # Lead time velocity marker (how close the checkout clock is to arrival)
    is_program_demand_spiking: bool # Cross-Module Trigger: True if adjacent training clinics are experiencing high registration metrics


# 🧠 THE REVENUE OPTIMIZATION CORE (The Predictive Function)
def calculate_advanced_predictive_rate(data: PricingRequest) -> float:
    """
    Takes an inbound structural business context matrix and applies 
    heuristic predictive modifiers to compute the absolute optimal financial price point.
    """
    # Grab the baseline starting point passed down by the caller controller
    calculated_price = data.base_price

    # 🌊 WAVE 1: SEASONALITY MULTIPLIER MATRIX
    # Elite tennis academies experience high summer surges (Camps, outdoor weather)
    # and lower winter baseline plateaus. We apply a targeted multiplier curve.
    if data.month_of_year in [6, 7, 8]:  # June, July, August (Peak European/US Summer Season)
        seasonality_modifier = 1.35      # 35% Price markup execution
    elif data.month_of_year in [11, 12, 1]: # November, December, January (Winter Low Season)
        seasonality_modifier = 0.80      # 20% Discount liquidator discount
    else:
        seasonality_modifier = 1.00      # Spring/Autumn stable market value baseline

    calculated_price *= seasonality_modifier

    # 🌊 WAVE 2: INVENTORY COMPRESSION VECTOR
    # Tracks how scarce the asset is in real-time. As availability drops, value scales.
    if data.current_occupancy_pct >= 90.0:
        compression_modifier = 1.50      # Critical scarcity: 50% price increase
    elif data.current_occupancy_pct >= 75.0:
        compression_modifier = 1.25      # High demand: 25% price increase
    elif data.current_occupancy_pct < 30.0:
        compression_modifier = 0.85      # Low utilization alert: 15% discount markdown to stimulate booking velocity
    else:
        compression_modifier = 1.00      # Normal operational occupancy

    calculated_price *= compression_modifier

    # 🌊 WAVE 3: LEAD TIME / PROXIMITY VELOCITY SCANNER
    # Identifies buying patterns based on urgency. Last minute bookings trigger premium pricing
    # for high-demand zones, but can trigger clearance rates during low-demand cycles.
    if data.days_until_arrival <= 3:
        # Last-minute panic window: If occupancy is already strong, charge a premium.
        if data.current_occupancy_pct >= 60.0:
            calculated_price *= 1.20     # Urgent luxury acquisition fee (+20%)
        else:
            calculated_price *= 0.90     # Distress liquidation: drop price (-10%) to fill an empty asset slot
    elif data.days_until_arrival > 90:
        calculated_price *= 0.95         # Early bird customer loyalty reward pricing (-5%)

    # 🌊 WAVE 4: CROSS-MODULE AGENTIC TRIGGER LINKAGE
    # This is the 7-Module connectedness engine in action. If Module 2 (Camps) is spiking,
    # it predicts that Module 3 (Lodging) or Module 7 (Courts) will undergo systemic demand pressure.
    if data.is_program_demand_spiking:
        calculated_price *= 1.15         # Pre-emptive ecosystem buffer markup (+15%)

    # Final visual sanitation: Round to exactly 2 decimal places to match your decimal(18,2) database requirements
    return round(calculated_price, 2)


# 🌐 THE WEB INTERFACE ROUTING PLANE (API Endpoints)
@router.get("/")
def read_root():
    return {
        "status": "Online",
        "service": "Agentic Smart Court AI Platform Core",
        "tenant_mode": "Dynamic Multi-Tenant Relay Enabled"
    }

@router.post("/predict-pricing")
def predict_pricing_endpoint(payload: PricingRequest):
    """
    POST Request Endpoint exposed securely across internal network interfaces.
    Receives multi-tenant property data matrices and fields back the AI optimized pricing decision.
    """
    try:
        # 1. Enforce strict parameter guard rails to eliminate corrupted mathematical telemetry injections
        if payload.base_price <= 0:
            raise HTTPException(status_code=400, detail="Calculation Error: Asset base valuation must exceed zero.")
        if not (1 <= payload.month_of_year <= 12):
            raise HTTPException(status_code=400, detail="Validation Failure: Month identifier parameters must fallback between 1 and 12.")
        
        # 2. Fire up the core calculation optimization algorithms
        optimized_rate = calculate_advanced_predictive_rate(payload)
        
        # 3. Stream the unified structural insights dictionary back out over the pipeline
        return {
            "success": True,
            "original_base_price": payload.base_price,
            "ai_optimized_price": optimized_rate,
            "variance_delta": round(optimized_rate - payload.base_price, 2)
        }
        
    except Exception as error:
        # Fallback security handler tracking exceptions without crashing the service pipeline instance
        raise HTTPException(status_code=500, detail=f"Internal Agent Process Fault: {str(error)}")