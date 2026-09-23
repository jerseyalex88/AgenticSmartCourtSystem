# File: GlobalAcademy-AiEngine/app/routers/v2_agent_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.graphs.v2_agent_orchestrator import smart_court_agent_engine
from langchain_core.messages import HumanMessage
import uuid

router = APIRouter(prefix="/api/v2/agent", tags=["Multi-Agent Mesh Engine"])

class SwarmExecutionPayload(BaseModel):
    """
    Strongly-typed inbound payload data contract matching the incoming 
    C# .NET Core proxy request signatures.
    """
    tenant_id: str = Field(..., description="The cryptographically verified multi-tenant Academy GUID.")
    user_id: str = Field(..., description="The unique acting user GUID.")
    user_role: str = Field(..., description="The user authority role tier (Player, AcademyDirector).")
    raw_user_prompt: str = Field(..., description="The raw natural language query text string.")
    court_id: Optional[str] = Field(None, description="The optional court GUID context anchor.")

@router.post("/execute-swarm-thread")
async def execute_swarm_thread(payload: SwarmExecutionPayload):
    """
    Receives incoming conversational prompts from the C# .NET proxy bridge, 
    initializes the SmartCourtAgentState memory structure, and runs the LangGraph 
    State Machine orchestrator.
    """
    print(f"📡 [RECEIVE PROXY CALL]: Ingesting {payload.user_role} prompt for Academy: {payload.tenant_id}")
    
    try:
        # 1. Compile the initial shared state schema bag matching your native TypedDict structure
        initial_state = {
            "academy_id": payload.tenant_id,
            "branch_id": "", # Dynamically populated down the worker node rows if needed
            "court_id": payload.court_id,
            "messages": [HumanMessage(content=payload.raw_user_prompt)],
            "internal_metadata": {"next_worker": "supervisor_coordinator_node"},
            
            # Scenario and Harness variables integration
            "user_id": payload.user_id,
            "user_role": payload.user_role,
            "extracted_legal_clauses": {},
            "telemetry_snapshot_data": {},
            "staged_operational_actions": [],
            "staged_financial_actions": [],
            "agent_routing_history": [],
            "execution_status": "Processing",
            "token_budget_consumed": 0
        }

        # 2. Assign a unique conversational thread configuration key for the database checkpointer
        execution_config = {
            "configurable": {
                "thread_id": str(uuid.uuid4()),
                "academy_id": payload.tenant_id,
                "user_id": payload.user_id
            }
        }

        print(f"🧬 [GRAPH MASTER LAUNCH]: Initializing LangGraph Swarm engine thread -> {execution_config['configurable']['thread_id']}")
        
        # 3. Fire the live state graph thread execution ring natively!
        final_output_state = await smart_court_agent_engine.ainvoke(initial_state, execution_config)
        
        # 4. Extract the last AI message from the message history stack to forward back up the wire
        output_messages = final_output_state.get("messages", [])
        final_answer = "Operation completed inside the multi-agent graph mesh with clear data states."
        
        if output_messages:
            final_answer = output_messages[-1].content

        # Pack the compiled data metrics alongside the text and return straight back to .NET
        return {
            "final_response": final_answer,
            "execution_status": final_output_state.get("execution_status", "Complete"),
            "thread_id": execution_config["configurable"]["thread_id"]
        }

    except Exception as ex:
        print(f"❌ [SWARM EXECUTION ENGINE CRASH]: {ex}")
        raise HTTPException(status_code=500, detail=f"Internal multi-agent loop transaction abort: {str(ex)}")
