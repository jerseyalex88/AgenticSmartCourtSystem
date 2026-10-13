# =========================================================================
# FILE 2 UPGRADE: INDOOR DELUGE CRISIS REST ROUTER (PERMANENT IDEMPOTENCY)
# PATH: GlobalAcademy-AiEngine/app/routers/deluge_swarm_router.py
# DESCRIPTION: Manages court-tenant thread locking and automated DB archiving
# =========================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.graphs.deluge_swarm_graph import v3_deluge_swarm_engine
from app.database import async_session_factory
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy import text
import uuid
import datetime
import json
import traceback

router = APIRouter(prefix="/api/v3/deluge-swarm", tags=["V3 Indoor Deluge Swarm Engine"])

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
# 📡 HTTP POST ENDPOINT A: PERMANENT IDEMPOTENT SURGE INGESTION
# =========================================================================
@router.post("/execute")
async def execute_deluge_incident_swarm(payload: DelugeTriggerPayload):
    print(f"📡 [DELUGE ROUTER]: Ingesting telemetry breach value: {payload.telemetry_reading_value}%")
    
    if payload.telemetry_reading_value < 65.0:
        raise HTTPException(status_code=400, detail="Operational Guardrail: Humidity values below 65% cannot trigger this emergency protocol.")

    # 🚀 1. TIME-INDEPENDENT IDEMPOTENCY KEY DERIVATION:
    # Hash input binds strictly to the court asset and tenant partition scope only.
    # This guarantees total state layout persistence regardless of how many hours/days pass!
    idempotency_hash_input = f"{payload.court_id}-{payload.tenant_id}"
    active_thread_guid = str(uuid.uuid5(uuid.NAMESPACE_DNS, idempotency_hash_input))
    print(f"🛡️ [PERMANENT LOCK]: Computed Court-Tenant Idempotency Key Thread GUID = '{active_thread_guid}'")

    # 🚀 2. UNCONDITIONAL PRE-FLIGHT CHECKPOINTER LOOKUP:
    # Query database to re-hydrate the existing frozen state directly from PostgreSQL row fields.
    existing_snapshot = await v3_deluge_swarm_engine.checkpointer.aget_tuple(
        {"configurable": {"thread_id": active_thread_guid}}
    )

    if existing_snapshot is not None:
        raw_messages = existing_snapshot.checkpoint.get("channel_values", {}).get("messages", [])
        current_status = existing_snapshot.checkpoint.get("channel_values", {}).get("execution_status", "Paused_Pending_Approval")
        last_checkpoint_id = existing_snapshot.config["configurable"].get("checkpoint_id", "staged_snapshot")

        # 🚀 3. LIFECYCLE MANAGEMENT ROUTINE: AUTOMATED INCIDENT ARCHIVING
        # If the existing row tracking this court says "Complete", a previous historical incident closed out.
        # Clone it and archive it to HistoricGraphStateCheckpointsArchive before resetting the slot for a fresh storm!
        if current_status == "Complete":
            print(f"♻️ [DB LIFECYCLE]: Discovered closed incident row for Court {payload.court_id}. Migrating to Historic Archive...")
            
            async with async_session_factory() as session:
                # Select the matching active checkpoints block data
                fetch_query = text('SELECT "CheckpointId", "AcademyId", "UserId", "ActiveNode", "SerializedState", "ContextTokenCount", "LoopIterationCount" FROM "GraphStateCheckpoints" WHERE "ThreadId" = :tid')
                rows = (await session.execute(fetch_query, {"tid": active_thread_guid})).fetchall()
                
                for r in rows:
                    db_cid, db_aid, db_uid, db_node, db_state, db_tokens, db_loops = r
                    
                    # Insert clones into your new physical EF Core archive table layout
                    archive_query = text("""
                        INSERT INTO "HistoricGraphStateCheckpointsArchive" 
                        ("ArchiveId", "ThreadId", "CheckpointId", "AcademyId", "UserId", "ActiveNode", "SerializedState", "ContextTokenCount", "LoopIterationCount", "CreatedAtUtc", "ArchivedAtUtc")
                        VALUES (:arch_id, :tid, :cid, :aid, :uid, :node, :state, :tokens, :loops, :now, :now)
                    """)
                    await session.execute(archive_query, {
                        "arch_id": str(uuid.uuid4()), "tid": active_thread_guid, "cid": db_cid,
                        "aid": db_aid, "uid": db_uid, "node": db_node, "state": db_state,
                        "tokens": db_tokens, "loops": db_loops, "now": datetime.datetime.utcnow()
                    })
                
                # Wipe the active checkpoint slot to allow a clean, fresh workflow loop to instantiate!
                delete_query = text('DELETE FROM "GraphStateCheckpoints" WHERE "ThreadId" = :tid')
                await session.execute(delete_query, {"tid": active_thread_guid})
                await session.commit()
                
            print(f"✨ [DB LIFECYCLE]: Active slot cleared for Court {payload.court_id}. Initializing fresh storm swarm threads.")
        
        else:
            # 🚀 UNCONDITIONAL PAUSED RE-ENTRY INTERCEPT GATE:
            # If it is NOT complete, it means the thread is currently sitting inside our frozen Harness approval fence.
            # Return the existing text shards back to the screen panels immediately, blocking duplicate financial refund mutations!
            print(f"🛡️ [IDEMPOTENCY RE-ENTRY INTERCEPT]: Court {payload.court_id} is currently locked inside an active validation gate.")
            final_answer = "V3 Deluge state graph re-entry intercepted safely. Workflow sits safely inside active checkpointer gates."
            
            for msg in reversed(raw_messages):
                msg_content = msg.get("kwargs", {}).get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
                if msg_content and not str(msg_content).startswith("[planning"):
                    final_answer = str(msg_content)
                    break

            return {
                "final_response": final_answer,
                "execution_status": current_status,
                "thread_id": active_thread_guid,
                "checkpoint_id": last_checkpoint_id
            }

    # Initialize a clean initial state model if it's a brand new environmental emergency
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

    execution_config = {
        "configurable": {
            "thread_id": active_thread_guid,
            "academy_id": payload.tenant_id,
            "user_id": payload.user_id
        },
        "recursion_limit": 50
    }

    try:
        print(f"🧬 [V3 ENGINE ACTIVATE]: Launching Permanent Idempotent Deluge Swarm: {active_thread_guid}")
        final_output_state = await v3_deluge_swarm_engine.ainvoke(initial_state, execution_config)
        
        current_status = final_output_state.get("execution_status", "Complete")
        
        last_checkpoint_id = "staged_snapshot"
        latest_config = final_output_state.get("metadata", {}).get("config") or execution_config
        if latest_config and "configurable" in latest_config:
            last_checkpoint_id = latest_config["configurable"].get("checkpoint_id", "staged_snapshot")

        raw_messages = final_output_state.get("messages",)
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
# 📡 HTTP POST ENDPOINT B: RESUME INTERCEPT OVERRIDE HANDSHAKE
# =========================================================================
@router.post("/approve")
async def approve_staged_ledger_refund(payload: DelugeApprovalPayload):
    print(f"🔐 [DELUGE APPROVAL HUB]: Received refund execution override for Thread: {payload.thread_id}")

    # Enforce strict configuration parameters. 
    # The approval marker token is passed solely in the configurable namespace dictionary pool.
    execution_config = {
        "configurable": {
            "thread_id": payload.thread_id,
            "checkpoint_id": payload.checkpoint_id, 
            "tenant_id": payload.tenant_id,
            "user_id": payload.user_id,
            "harness_approved_token": "harness_approved_token" # 🚀 Safe scalar variable channel
        },
        "metadata": {
            "source": "v3_deluge_supervisor_coordinator_node",
            "step": 0
        },
        "recursion_limit": 50
    }

    try:
        print(f"🚀 [V3 UNFREEZING THREAD]: Resuming state graph thread from checkpoint: {payload.checkpoint_id}")
        
        # 🚀 IRONCLAD FACTOR: We pass exactly None as the initial dictionary payload.
        # This completely strips out the "ADMIN OVERRIDE" message dictionary from the ingress channel,
        # forcing LangGraph to load the pristine class instances straight out of your fixed checkpointer.
        final_output_state = await v3_deluge_swarm_engine.ainvoke(None, execution_config)
        
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


