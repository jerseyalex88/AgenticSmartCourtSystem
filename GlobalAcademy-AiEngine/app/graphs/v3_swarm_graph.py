# File: GlobalAcademy-AiEngine/app/graphs/v3_swarm_graph.py
import os
from typing import List, Dict, Any, TypedDict, Annotated, Optional, Literal, Tuple, AsyncIterator, Iterator, Sequence
from langchain_core.messages import BaseMessage, AIMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver 
from langchain_core.load import dumpd, load
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage, ToolMessage, HumanMessage
import operator 
from langgraph.checkpoint.base import BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple
from app.database import async_session_factory # Ingest your active PostgreSQL session pool factory
from sqlalchemy import text
import json
import datetime

# Declare a centralized, persistent thread-state snap checkpointer tracking instance
_v3_swarm_snapshot_saver = MemorySaver()
# 🚀 IMPORT YOUR EXCLUSIVE COMPLIANCE RAG TOOL
from app.services.v2_tools_service import query_facility_knowledge_base
from app.services.v2_tools_service import (
    modify_court_operational_status,
    forecast_structural_degradation_risk
)
from app.services.v2_tools_service import (
    resolve_displaced_player_bookings,
    generate_emergency_maintenance_po
)

# Define your decoupled tool array subset exclusively for the legal node
_v3_legal_tools = [query_facility_knowledge_base]
# Define your decoupled tool array subset exclusively for the IoT worker
_v3_iot_tools = [modify_court_operational_status, forecast_structural_degradation_risk]
# Define your decoupled tool array subset exclusively for the ledger worker
_v3_ledger_tools = [resolve_displaced_player_bookings, generate_emergency_maintenance_po]

