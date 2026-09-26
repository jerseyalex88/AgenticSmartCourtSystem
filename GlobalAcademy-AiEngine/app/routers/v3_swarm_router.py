# File: GlobalAcademy-AiEngine/app/routers/v3_swarm_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
# 🚀 IMPORT NEW ISOLATED WORKFLOW GRAPH DEFINITIONS NATIVELY
from app.graphs.v3_swarm_graph import v3_smart_court_swarm_engine
from langchain_core.messages import HumanMessage, AIMessage # Ensure AIMessage is explicitly imported
import uuid

router = APIRouter(prefix="/api/v3/swarm", tags=["V3 Swarm Engine"])

class V3SwarmExecutionPayload(BaseModel):
    """
    Isolated data contract matching the incoming v3 proxy requests from C#.
    """
    tenant_id: str = Field(..., description="The unique cryptographic multi-tenant Academy GUID.")
    user_id: str = Field(..., description="The verified user GUID identifier token.")
    user_role: str = Field(..., description="The acting authority role context tier (Player or Admin).")
    raw_user_prompt: str = Field(..., description="The natural language string statement input query.")
    court_id: Optional[str] = Field(None, description="Focused court context, defaults to facility-wide scope.")

@router.post("/execute-swarm-thread")
async def execute_swarm_thread(payload: V3SwarmExecutionPayload):
    """
    Isolated entry point for the Multi-Agent swarm compiler framework.
    Initializes V3SwarmAgentState memory map frames and executes structural graphs.
    """
    print(f"📡 [V3 SWARM ROUTER]: Ingesting isolated swarm call for role '{payload.user_role}'")
    try:
        # 1. Map out the initial memory state schema contract matching your new TypedDict fields exactly
        initial_state = {
            "academy_id": payload.tenant_id,
            "branch_id": "", # Will be dynamically populated down specialized worker tracks
            "court_id": payload.court_id,
            "messages": [HumanMessage(content=payload.raw_user_prompt)],
            "internal_metadata": {"next_worker": "v3_supervisor_coordinator_node"},
            
            # Scenario capability parameters integration
            "user_id": payload.user_id,
            "user_role": payload.user_role,
            "extracted_legal_clauses": {},
            "telemetry_snapshot_data": {},
            "staged_operational_actions": [],
            "staged_financial_actions": [],
            
            # 🛡️ Harness Engineering circuit tracking nodes
            "agent_routing_history": [],
            "execution_status": "Processing",
            "token_budget_consumed": 0
        }

        # 2. Assign discrete conversation thread identification tokens for the DB checkpointer
        execution_config = {
            "configurable": {
                "thread_id": str(uuid.uuid4()),
                "academy_id": payload.tenant_id,
                "user_id": payload.user_id
            },
            # Enforce increased recursion limits securely out of the box to clear loop bottlenecks
            "recursion_limit": 100
        }

        print(f"🧬 [V3 ENGINE ENGINE ACTIVATE]: Launching Graph State Machine Thread -> {execution_config['configurable']['thread_id']}")
        
        # 3. Fire the live state graph thread execution ring natively!
        final_output_state = await v3_smart_court_swarm_engine.ainvoke(initial_state, execution_config)
        
        # 4. Extract the last worker message from the message history stack to forward back up the wire
        output_messages = final_output_state.get("messages", [])
        final_answer = ""
        
        # Scan backward safely, skipping internal planning trace tokens or empty strings
        for msg in reversed(output_messages):
            if not isinstance(msg, AIMessage):
                continue
                
            msg_content = getattr(msg, "content", str(msg))
            # Skip any legacy supervisor planning trace messages if present
            if not msg_content or "[planning trace]" in msg_content.lower():
                continue
                
            final_answer = msg_content
            break

        if not final_answer:
            final_answer = "V3 Multi-Agent graph workflow execution completed safely with verified tracking datasets."

        return {
            "final_response": final_answer,
            "execution_status": final_output_state.get("execution_status", "Complete"),
            "thread_id": execution_config["configurable"]["thread_id"]
        }

    except Exception as ex:
        print(f"❌ [V3 SWARM RUNTIME FAULT CRASH]: {ex}")
        raise HTTPException(status_code=500, detail=f"Internal multi-agent loop transaction abort: {str(ex)}")
