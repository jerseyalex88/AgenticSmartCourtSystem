# File: GlobalAcademy-AiEngine/app/routers/financial_report_analytics.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.financial_report_service import FinancialReportService

router = APIRouter(prefix="/api/ai/financial-report", tags=["Executive Financial Composers"])

class FinancialReportInputSchema(BaseModel):
    academy_name: str
    total_invoiced_volume: float
    voided_volume: float
    refunded_volume: float
    settled_revenue: float

@router.post("/compile-ledger-audit", status_code=status.HTTP_200_OK)
async def compile_ledger_audit(payload: FinancialReportInputSchema):
    """
    Accepts consolidated invoice data structures from the .NET controller
    and returns a downloadable corporate executive financial PDF stream binary content array.
    """
    try:
        pdf_binary_content = FinancialReportService.compile_financial_executive_report(payload.model_dump())
        
        return Response(
            content=pdf_binary_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Financial_Ledger_Audit_{payload.academy_name.replace(' ', '_')}.pdf"
            }
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Financial PDF generation service failed: {err}")
