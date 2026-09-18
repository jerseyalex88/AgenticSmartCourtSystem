# File: GlobalAcademy-AiEngine/app/routers/v2_report_analytics.py
import io
import base64
import uuid
import os
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, status, Query
from pydantic import BaseModel, UUID4
from langchain_core.messages import HumanMessage

from app.graphs.v2_agent_orchestrator import smart_court_agent_engine
from app.services.v2_ingestion_service import v2IngestionService
from app.services.v2_retrieval_service import v2RetrievalService
from app.services.v2_rerank_service import v2RerankService
from app.services.v2_evaluation_service import v2EvaluationService
from app.services.v2_text_to_speech_service import v2TextToSpeechService

router = APIRouter(prefix="/api/ai/knowledge", tags=["v2 Core Knowledge Automation Base Grid"])

class IngestionBatchResponse(BaseModel):
    job_id: str
    status: str
    message: str

class UploadedDocSummary(BaseModel):
    document_name: str
    court_id: Optional[str]
    court_name: str
    created_at_utc: str

class ChunkContentSummary(BaseModel):
    page_number: int
    text_content: str

@router.post("/ingest-manuals", status_code=status.HTTP_202_ACCEPTED)
async def ingest_manuals(
    background_tasks: BackgroundTasks,
    academy_id: str = Form(...), # 🚀 FIX: Swapped UUID4 for string to gracefully absorb all cross-platform GUID inputs
    branch_ids: List[str] = Form(None), 
    court_id: Optional[str] = Form(None),
    # 🚀 FIX: Re-aligned key name token to 'files' to match your C# multipartContent.Add key exactly!
    files: List[UploadFile] = File(...) 
):
    """
    Asynchronously processes unstructured PDF compliance handbooks 
    and chunks them across one or more target branch multi-tenant contexts natively.
    """
    print(f"📡 [INGESTION ROUTE CALL]: Intercepted payload for Academy: {academy_id}")
    print(f"   👉 Raw branch_ids list input: {branch_ids}")
    print(f"   👉 Raw court_id context input: {court_id}")

    # Defensive sanity step: ensure branch_ids is never None and parse out empty fields
    if not branch_ids:
        branch_ids = []
        
    # If a single item got parsed as a list containing a comma string, flatten it
    flattened_branch_ids = []
    for item in branch_ids:
        if "," in item:
            flattened_branch_ids.extend([x.strip() for x in item.split(",") if x.strip()])
        elif item.strip():
            flattened_branch_ids.append(item.strip())

    if not flattened_branch_ids:
        raise HTTPException(status_code=400, detail="Missing required target branch parameter collection boundaries.")

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No active document file binaries uploaded.")

    job_id = str(uuid.uuid4())
    
    # Extract file binaries immediately into memory arrays to release request connection blocks
    prepared_files_payload = []
    for doc in files:
        if not doc.filename.lower().endswith(".pdf"):
            continue
        content_bytes = await doc.read()
        prepared_files_payload.append((doc.filename, content_bytes))

    if not prepared_files_payload:
        raise HTTPException(status_code=400, detail="No valid raw PDF assets discovered in file arrays.")

    try:
        # Pass the cleanly flattened branch IDs directly down to your background vector execution thread
        background_tasks.add_task(
            v2IngestionService.process_batch_pdf_ingestion,
            academy_id=str(academy_id),
            branch_ids=flattened_branch_ids, 
            court_id=str(court_id) if court_id and court_id != "ALL" else None,
            files_data=prepared_files_payload
        )
        
        # 🚀 FIX: Bypassed output model serialization bottlenecks by returning a clean direct payload
        return {
            "status": "success", 
            "job_id": job_id,
            "message": "Batch multi-branch vector sharding pipeline scheduled successfully."
        }
        
    except Exception as ex:
        print(f"❌ [ROUTE BINDING FAULT]: Ingestion dispatch failed: {ex}")
        raise HTTPException(status_code=500, detail=str(ex))