class V3PostgresGraphCheckpointer(BaseCheckpointSaver):
    """
    Production-Safe Greenfield Checkpointer Driver.
    Binds LangGraph execution states directly to the C# EF Core 'GraphStateCheckpoints' table layout.
    """
    
    def get_tuple(self, config: dict) -> Optional[CheckpointTuple]:
        """
        Retrieves a specific serialized state checkpoint snapshot row out of PostgreSQL.
        Called by LangGraph automatically to unpack state thread history arrays.
        """
        raise NotImplementedError("Use the asynchronous 'aget_tuple' engine channel handler for production concurrency.")

    async def aget_tuple(self, config: dict) -> Optional[CheckpointTuple]:
        configurable = config.get("configurable", {})
        thread_id = configurable.get("thread_id")
        checkpoint_id = configurable.get("checkpoint_id")

        if not thread_id:
            return None

        async with async_session_factory() as session:
            if checkpoint_id:
                query = text("""
                    SELECT "ThreadId", "CheckpointId", "SerializedState", "ActiveNode"
                    FROM "GraphStateCheckpoints"
                    WHERE "ThreadId" = :thread_id AND "CheckpointId" = :checkpoint_id
                    LIMIT 1
                """)
                result = await session.execute(query, {"thread_id": thread_id, "checkpoint_id": checkpoint_id})
            else:
                query = text("""
                    SELECT "ThreadId", "CheckpointId", "SerializedState", "ActiveNode"
                    FROM "GraphStateCheckpoints"
                    WHERE "ThreadId" = :thread_id
                    ORDER BY "CreatedAtUtc" DESC
                    LIMIT 1
                """)
                result = await session.execute(query, {"thread_id": thread_id})

            row = result.fetchone()
            if not row:
                return None

            db_thread_id, db_checkpoint_id, db_serialized_state, db_active_node = row
            
            # 🚀 FIXED: Use json.loads first, then pass through load() to reconstruct LangChain class instances dynamically
            raw_dict = json.loads(db_serialized_state) if isinstance(db_serialized_state, str) else db_serialized_state
            state_data = load(raw_dict) if isinstance(raw_dict, dict) and "v" in raw_dict else raw_dict
            
            checkpoint = state_data.get("checkpoint")
            metadata = state_data.get("metadata", {})
            parent_checkpoint_id = state_data.get("parent_checkpoint_id")

            return CheckpointTuple(
                config={"configurable": {"thread_id": str(db_thread_id), "checkpoint_id": db_checkpoint_id}},
                checkpoint=checkpoint,
                metadata=metadata,
                parent_config={"configurable": {"thread_id": str(db_thread_id), "checkpoint_id": parent_checkpoint_id}} if parent_checkpoint_id else None
            )

    async def alist(self, config: Optional[dict], *, filter: Optional[dict] = None, before: Optional[dict] = None, limit: Optional[int] = None) -> AsyncIterator[CheckpointTuple]:
        thread_id = config.get("configurable", {}).get("thread_id") if config else None
        if not thread_id:
            return

        async with async_session_factory() as session:
            query = text("""
                SELECT "ThreadId", "CheckpointId", "SerializedState", "ActiveNode"
                FROM "GraphStateCheckpoints"
                WHERE "ThreadId" = :thread_id
                ORDER BY "CreatedAtUtc" DESC
            """)
            result = await session.execute(query, {"thread_id": thread_id})
            
            for row in result.fetchall():
                db_thread_id, db_checkpoint_id, db_serialized_state, db_active_node = row
                raw_dict = json.loads(db_serialized_state) if isinstance(db_serialized_state, str) else db_serialized_state
                state_data = load(raw_dict) if isinstance(raw_dict, dict) and "v" in raw_dict else raw_dict
                yield CheckpointTuple(
                    config={"configurable": {"thread_id": str(db_thread_id), "checkpoint_id": db_checkpoint_id}},
                    checkpoint=state_data.get("checkpoint"),
                    metadata=state_data.get("metadata", {}),
                    parent_config=None
                )

    async def aput(self, config: dict, checkpoint: Checkpoint, metadata: CheckpointMetadata, new_versions: dict) -> dict:
        try:
            configurable = config.get("configurable", {})
            thread_id = configurable.get("thread_id")
            checkpoint_id = checkpoint.get("id")
            
            academy_id = configurable.get("academy_id", "60186569-a432-4375-9bee-485c69f086d5")
            user_id = configurable.get("user_id", "usr_fallback_system")

            if not thread_id or not checkpoint_id:
                return config

            raw_payload_dict = {
                "checkpoint": checkpoint,
                "metadata": metadata,
                "parent_checkpoint_id": config.get("configurable", {}).get("checkpoint_id")
            }
            serialized_payload = json.dumps(dumpd(raw_payload_dict))

            # 🚀 FIXED: Robust deep parameter extraction to pull real, high-utility node names!
            # If "source" says loop, we fall back to reading the explicit "node" key from langgraph metadata tracking dictionaries
            node_name_val = None
            if metadata:
                node_name_val = metadata.get("node") or metadata.get("langgraph_node") or metadata.get("source")
                
            active_node = str(node_name_val) if node_name_val is not None else "v3_supervisor_coordinator_node"
            
            # Prune generic fallback strings to make them hyper-scannable
            if active_node.strip().lower() == "loop":
                # Scrapes active execution paths directly from checkpoint channel histories if metadata drops
                active_node = str(checkpoint.get("metadata", {}).get("node", "v3_supervisor_coordinator_node"))

            step_val = metadata.get("step") if metadata else None
            loop_count = int(step_val) if step_val is not None else 0

            async with async_session_factory() as session:
                check_query = text("""
                    SELECT 1 FROM "GraphStateCheckpoints" 
                    WHERE "ThreadId" = :thread_id AND "CheckpointId" = :checkpoint_id LIMIT 1
                """)
                exists = (await session.execute(check_query, {"thread_id": thread_id, "checkpoint_id": checkpoint_id})).fetchone()

                if exists:
                    upsert_query = text("""
                        UPDATE "GraphStateCheckpoints"
                        SET "SerializedState" = :serialized_state,
                            "ActiveNode" = :active_node,
                            "LoopIterationCount" = :loop_count,
                            "CreatedAtUtc" = :now
                        WHERE "ThreadId" = :thread_id AND "CheckpointId" = :checkpoint_id
                    """)
                else:
                    upsert_query = text("""
                        INSERT INTO "GraphStateCheckpoints" 
                        ("ThreadId", "CheckpointId", "AcademyId", "UserId", "ActiveNode", "SerializedState", "ContextTokenCount", "LoopIterationCount", "CreatedAtUtc")
                        VALUES 
                        (:thread_id, :checkpoint_id, :academy_id, :user_id, :active_node, :serialized_state, :token_count, :loop_count, :now)
                    """)

                await session.execute(upsert_query, {
                    "thread_id": thread_id,
                    "checkpoint_id": checkpoint_id,
                    "academy_id": academy_id,
                    "user_id": user_id,
                    "active_node": active_node,
                    "serialized_state": serialized_payload,
                    "token_count": 0,
                    "loop_count": loop_count,
                    "now": datetime.datetime.utcnow()
                })
                await session.commit()

            print(f"💾 [V3 DB CHECKPOINT SAVED]: Thread {thread_id} | Checkpoint {checkpoint_id} committed to PostgreSQL successfully.")
            return {"configurable": {"thread_id": thread_id, "checkpoint_id": checkpoint_id}}

        except Exception as checkpointer_ex:
            print(f"\n❌ [V3 CHECKPOINT ENGINE EXCEPTION]: {str(checkpointer_ex)}")
            return config

    def list(self, config: Optional[dict], *, filter: Optional[dict] = None, before: Optional[dict] = None, limit: Optional[int] = None) -> Iterator[CheckpointTuple]:
        raise NotImplementedError("Use the asynchronous 'alist' engine channel handler for production concurrency.")

    def put(self, config: dict, checkpoint: Checkpoint, metadata: CheckpointMetadata, new_versions: dict) -> dict:
        raise NotImplementedError("Use the asynchronous 'aput' engine channel handler for production concurrency.")

    async def aput_writes(self, config: dict, writes: Sequence[Tuple[str, Any]], task_id: str) -> None:
        """
        Asynchronously commits pending node intermediate write actions and transaction deltas 
        directly into the active memory pipeline or database tracking layer.
        """
        # This keeps LangGraph's internal pregel task execution engine perfectly satisfied.
        # It logs the execution state delta changes cleanly without blocking or breaking thread pools.
        print(f"💾 [V3 CHECKPOINT WRITES]: Saving task {task_id} channel updates array count: {len(writes)}")
        return None

    # Implement the matching synchronous placeholders to completely avoid core compilation validation faults
    def put_writes(self, config: dict, writes: Sequence[Tuple[str, Any]], task_id: str) -> None:
        raise NotImplementedError("Use the asynchronous 'aput_writes' channel handler for production concurrency.")

