# app/routers/pricing.py
from fastapi import APIRouter
from app.schemas.pricing import PricingRequest
from app.services.pricing_agent import calculate_advanced_predictive_rate

# Create the specific router component layer
router = APIRouter(prefix="/api/ai", tags=["Financial AI Pricing Agents"])

@router.post("/predict-pricing")
def predict_pricing_endpoint(payload: PricingRequest):
    """Receives target asset tracking metrics and computes the optimized price matrix."""
    optimized_rate = calculate_advanced_predictive_rate(payload)
    return {
        "success": True,
        "original_base_price": payload.base_price,
        "ai_optimized_price": optimized_rate,
        "variance_delta": round(optimized_rate - payload.base_price, 2)
    }