@router.get("/list-documents", response_model=List[UploadedDocSummary])
async def list_documents(academy_id: UUID4 = Query(...)):
    return await v2RetrievalService.fetch_unique_uploaded_documents(str(academy_id))

@router.get("/view-content", response_model=List[ChunkContentSummary])
async def view_content(academy_id: UUID4 = Query(...), document_name: str = Query(...)):
    return await v2RetrievalService.reconstruct_document_text(str(academy_id), document_name)

class DiagnosticRequest(BaseModel):
    user_query: str
    academy_id: str
    branch_id: str
    court_id: Optional[str] = None # Added support for the asset-level focus track
    voice_key: str = "en-US-AriaNeural" # Default voice for TTS output if not specified

@router.post("/diagnostic-query-trace")
async def diagnostic_query_trace(background_tasks: BackgroundTasks, payload: DiagnosticRequest):
    trace_job_id = str(uuid.uuid4())
    
    # 1. Package the initial dictionary payload matching our strict SmartCourtAgentState TypedDict
    initial_graph_state = {
        "academy_id": payload.academy_id,
        "branch_id": payload.branch_id,
        "court_id": payload.court_id if payload.court_id and payload.court_id != "ALL" else None,
        "messages": [HumanMessage(content=payload.user_query)],
        "internal_metadata": {}
    }
    
    try:
        # 🚀 2. INVOKE THE STATE MACHINE: LangGraph coordinates thoughts, tools, and DB queries autonomously!
        final_output_state = await smart_court_agent_engine.ainvoke(initial_graph_state)
        
        # Extract the final response message generated by the Oracle Node on exit
        final_messages = final_output_state.get("messages", [])
        final_generated_text = final_messages[-1].content if final_messages else "The state machine exited without a conversational response packet."
        
        # 3. Collate any internal tool calls and citation context strings that ran during the cyclical loops
        # This scans the conversation trace and pulls out data rows to display on your React frontend panels
        retracted_citations_summary = []
        context_strings_accumulator = []
        
        for msg in final_messages:
            # If the tool returned database text blocks, capture them for our citations visualizer panel tab
            if msg.type == "tool":
                context_strings_accumulator.append(msg.content)
                retracted_citations_summary.append({
                    "id": str(uuid.uuid4()),
                    "document_name": "Autonomous Agentic Matrix Lookup",
                    "text_content": msg.content[:280] + "...", # Summarize excerpt length cleanly
                    "page_number": 1,
                    "rerank_score": 1.0
                })

    except Exception as graph_err:
        print(f"❌ [AGENT GRAPH CRITICAL EXECUTION FAULT]: {graph_err}")
        raise HTTPException(status_code=500, detail=f"The agent state machine processing cycle failed: {graph_err}")

    # 4. Synthesize base64 audio chunks directly in memory via edge-tts proxy streams
    audio_bytes_accumulator = b""
    async for chunk in v2TextToSpeechService.stream_text_to_memory_chunks(final_generated_text, payload.voice_key):
        audio_bytes_accumulator += chunk
        
    base64_audio_result = base64.b64encode(audio_bytes_accumulator).decode("utf-8") if audio_bytes_accumulator else None

    # Mock baseline RAGAS metric layout contracts for immediate UI tab hydration
    mock_faithfulness = 0.95 if retracted_citations_summary else 0.0
    mock_relevance = 0.90

    # 🎯 5. TRACE OBSERVABILITY ASSIGNMENT: Stream full background metrics up to your LangSmith Dashboard
    background_tasks.add_task(
        v2EvaluationService.evaluate_rag_transaction_async,
        job_id=trace_job_id,
        academy_id=payload.academy_id,
        user_query=payload.user_query,
        retrieved_contexts=context_strings_accumulator,
        generated_answer=final_generated_text
    )

    return {
        "conversationalSpeechOutput": final_generated_text,
        "audioBase64": base64_audio_result,
        "retractedContextSources": retracted_citations_summary,
        "pipelinePerformance": {
            "faithfulnessScore": mock_faithfulness,
            "answerRelevanceScore": mock_relevance,
            "contextPrecisionScore": 1.0
        }
    }