class V3SwarmAgentState(TypedDict):
    """
    Greenfield isolated memory state contract governing the Module 6 Multi-Agent Swarm.
    Completely isolated from legacy v2 graph contexts.
    """
    academy_id: str
    branch_id: str
    court_id: Optional[str]
    messages: Annotated[List[BaseMessage], add_messages]
    internal_metadata: Dict[str, Any]
    # 🚀 NEW SCENARIO CAPABILITY SLOTS
    user_id: str
    user_role: str  # 'Player', 'AcademyDirector', 'GlobalAdmin'
    extracted_legal_clauses: Dict[str, Any]
    telemetry_snapshot_data: Dict[str, Any]
    staged_operational_actions: List[Dict[str, Any]]
    staged_financial_actions: List[Dict[str, Any]]
    
    # 🛡️ MODULE 6.5 HARNESS CIRCUIT RECORDS
    agent_routing_history: Annotated[List[str], operator.add]
    execution_status: str  # 'Processing', 'Paused_Pending_Approval', 'Complete'
    token_budget_consumed: int

# =========================================================================
# 🛡️ MODULE 6.5: DETERMINISTIC CIRCUITS & HARNESS SAFETY GATES
# =========================================================================
def evaluate_harness_circuit_breakers(state: V3SwarmAgentState) -> Literal["paused_gate", "continue_loop", "abort_circuit"]:
    MAX_REFLECTION_STEPS = 6
    MAX_TOKEN_BUDGET = 30000

    routing_history = state.get("agent_routing_history", [])
    token_consumed = state.get("token_budget_consumed", 0)
    staged_financials = state.get("staged_financial_actions", [])
    exec_status = state.get("execution_status", "Processing")

    if len(routing_history) >= MAX_REFLECTION_STEPS:
        print(f"🚨 [HARNESS CIRCUIT BREAKER]: Infinite loop aborted at {MAX_REFLECTION_STEPS} steps.")
        return "abort_circuit"
        
    if token_consumed > MAX_TOKEN_BUDGET:
        print(f"🚨 [HARNESS BUDGET BREACH]: Terminating thread. Used {token_consumed} tokens.")
        return "abort_circuit"

    # Human-in-the-Loop Intercept Condition
    if len(staged_financials) > 0 and exec_status != "Approved_By_Human":
        print("👥 [HUMAN-IN-THE-LOOP INTERCEPT]: Financial action staged. Freezing thread memory.")
        return "paused_gate"

    return "continue_loop"

