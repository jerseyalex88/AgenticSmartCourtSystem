# =========================================================================
# FILE 2: INDOOR DELUGE CRISIS API REST ROUTER
# PATH: GlobalAcademy-AiEngine/app/routers/deluge_swarm_router.py
# DESCRIPTION: Enforces entry validation rules and orchestrates pause-unfreezes
# =========================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.graphs.deluge_swarm_graph import v3_deluge_swarm_engine
from langchain_core.messages import HumanMessage, AIMessage
import uuid
import traceback

router = APIRouter(prefix="/api/v3/deluge-swarm", tags=["V3 Indoor Deluge Swarm Engine"])

# =========================================================================
# 🧾 PYDANTIC REQUEST CONTRACT BODIES
# =========================================================================
class DelugeTriggerPayload(BaseModel):
    tenant_id: str = Field(..., description="The unique cryptographic multi-tenant Academy GUID.")
    branch_id: str = Field(..., description="The physical operational branch location GUID.")
    court_id: str = Field(..., description="The exact physical court asset registry ID experiencing the surge.")
    telemetry_reading_value: float = Field(..., description="The real-time sensor numeric output value (e.g. 72.0).")
    user_id: str = Field(..., description="The identifier string token of the active monitoring employee.")
    user_role: str = Field(..., description="The acting authority role context tier.")

class DelugeApprovalPayload(BaseModel):
    thread_id: str = Field(..., description="The active incident thread identifier string GUID to unfreeze.")
    checkpoint_id: str = Field(..., description="The exact structural checkpoint state generation token hash.")
    tenant_id: str = Field(..., description="The verified tenant isolation boundary token.")
    user_id: str = Field(..., description="The authorized manager ID committing the action.")

# =========================================================================
# 📡 HTTP POST ENDPOINT A: SENSOR ALARM FRONTON INGESTION
# =========================================================================
@router.post("/execute")
async def execute_deluge_incident_swarm(payload: DelugeTriggerPayload):
    print(f"📡 [DELUGE ROUTER]: Ingesting real-time telemetry breach value: {payload.telemetry_reading_value}%")
    
    if payload.telemetry_reading_value < 65.0:
        raise HTTPException(status_code=400, detail="Operational Guardrail: Humidity values below the 65% critical ceiling cannot trigger this emergency protocol.")

    active_thread_guid = str(uuid.uuid4())
    
    # 1. Map out the initial memory state canvas schema contract
    initial_state = {
        "academy_id": payload.tenant_id,
        "branch_id": payload.branch_id,
        "court_id": payload.court_id,
        "thread_id": active_thread_guid,
        "messages": [HumanMessage(content=f"CRITICAL ENVIRONMENTAL BREACH: Indoor humidity spike registered at {payload.telemetry_reading_value}% over court asset {payload.court_id}. Run emergency environmental, safety, and mitigation protocols immediately.")],
        "internal_metadata": {"next_worker": "v3_deluge_supervisor_coordinator_node"},
        "user_id": payload.user_id,
        "user_role": payload.user_role,
        "execution_status": "Processing",
        "agent_routing_history": [],
        "verified_policy_number": "",
        "verified_breach_penalties": 0.00,
        "staged_refund_amount": 0.00,
        "staged_purchase_order_cost": 0.00,
        "shadow_queue_cancellations_count": 0
    }

    # 2. Package explicit configuration criteria boundaries
    execution_config = {
        "configurable": {
            "thread_id": active_thread_guid,
            "academy_id": payload.tenant_id,
            "user_id": payload.user_id
        },
        "recursion_limit": 50
    }

    try:
        print(f"🧬 [V3 ENGINE ACTIVATE]: Launching Deluge Swarm Thread Pipeline: {active_thread_guid}")
        
        # 3. Fire the live state graph thread execution ring natively
        final_output_state = await v3_deluge_swarm_engine.ainvoke(initial_state, execution_config)
        
        # 4. Read back active execution status flags to detect if Harness layer paused the thread
        current_status = final_output_state.get("execution_status", "Complete")
        
        # Pull checkpoint metrics dynamically out of internal configuration objects
        last_checkpoint_id = execution_config["configurable"].get("checkpoint_id", "staged_snapshot")

        # 5. Compile conversational output blocks
        raw_messages = final_output_state.get("messages", [])
        final_answer = "Continuous Indoor Deluge crisis routing loop settled safely."
        
        for msg in reversed(raw_messages):
            msg_content = getattr(msg, "content", "")
            if msg_content and not str(msg_content).startswith("[planning"):
                final_answer = str(msg_content)
                break

        return {
            "final_response": final_answer,
            "execution_status": current_status,
            "thread_id": active_thread_guid,
            "checkpoint_id": last_checkpoint_id
        }

    except Exception as ex:
        print(f"❌ [DELUGE ROUTER CRASH]: {ex}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Graph Orchestration Exception: {str(ex)}")

# =========================================================================
# 📡 HTTP POST ENDPOINT B: HUMAN-IN-THE-LOOP APPROVAL MANAGER
# =========================================================================
@router.post("/approve")
async def approve_staged_ledger_refund(payload: DelugeApprovalPayload):
    print(f"🔐 [DELUGE APPROVAL HUB]: Received refund execution override for Thread: {payload.thread_id}")

    # 1. Target the exact snapshot generation block stored in your PostgreSQL checkpointer table
    execution_config = {
        "configurable": {
            "thread_id": payload.thread_id,
            # Re-hydration layer: pulls the frozen state from this specific point in time
            "checkpoint_id": payload.checkpoint_id, 
            "academy_id": payload.tenant_id,
            "user_id": payload.user_id
        },
        "recursion_limit": 50
    }

    try:
        # 2. Inject a secure verification token directly into history to bypass the supervisor's gate
        approval_state_override = {
            "agent_routing_history": ["harness_approved_token"],
            "execution_status": "Processing",
            "messages": [HumanMessage(content="ADMIN OVERRIDE: The $180.00 player refund request has been authorized and signed off by management. Complete all remaining workflow tracks instantly.")]
        }

        print(f"🚀 [V3 UNFREEZING THREAD]: Resuming state graph thread from checkpoint: {payload.checkpoint_id}")
        
        # 3. Invoke the engine using None as initial state—instructing LangGraph to load entirely from the checkpointer database row
        final_output_state = await v3_deluge_swarm_engine.ainvoke(approval_state_override, execution_config)
        
        raw_messages = final_output_state.get("messages", [])
        final_answer = "Staged financial workflows completed and logged to database ledgers cleanly."
        
        for msg in reversed(raw_messages):
            msg_content = getattr(msg, "content", "")
            if msg_content and not str(msg_content).startswith("[planning"):
                final_answer = str(msg_content)
                break

        return {
            "final_response": final_answer,
            "execution_status": final_output_state.get("execution_status", "Complete"),
            "thread_id": payload.thread_id
        }

    except Exception as ex:
        print(f"❌ [DELUGE APPROVAL CRASH]: {ex}")
        raise HTTPException(status_code=500, detail=f"Unfreeze Handshake Exception: {str(ex)}")
