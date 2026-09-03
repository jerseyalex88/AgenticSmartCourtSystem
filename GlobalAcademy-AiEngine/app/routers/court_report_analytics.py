# File: GlobalAcademy-AiEngine/app/routers/report_analytics.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.report_generation_service import ReportGenerationService

router = APIRouter(prefix="/api/ai/report", tags=["Executive Report Composers"])

class ReportGenerationInputSchema(BaseModel):
    court_name: str
    branch_name: str
    friction_index: float
    bounce_uniformity: float
    net_tension: float
    ambient_temp: float
    humidity: float
    anomalies: List[Dict[str, Any]] # Safely catches your dynamic nested database anomalies loop arrays

@router.post("/compile-facility-audit", status_code=status.HTTP_200_OK)
async def compile_facility_audit(payload: ReportGenerationInputSchema):
    """
    Accepts data summary structures from the database context ledger
    and returns a downloadable corporate PDF stream binary content array.
    """
    try:
        pdf_binary_content = ReportGenerationService.compile_executive_pdf_report(payload.model_dump())
        
        # 🎯 RETURN AN EXPLICIT STREAM RESPONSE: Force accurate content descriptors over the wire!
        return Response(
            content=pdf_binary_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Facility_Audit_{payload.court_name.replace(' ', '_')}.pdf"
            }
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"PDF generation service failed: {err}")
