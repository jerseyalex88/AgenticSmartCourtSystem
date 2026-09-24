# File: GlobalAcademy-AiEngine/app/routers/v3_harness_router.py
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, UUID4
from uuid import UUID
from typing import Dict, Any, Optional

from app.graphs.v3_agent_state import AgentState, ExecutionStatusEnum
from app.graphs.v3_harness_engr_engine import HarnessEngineeringEngine
from app.services.v3_graph_checkpointer import PostgresGraphCheckpointer
from app.graphs.v3_graph_builder import EnvironmentAuditGraphBuilder

router = APIRouter(prefix="/api/v3/harness", tags=["Agentic Harness Engine Layer"])

class InitializationRequest(BaseModel):
    thread_id: UUID4
    academy_id: UUID4
    branch_id: UUID4
    user_id: str
    user_role: str
    raw_input_prompt: str

class HumanApprovalSignal(BaseModel):
    thread_id: UUID4
    approved: bool
    rejection_notes: Optional[str] = None

@router.post("/execute-agent-intent", status_code=status.HTTP_200_OK)
async def process_orchestration_loop(payload: InitializationRequest):
    """
    Core entry point coordinating multi-agent node traversal sweeps.
    Applies token budgeting and recursion loop circuit breakers automatically.
    """
    # 1. Inspect checkpointer layer for active episodic memory snapshots
    config = {"configurable": {"thread_id": str(payload.thread_id)}}
    existing_snapshot = await PostgresGraphCheckpointer.get_tuple(config)
    
    if existing_snapshot:
        state, metadata = existing_snapshot
        # Increment internal loop counter metric
        state.harness_metrics.current_loop_count += 1
        state.raw_input_prompt = payload.raw_input_prompt
    else:
        # Construct fresh runtime schema footprint block on cold start configurations
        state = AgentState(
            thread_id=payload.thread_id,
            academy_id=payload.academy_id,
            branch_id=payload.branch_id,
            user_id=payload.user_id,
            user_role=payload.user_role,
            raw_input_prompt=payload.raw_input_prompt,
            execution_status=ExecutionStatusEnum.ACTIVE
        )

    # 2. Evaluate Harness Governance Interceptor layers before calling downstream workers
    state = HarnessEngineeringEngine.evaluate_harness_guardrails(state)
    
    # Check if a circuit breaker was triggered
    if state.execution_status == ExecutionStatusEnum.ABORTED_CIRCUIT_BREAKER:
        await PostgresGraphCheckpointer.put(config, state, active_node="Harness_Circuit_Breaker_Gate")
        return state.model_dump()

    # =========================================================================
    # 🧬 ACTIVE LANGGRAPH RUNTIME INVOCATION ENGINE LAYER
    # =========================================================================
    try:
        # Compile the state topology framework dynamically
        compiled_graph = EnvironmentAuditGraphBuilder.compile_harness_graph()
        
        # Fire up the multi-agent orchestration loop async.
        # LangGraph runs through the supervisor and workers, matching your thread config,
        # and automatically pauses execution when Worker C intercepts the state.
        final_runtime_output = await compiled_graph.ainvoke(
            state, 
            config=config
        )
        
        # Return the final evaluation state dictionary back over the network to the .NET gateway
        return final_runtime_output

    except Exception as graph_ex:
        print(f"❌ [HARNESS ROUTER ERROR] Multi-agent execution loop failed: {graph_ex}")
        raise HTTPException(
            status_code=500,
            detail=f"[INTERNAL ENGINE FAULT]: LangGraph thread orchestration execution failure: {graph_ex}"
        )

@router.post("/submit-human-approval", status_code=status.HTTP_200_OK)
async def resume_paused_graph_thread(signal: HumanApprovalSignal):
    """
    Asynchronous downstream callback gate unfreezing thread graphs locked in a 
    'Paused_Pending_Approval' checkpoint state.
    """
    config = {"configurable": {"thread_id": str(signal.thread_id)}}
    existing_snapshot = await PostgresGraphCheckpointer.get_tuple(config)
    
    if not existing_snapshot:
        raise HTTPException(
            status_code=404, 
            detail=f"[HARNESS ERROR] No checkpoint thread history located for Thread ID: {signal.thread_id}"
        )
        
    state, metadata = existing_snapshot
    
    if state.execution_status != ExecutionStatusEnum.PAUSED_PENDING_APPROVAL:
        raise HTTPException(
            status_code=400,
            detail=f"[HARNESS ERROR] Thread state execution is not currently suspended in a pending authorization state. Status: {state.execution_status}"
        )

    if signal.approved:
        print(f"🟢 [HARNESS HIGHSIDE] Director authorized transaction request for thread context: {signal.thread_id}")
        state.execution_status = ExecutionStatusEnum.ACTIVE
        state.raw_input_prompt = "[SYSTEM GATEWAY UPDATE]: Human approval granted. Commit pending transactions atomically."
        
        # Advance the graph routing pipeline atomically
        active_node = "Human_Approval_Gate_Resume"
    else:
        print(f"🔴 [HARNESS HIGHSIDE] Director rejected action request for thread context: {signal.thread_id}")
        state.execution_status = ExecutionStatusEnum.COMPLETED
        state.active_agent_response = f"[TASK TERMINATED]: Request rejected by venue director. Reason: {signal.rejection_notes}"
        active_node = "Human_Approval_Gate_Rejection"
        
    # Serialize state progress cleanly into database snapshot rows
    await PostgresGraphCheckpointer.put(config, state, active_node=active_node)
    return state.model_dump()