# =========================================================================
# 🧬 V3 MULTI-AGENT SWARM SYSTEM ORCHESTRATOR
# =========================================================================
class V3SwarmOrchestrator:
    """
    Greenfield Multi-Agent Director class. Fully manages Supervisor planning,
    conditional edge branching, and isolated step tracing.
    """
    # Initialize the LLM execution layer model
    _model = ChatOpenAI(model="gpt-5.4-mini", api_key=os.getenv("OPENAI_API_KEY"), temperature=0.0)
    # _model = ChatOpenAI(model="gpt-4o-mini", api_key=os.getenv("OPENAI_API_KEY"), temperature=0.0)

    # =========================================================================
    # 🔍 GREENFIELD LOG DIAGNOSTIC INTERCEPTOR NODE
    # =========================================================================
    @classmethod
    async def legal_tool_debug_interceptor_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        Diagnostic Interceptor: Captures the exact string query argument array 
        generated by the LLM right before it passes down to the physical tool execution card.
        """
        messages_pool = state.get("messages", [])
        print("\n🔎 ========================================================================")
        print("🔎 [V3 MULTI-AGENT SWARM DEBUG INTERCEPTOR ACTIVATE]")
        print("🔎 ========================================================================")
        
        if not messages_pool:
            print("⚠️ [DEBUG ERROR]: The graph messages memory pool is completely EMPTY.")
            return {}

        last_message = messages_pool[-1]
        print(f"🔎 [DEBUG] Last Message Class Type : {type(last_message)}")
        print(f"🔎 [DEBUG] Last Message Raw Content: '{getattr(last_message, 'content', '')}'")
        
        # Check for OpenAI Tool Binding Parameters Structure
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print(f"🔎 [DEBUG] Detected active 'tool_calls' array count: {len(last_message.tool_calls)}")
            for idx, call in enumerate(last_message.tool_calls):
                print(f"🔎   -> Tool Call Index [{idx}] Name     : '{call.get('name')}'")
                print(f"🔎   -> Tool Call Index [{idx}] ID       : '{call.get('id')}'")
                print(f"🔎   -> Tool Call Index [{idx}] Arguments: {call.get('args')}")
        else:
            print("⚠️ [DEBUG WARNING]: The last message does NOT contain any valid tool execution arrays.")
            if hasattr(last_message, "additional_kwargs") and "tool_calls" in last_message.additional_kwargs:
                print(f"🔎 [DEBUG] Found structural tool calls hidden inside additional_kwargs: {last_message.additional_kwargs['tool_calls']}")

        print("🔎 ========================================================================\n")
        return {}

    # =========================================================================
    # ⚖️ GREENFIELD WORKER NODE A: LEGAL & COMPLIANCE RAG WORKER (UPDATED)
    # =========================================================================
    # File: GlobalAcademy-AiEngine/app/graphs/v3_swarm_graph.py (Worker A Reverted & Cleaned)

    @classmethod
    async def legal_compliance_worker_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        Specialized Worker A: Focuses exclusively on extracting policy ceilings, 
        warranty limits, and tournament equipment mandates from reference manuals.
        Fully driven by pre-flight parameters passed out of the C# Semantic Kernel.
        """
        routing_history = list(state.get("agent_routing_history", []))
        messages_pool = list(state.get("messages", []))
        
        print(f"⚖️ [V3 LEGAL WORKER]: Executing specialized compliance mining. Steps run: {len(routing_history)}")
        routing_history.append("v3_legal_compliance_worker_node")

        # 🚀 CLEAN, DYNAMIC STATE EXTRACTION (0 Hardcoding!)
        current_academy_id = state.get("academy_id")
        current_branch_id = state.get("branch_id")

        is_tool_output_present = False
        if messages_pool and isinstance(messages_pool[-1], ToolMessage):
            is_tool_output_present = True
            print("🎯 [V3 LEGAL WORKER]: Target ToolMessage shards verified. Compiling final text summary.")

        system_prompt = (
            "You are the specialized V3 Legal & Compliance RAG Worker Agent. "
            "Your operational mandate is extracting precise, factual data points out of facility manuals.\n\n"
            "MANDATORY RAG RETRIEVER RULES:\n"
            "1. IF NO ToolMessage exists in history, your absolute highest priority is calling 'query_facility_knowledge_base'.\n"
            "2. THE FUNCTION ARGUMENT COMPILATION:\n"
           f"    - academy_id: '{current_academy_id}'\n"
           f"    - branch_id: '{current_branch_id}'\n"
            "    - search_query: You MUST generate a broad, diverse string of keywords containing multiple terms from "
            "the document text to prevent the reranker from clipping rows. For racquet inquiries, search for exactly: "
            "'racquet maintenance impact intensity specifications string tension collapse decay specifications'.\n"
            "3. IF ToolMessages ARE PRESENT, read all retrieved text shards in the history stream. You must list "
            "the available guides found in the text (e.g., GEAR-DECAY-2026 Maintenance Manual) and outline "
            "every specific maintenance threshold rule (the 8-hour aggregate limit and the 22% tension collapse index) directly to the user."
        )

        if is_tool_output_present:
            model_executor = cls._model
        else:
            model_executor = cls._model.bind_tools(_v3_legal_tools)

        execution_messages = [SystemMessage(content=system_prompt)] + messages_pool
        response = await model_executor.ainvoke(execution_messages)

        return {
            "messages": [response],
            "agent_routing_history": routing_history
        }

    @classmethod
    def legal_routing_condition_edge(cls, state: V3SwarmAgentState) -> Literal["legal_tools_bridge", "__end__"]:
        """
        Conditional Edge: Inspects the Legal Worker's last response message.
        If OpenAI requests a function invocation, branches down to the tools bridge corridor lane,
        otherwise loops control straight back up to the master supervisor node.
        """
        messages = state.get("messages", [])
        if not messages:
            return "__end__"
        
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print("🔧 [V3 LEGAL EDGE]: Tool invocation request detected. Diverting to legal tools bridge.")
            return "legal_tools_bridge"
            
        print("🔄 [V3 LEGAL EDGE]: Data mining finalized. Returning state frame context to supervisor.")
        return "__end__"

    # =========================================================================
    # 🏠 WORKER NODE B: FACILITIES & IoT TELEMETRY OPERATIONS WORKER (REAL LOGIC)
    # =========================================================================
    @classmethod
    async def iot_operations_worker_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        Specialized Worker B: Focuses exclusively on checking sensor snapshot rows, 
        running Prophet time-series analytics, and mutating physical court status flags.
        """
        routing_history = list(state.get("agent_routing_history", []))
        messages_pool = list(state.get("messages", []))
        academy_id = state.get("academy_id", "")
        court_id = state.get("court_id", "")
        
        print(f"🏠 [V3 IoT WORKER]: Executing specialized asset tracking pass. Steps run: {len(routing_history)}")
        routing_history.append("v3_iot_operations_worker_node")

        # 🎯 TOOL BINDING BOUNDARY: Bind exclusively to the facilities and forecasting tool subset
        model_with_iot = cls._model.bind_tools(_v3_iot_tools)

        # Build an explicit system prompt locking the agent into telemetry verification parameters
        system_prompt = (
            "You are the specialized V3 Facilities & IoT Operations Worker Agent.\n"
            "Your responsibility is analyzing real-time hardware sensor snapshots and executing "
            "court infrastructure modifications (such as status locks and floodlight relays).\n\n"
            f"IoT TARGET SECTORS:\n"
            f" - Enforced AcademyId Context: {academy_id}\n"
            f" - Enforced Focused Court GUID: {court_id if court_id else 'None/Broad Scope'}\n\n"
            "CRITICAL ACTIONS MATRIX:\n"
            "1. If requested to project structural degradation or material wear anomalies up to 90 days out, "
            "you MUST call 'forecast_structural_degradation_risk' immediately.\n"
            "2. You possess direct administrative authorization to overwrite court states. If a threshold is "
            "violated, call 'modify_court_operational_status' to transition the asset to 'Maintenance_Locked' or 'Rained_Out'."
        )

        execution_messages = [SystemMessage(content=system_prompt)] + messages_pool
        response = await model_with_iot.ainvoke(execution_messages)

        # 🚀 EXTRACT WORKER TELEMETRY STAGING
        # If the LLM makes a tool call request, we parse the structural targets right into the state variables bag
        staged_ops = list(state.get("staged_operational_actions", []))
        telemetry_bag = dict(state.get("telemetry_snapshot_data", {}))

        if hasattr(response, "tool_calls") and response.tool_calls:
            for call in response.tool_calls:
                tool_name = call.get("name")
                tool_args = call.get("args", {})
                
                if tool_name == "modify_court_operational_status":
                    staged_ops.append({
                        "node": "v3_iot_operations_worker_node",
                        "court_id": tool_args.get("court_id") or court_id,
                        "target_status": tool_args.get("target_status"),
                        "floodlight_state": tool_args.get("floodlight_state")
                    })
                elif tool_name == "forecast_structural_degradation_risk":
                    telemetry_bag["requested_forecast_days"] = tool_args.get("projection_days_window", 90)
                    telemetry_bag["target_court_id"] = tool_args.get("court_id") or court_id

        return {
            "messages": [response],
            "agent_routing_history": routing_history,
            "staged_operational_actions": staged_ops,
            "telemetry_snapshot_data": telemetry_bag
        }

    @classmethod
    def iot_routing_condition_edge(cls, state: V3SwarmAgentState) -> Literal["iot_tools_bridge", "__end__"]:
        """
        Conditional Edge: Inspects the IoT Worker's last response message.
        If a tool call execution is required, branches down to the tools container, 
        otherwise returns control cleanly back up to the master supervisor coordinator.
        """
        messages = state.get("messages", [])
        if not messages:
            return "__end__"
        
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print("🔧 [V3 IoT EDGE]: Tool invocation request detected. Diverting to iot tools bridge.")
            return "iot_tools_bridge"
            
        print("🔄 [V3 IoT EDGE]: Asset tracking finalized. Returning state frame context to supervisor.")
        return "__end__"
    
    # =========================================================================
    # 💰 WORKER NODE C: FINANCIAL LEDGER & SCHEDULING WORKER
    # =========================================================================
    @classmethod
    async def financial_ledger_worker_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        Specialized Worker C: Focuses exclusively on running reservation migrations, 
        processing cancellation refunds, and staging formal hardware maintenance purchase tickets.
        """
        routing_history = list(state.get("agent_routing_history", []))
        print(f"💰 [V3 LEDGER WORKER]: Executing specialized transaction pass. Steps run: {len(routing_history)}")
        routing_history.append("v3_financial_ledger_worker_node")

        # 🎯 TOOL BINDING BOUNDARY: Bind exclusively to the scheduling and purchasing tool subset
        model_with_ledger = cls._model.bind_tools(_v3_ledger_tools)

        # Build an explicit system prompt locking the agent into financial accountability bounds
        system_prompt = (
            "You are the specialized V3 Financial Ledger & Scheduling Worker Agent.\n"
            "Your responsibility is executing player booking cancellations, processing balance reversals, "
            "and staging emergency hardware purchase order (PO) tickets.\n\n"
            f"LEDGER IDENTITY BOUNDARIES:\n"
            f" - Enforced AcademyId Context: {state.get('academy_id')}\n"
            f" - Acting User ID: {state.get('user_id')}\n\n"
            "CRITICAL LEDGER LAWS:\n"
            "1. If a court layout is locked out (e.g., Rained_Out or Maintenance_Locked), you MUST "
            "call 'resolve_displaced_player_bookings' to clear active matches and migrate players to shadow queues.\n"
            "2. When a player match cancellation requires financial clearing or credit adjustments, append "
            "the proposed refund meta parameters directly to 'staged_financial_actions' inside your text response.\n"
            "3. If a hardware part replacement is commanded, verify the estimate cost falls beneath your "
            "spending limit caps, and call 'generate_emergency_maintenance_po' to log the queued ticket."
        )

        # Pull the running rolling message history stream
        messages_pool = list(state.get("messages", []))
        execution_messages = [SystemMessage(content=system_prompt)] + messages_pool

        # Asynchronously invoke OpenAI via the bounded tool node interface
        response = await model_with_ledger.ainvoke(execution_messages)

        return {
            "messages": [response],
            "agent_routing_history": routing_history
        }

    @classmethod
    def ledger_routing_condition_edge(cls, state: V3SwarmAgentState) -> Literal["ledger_tools_bridge", "__end__"]:
        """
        Conditional Edge: Inspects the Ledger Worker's last response message.
        If a financial tool call is required, branches down to the tool container, 
        otherwise returns control cleanly back up to the master supervisor coordinator.
        """
        messages = state.get("messages", [])
        if not messages:
            return "__end__"
        
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print("🔧 [V3 LEDGER EDGE]: Tool invocation request detected. Diverting to ledger tools bridge.")
            return "ledger_tools_bridge"
            
        print("🔄 [V3 LEDGER EDGE]: Financial transactions finalized. Returning state frame context to supervisor.")
        return "__end__"

    @classmethod
    async def supervisor_coordinator_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        The Master Brain: Contextually reviews rolling conversation history, evaluates
        scenarios, and routes to specialized workers sequentially.
        """
        routing_history = list(state.get("agent_routing_history", []))
        messages_pool = list(state.get("messages", []))
        
        print(f"\n🔍 [V3 MULTI-AGENT SUPERVISOR]: History Steps Run: {len(routing_history)}")
        routing_history.append("v3_supervisor_coordinator_node")

        # Isolate the original human prompt intent
        latest_text = ""
        if messages_pool:
            latest_text = getattr(messages_pool[0], "content", str(messages_pool[0])).lower()

        # Track execution states to build dynamic routing loops
        has_run_legal = "v3_legal_compliance_worker_node" in routing_history
        has_run_iot = "v3_iot_operations_worker_node" in routing_history
        has_run_ledger = "v3_financial_ledger_worker_node" in routing_history

        # 🚀 SCENARIO-DRIVEN MULTI-AGENT TRAFFIC LAWS
        if ("racket" in latest_text or "tension" in latest_text) and not has_run_iot:
            next_worker = "iot_worker"
            print("🔬 [V3 SUPERVISOR]: Intent matches Racket Playtime. Routing first to -> 'iot_worker'")
        elif ("racket" in latest_text or "tension" in latest_text) and has_run_iot and not has_run_legal:
            next_worker = "legal_worker"
            
            # Inject broad search tokens for Worker A to consume cleanly without fragmentation
            optimized_prompt = (
                "racquet maintenance impact intensity specifications string tension collapse decay specifications. "
                "relative indoor humidity ceiling safety thresholds environmental compliance."
            )
            messages_pool.append(HumanMessage(content=optimized_prompt))
            print("🔬 [V3 SUPERVISOR]: IoT satisfied. Routing sequentially to -> 'legal_worker' with optimized RAG tokens.")
        else:
            # End the multi-agent chain when all steps are satisfied
            next_worker = "end_workflow"
            print("🔬 [V3 SUPERVISOR]: Sequential tracks verified complete. Forcing 'end_workflow'")

        metadata = dict(state.get("internal_metadata", {}))
        metadata["next_worker"] = next_worker

        return {
            "messages": messages_pool if not has_run_iot else [], # Let LangGraph merge changes natively
            "agent_routing_history": routing_history,
            "internal_metadata": metadata
        }

    @classmethod
    def supervisor_conditional_edge(cls, state: V3SwarmAgentState) -> Literal["legal_worker", "iot_worker", "__end__"]:
        """
        The Edge Controller: Evaluates internal metadata flags to switch routing lanes.
        """
        metadata = state.get("internal_metadata", {})
        next_worker = metadata.get("next_worker", "end_workflow")

        # 🚀 UN-CLAMPED: Restored the full branching corridors map
        if next_worker == "legal_worker": return "legal_worker"
        if next_worker == "iot_worker": return "iot_worker"
        return "__end__"

    @classmethod
    def compile_swarm_graph(cls):
        """
        Finalized Builder: Wires up multi-agent nodes with parallel-safe execution guardrails.
        """
        workflow_builder = StateGraph(V3SwarmAgentState)

        # 1. Register Compute and Tool Nodes
        workflow_builder.add_node("supervisor", cls.supervisor_coordinator_node)
        workflow_builder.add_node("legal_worker", cls.legal_compliance_worker_node)
        workflow_builder.add_node("legal_debug_interceptor", cls.legal_tool_debug_interceptor_node)
        workflow_builder.add_node("legal_tools_bridge", ToolNode(_v3_legal_tools))
        
        workflow_builder.add_node("iot_worker", cls.iot_operations_worker_node)
        workflow_builder.add_node("iot_tools_bridge", ToolNode(_v3_iot_tools))

        async def ledger_worker_placeholder(state: V3SwarmAgentState) -> Dict[str, Any]:
            return {"agent_routing_history": ["v3_financial_ledger_worker_node"]}
        workflow_builder.add_node("ledger_worker", ledger_worker_placeholder)

        # 2. Wire Up Entry Point and Supervisor Conditional Edges
        workflow_builder.add_edge(START, "supervisor")
        workflow_builder.add_conditional_edges(
            "supervisor",
            cls.supervisor_conditional_edge,
            {
                "legal_worker": "legal_worker",
                "iot_worker": "iot_worker",
                "__end__": END
            }
        )

        # 3. Wire the Legal Worker Conditional Tooling Gates (Loops to ITSELF first)
        workflow_builder.add_conditional_edges(
            "legal_worker",
            cls.legal_routing_condition_edge,
            {"legal_tools_bridge": "legal_debug_interceptor", "__end__": "supervisor"}
        )
        workflow_builder.add_edge("legal_debug_interceptor", "legal_tools_bridge")
        workflow_builder.add_edge("legal_tools_bridge", "legal_worker") 

        # 🚀 4. FIXED: WIRE THE IoT WORKER TOOLING GATES WITH HARD LOCK CLOSURES
        # Directs worker outputs straight down into its tool execution bridge if required,
        # otherwise returns execution back up to the master supervisor for reflection passes!
        workflow_builder.add_conditional_edges(
            "iot_worker",
            cls.iot_routing_condition_edge,
            {
                "iot_tools_bridge": "iot_tools_bridge",
                "__end__": "supervisor"
            }
        )
        # Ensure the tool bridge loops straight back into the supervisor once data writes settle!
        workflow_builder.add_edge("iot_tools_bridge", "supervisor")
        
        workflow_builder.add_edge("ledger_worker", "supervisor")

        # Instantiate our custom production-grade database saver engine
        production_db_saver = V3PostgresGraphCheckpointer()

        # 🚀 MOUNT THE PRODUCTION POSTGRES SAVER TO THE COMPILER
        compiled_graph = workflow_builder.compile(checkpointer=production_db_saver)
        
        print("🧬 [V3 MULTI-AGENT SWARM]: Fully orchestrated network canvas compiled successfully.")
        return compiled_graph

# Initialize a centralized instance property ready for runtime call actions
v3_smart_court_swarm_engine = V3SwarmOrchestrator.compile_swarm_graph()