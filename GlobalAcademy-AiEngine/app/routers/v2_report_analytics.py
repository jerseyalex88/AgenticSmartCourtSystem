# File: GlobalAcademy-AiEngine/app/routers/v2_report_analytics.py
import os
import io
from uuid import uuid4
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, status, Request
from pydantic import BaseModel, UUID4

from app.services.v2_ingestion_service import v2IngestionService

router = APIRouter(prefix="/api/v2/ai/knowledge", tags=["v2 Enterprise RAG Ingestion Systems"])

class IngestionStartResponseSchema(BaseModel):
    document_name: str
    job_id: str
    status: str
    message: str

@router.post("/ingest-manual", response_model=IngestionStartResponseSchema, status_code=status.HTTP_202_ACCEPTED)
async def ingest_manual(
    request: Request,
    background_tasks: BackgroundTasks,
    academy_id: UUID4 = Form(...),
    branch_id: UUID4 = Form(...),
    court_id: Optional[UUID4] = Form(None), # Nullable based on our Step 1 architecture debate
    document_file: UploadFile = File(...)
):
    """
    Accepts raw unstructured PDF manuals, issues an instant Job GUID, 
    and handles chunking and vector storage on isolated background rails.
    """
    # Verify file structure boundaries
    if not document_file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unsupported asset structure. The enterprise ingestion engine requires native PDF documents."
        )

    # Read the file contents entirely into system memory buffers to avoid disk IO stress
    try:
        file_bytes = await document_file.read()
    except Exception as io_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to stream incoming file bytes: {io_err}"
        )

    job_id = str(uuid4())
    shared_client = request.app.state.async_http_client

    # Dispatch the data down to the asynchronous worker matrix queue
    background_tasks.add_task(
        v2IngestionService.process_document_ingetion,
        client=shared_client,
        academy_id=str(academy_id),
        branch_id=str(branch_id),
        court_id=str(court_id) if court_id else None,
        document_name=document_file.filename,
        file_bytes=file_bytes
    )

    return IngestionStartResponseSchema(
        document_name=document_file.filename,
        job_id=job_id,
        status="PROCESSING",
        message="Document uploaded successfully. Parsing and vectorizing initiated in background core registers."
    )
