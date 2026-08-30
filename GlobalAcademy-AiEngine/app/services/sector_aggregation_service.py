# File: GlobalAcademy-AiEngine/app/services/sector_aggregation_service.py
from datetime import datetime
from typing import List, Tuple, Dict, Any
from app.schemas.court_diagnostics import PredictiveAnalysisOutputSchema

class SectorAggregationService:
    # Define rigid spatial geometric percentage boundaries for our 12 court sectors.
    # X spans 0 to 100% (Left to Right), Y spans 0 to 50% (Top to Bottom).
    _SECTOR_BOUNDARIES = [
        {"id": "deuce_baseline", "name": "Deuce Baseline", "x_min": 5.0, "x_max": 26.0, "y_min": 5.0, "y_max": 25.0},
        {"id": "ad_baseline", "name": "Ad Baseline", "x_min": 5.0, "x_max": 26.0, "y_min": 25.0, "y_max": 45.0},
        {"id": "deuce_midcourt", "name": "Deuce Mid-Court", "x_min": 26.0, "x_max": 50.0, "y_min": 5.0, "y_max": 25.0},
        {"id": "ad_midcourt", "name": "Ad Mid-Court", "x_min": 26.0, "x_max": 50.0, "y_min": 25.0, "y_max": 45.0},
        {"id": "left_service_box", "name": "Left Service Box", "x_min": 50.0, "x_max": 74.0, "y_min": 5.0, "y_max": 25.0},
        {"id": "right_service_box", "name": "Right Service Box", "x_min": 50.0, "x_max": 74.0, "y_min": 25.0, "y_max": 45.0},
        {"id": "left_net_quadrant", "name": "Left Net Quadrant", "x_min": 74.0, "x_max": 95.0, "y_min": 5.0, "y_max": 25.0},
        {"id": "right_net_quadrant", "name": "Right Net Quadrant", "x_min": 74.0, "x_max": 95.0, "y_min": 25.0, "y_max": 45.0},
        
        # Alley boundaries (Outer doubles buffers matching the SVG court blueprint mapping space)
        {"id": "deuce_deep_alleys", "name": "Deuce Deep Alleys", "x_min": 5.0, "x_max": 50.0, "y_min": 0.0, "y_max": 5.0},
        {"id": "ad_deep_alleys", "name": "Ad Deep Alleys", "x_min": 5.0, "x_max": 50.0, "y_min": 45.0, "y_max": 50.0},
        {"id": "left_net_alleys", "name": "Left Net Alleys", "x_min": 50.0, "x_max": 95.0, "y_min": 0.0, "y_max": 5.0},
        {"id": "right_net_alleys", "name": "Right Net Alleys", "x_min": 50.0, "x_max": 95.0, "y_min": 45.0, "y_max": 50.0}
    ]

    @classmethod
    def compile_spatial_summary(cls, court_id: str, video_filename: str, bounce_points: List[Tuple[float, float, str]]) -> Dict[str, Any]:
        """
        Groups raw spatial points into 12 functional maintenance sectors [yes].
        Calculates impact counts and wear intensity indices matching your C# data contracts perfectly [yes].
        """
        # Initialize an empty ledger dictionary mapping counts to zero
        sector_counts = {sector["id"]: 0 for sector in cls._SECTOR_BOUNDARIES}
        
        # 1. Coordinate Boundary Intersection Check Loop
        for x, y, _ in bounce_points:
            for sector in cls._SECTOR_BOUNDARIES:
                if sector["x_min"] <= x < sector["x_max"] and sector["y_min"] <= y < sector["y_max"]:
                    sector_counts[sector["id"]] += 1
                    break

        # 2. Map and Compile Into Your Output JSON Schema Specification Structure
        compiled_sectors = []
        for sector in cls._SECTOR_BOUNDARIES:
            count = sector_counts[sector["id"]]
            
            # Simple linear load density calculation (capped safely at 1.0 maximum)
            wear_index = min(1.0, round(count / 150.0, 2)) if count > 0 else 0.0

            compiled_sectors.append({
                "id": sector["id"],
                "name": sector["name"],
                "bounce_count": count,
                "wear_intensity_index": wear_index
            })

        # 3. Compile the Complete Spatial Heatmap Payload Tree Matching Your .NET DTO Attributes
        formatted_bounce_points = [
            {"x": pt[0], "y": pt[1], "intensity": pt[2]} for pt in bounce_points
        ]

        # 🛠️ NEW DEBUG TRACKER: Lock the raw incoming point matrix values exactly as they are calculated
        formatted_bounce_points = []
        raw_debug_points = []

        for x, y, intensity in bounce_points:
            formatted_bounce_points.append({"x": x, "y": y, "intensity": intensity})
            # Preserve a raw copy for side-by-side inspection down the wire
            raw_debug_points.append({"raw_processed_x": x, "raw_processed_y": y, "assigned_intensity": intensity})

        return {
            "court_id": court_id,
            "total_processed_bounces": len(bounce_points),
            "analyzed_video_filename": video_filename,
            "last_updated_utc": datetime.utcnow().isoformat() + "Z",
            "sectors": compiled_sectors,
            "bounce_points": formatted_bounce_points,
            "debug_raw_unwarped_points": raw_debug_points
        }
