# app/services/pricing_agent.py
from app.schemas.pricing import PricingRequest

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
