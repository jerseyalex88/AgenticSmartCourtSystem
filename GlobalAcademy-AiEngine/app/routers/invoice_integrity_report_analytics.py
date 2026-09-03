# File: GlobalAcademy-AiEngine/app/routers/invoice_integrity_report_analytics.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.invoice_integrity_report_service import InvoiceIntegrityReportService

router = APIRouter(prefix="/api/ai/invoice-integrity-report", tags=["Executive Integrity Composers"])

class IntegrityReportInputSchema(BaseModel):
    academy_name: str
    status_paid_count: int
    status_voided_count: int
    status_refunded_count: int
    type_court_count: int
    type_racket_count: int
    type_shop_count: int

@router.post("/compile-count-audit", status_code=status.HTTP_200_OK)
async def compile_count_audit(payload: IntegrityReportInputSchema):
    """
    Accepts strongly-typed transaction grouping count structures from C#
    and returns a high-fidelity downloadable Pie and Bar chart PDF stream content array.
    """
    try:
        pdf_binary_content = InvoiceIntegrityReportService.compile_integrity_report(payload.model_dump())
        
        return Response(
            content=pdf_binary_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Invoice_Integrity_Audit_{payload.academy_name.replace(' ', '_')}.pdf"
            }
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Integrity PDF generation service failed: {err}")
