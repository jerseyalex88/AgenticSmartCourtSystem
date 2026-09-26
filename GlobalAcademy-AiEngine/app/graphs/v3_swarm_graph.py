# File: GlobalAcademy-AiEngine/app/graphs/v3_swarm_graph.py
import os
from typing import List, Dict, Any, TypedDict, Annotated, Optional, Literal
from langchain_core.messages import BaseMessage, AIMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.prebuilt import ToolNode

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
    agent_routing_history: List[str]
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
    _model = ChatOpenAI(model="gpt-4o-mini", api_key=os.getenv("OPENAI_API_KEY"), temperature=0.0)

    # =========================================================================
    # ⚖️ GREENFIELD WORKER NODE A: LEGAL & COMPLIANCE RAG WORKER
    # =========================================================================
    @classmethod
    async def legal_compliance_worker_node(cls, state: V3SwarmAgentState) -> Dict[str, Any]:
        """
        Specialized Worker A: Focuses exclusively on extracting policy ceilings, 
        warranty limits, and tournament equipment mandates from ingested reference manuals.
        """
        routing_history = list(state.get("agent_routing_history", []))
        print(f"⚖️ [V3 LEGAL WORKER]: Executing specialized compliance mining. Steps run: {len(routing_history)}")
        routing_history.append("v3_legal_compliance_worker_node")

        # 🎯 TOOL BINDING BOUNDARY: Bind exclusively to the RAG knowledge tool subset
        model_with_legal = cls._model.bind_tools(_v3_legal_tools)

        # Build an ironclad system prompt forcing the worker to focus on strict text verification
        system_prompt = (
            "You are the specialized V3 Legal & Compliance RAG Worker Agent.\n"
            "Your sole capability is executing precise lookups over facility manuals, warranty "
            "contracts, and insurance limit handbooks to mine required operational data thresholds.\n\n"
            f"MULTI-TENANT FIREWALL LENS:\n"
            f" - Enforced AcademyId Context: {state.get('academy_id')}\n"
            f" - Enforced Target Court Context: {state.get('court_id', 'General Scope')}\n\n"
            "CRITICAL OPERATIONAL MAPPING RULES:\n"
            "1. You MUST call 'query_facility_knowledge_base' if the exact policy limits, warranty terms, "
            "or equipment mandates have not been extracted into the conversation history yet.\n"
            "2. Extract facts exactly as recorded in the source documentation files. Do not guess parameters.\n"
            "3. Do NOT make up codes, numbers, or modify court attributes yourself. You are an advisor."
        )

        # Pull the running rolling message history stream
        messages_pool = list(state.get("messages", []))
        execution_messages = [SystemMessage(content=system_prompt)] + messages_pool

        # Asynchronously invoke OpenAI via the bounded tool node interface
        response = await model_with_legal.ainvoke(execution_messages)

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
        The Master Mind: Reviews conversation memory state, evaluates player/admin
        scenarios contextually, and selects the next targeted worker agent corridor.
        """
        routing_history = list(state.get("agent_routing_history", []))
        messages_pool = list(state.get("messages", []))
        user_role = state.get("user_role", "Player")

        # 🚀 DEBUG PRINT 1: Inbound State Inspection
        print(f"\n🔍 [V3 DEBUG - SUPERVISOR ENTRY]: Inbound History Steps Count: {len(routing_history)}")
        print(f"🔍 [V3 DEBUG - SUPERVISOR ENTRY]: Current Routing Steps Run: {routing_history}")
        
        print(f"🧠 [V3 SUPERVISOR NODE]: Analyzing active thread context for role '{user_role}'. Steps run: {len(routing_history)}")
        routing_history.append("v3_supervisor_coordinator_node")

        # Extract text tokens case-insensitively out of message pools
        # ensuring intermediate worker summaries do not blind the routing paths!
        latest_text = ""
        if messages_pool:
            # First message is the original HumanMessage prompt
            latest_text = getattr(messages_pool[0], "content", str(messages_pool[0])).lower() 
         
        print(f"🔍 [V3 DEBUG - SUPERVISOR ENTRY]: Extracted Prompt Text Hook: '{latest_text[:60]}...'")

        # Enforce deterministic loop breaks to prevent cycle deadlocks
        has_run_legal = "v3_legal_compliance_worker_node" in routing_history
        has_run_iot = "v3_iot_operations_worker_node" in routing_history
        has_run_ledger = "v3_financial_ledger_worker_node" in routing_history

        # 🚀 SCENARIO-DRIVEN DETERMINISTIC ROUTING GATE SWITCHES
        # Scenario A & C: Weather / Rain-outs/ Deluges
        if ("rained_out" in latest_text or "storm" in latest_text) and not has_run_legal:
            next_worker = "legal_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Weather. Selecting 'legal_worker'")
        elif ("rained_out" in latest_text or "storm" in latest_text) and has_run_legal and not has_run_ledger:
            next_worker = "ledger_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Weather + Legal Done. Selecting 'ledger_worker'")
        elif ("clay" in latest_text or "tournament" in latest_text) and not has_run_legal:
            next_worker = "legal_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Clay. Selecting 'legal_worker'")
        elif ("clay" in latest_text or "tournament" in latest_text) and has_run_legal and not has_run_ledger:
            next_worker = "ledger_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Clay + Legal Done. Selecting 'ledger_worker'")
        elif ("racket" in latest_text or "tension" in latest_text) and not has_run_iot:
            next_worker = "iot_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Racket. Selecting 'iot_worker'")
        elif ("racket" in latest_text or "tension" in latest_text) and has_run_iot and not has_run_legal:
            next_worker = "legal_worker"
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Keyword Match: Racket + IoT Done. Selecting 'legal_worker'")
        else:
            print("🔍 [V3 DEBUG - SUPERVISOR BRAIN]: No static keywords matched. Invoking LLM Planner...")
            system_instruction = (
                "You are the V3 Central Swarm Coordinator Supervisor.\n"
                "Select the next worker node lane to route to.\n\n"
                "CHOICES:\n- 'legal_worker'\n- 'iot_worker'\n- 'ledger_worker'\n- 'end_workflow'\n\n"
                "Output exactly one of those tokens."
            )
            execution_messages = [SystemMessage(content=system_instruction)] + messages_pool
            response = await cls._model.ainvoke(execution_messages)

            raw_token = str(response.content).strip().lower()
            next_worker_token = raw_token.replace("-", "").replace("'", "").replace('"', "").strip()
            
            print(f"🔍 [V3 DEBUG - SUPERVISOR BRAIN]: Raw LLM Output: '{raw_token}' | Cleaned: '{next_worker_token}'")

            if "legal" in next_worker_token: next_worker = "legal_worker"
            elif "iot" in next_worker_token or "operation" in next_worker_token: next_worker = "iot_worker"
            elif "ledger" in next_worker_token or "financial" in next_worker_token: next_worker = "ledger_worker"
            else: next_worker = "end_workflow"

        print(f"🎯 [V3 DEBUG - SUPERVISOR EXIT]: Final Next Designated Node Selection Set To -> '{next_worker}'\n")

        metadata = dict(state.get("internal_metadata", {}))
        metadata["next_worker"] = next_worker

        # 🚀 FIXED: If the graph is terminating, check if the LLM outputted a full sentence answer.
        # If it did, append it to the graph state contract so the frontend can render it!
        if next_worker == "end_workflow" and next_worker_token != "end_workflow":
            return {
                "messages": [response], # Injection token mounts the AI text response to history
                "agent_routing_history": routing_history,
                "internal_metadata": metadata
            }

        return {
            "agent_routing_history": routing_history,
            "internal_metadata": metadata
        }

    @classmethod
    def supervisor_conditional_edge(cls, state: V3SwarmAgentState) -> Literal["legal_worker", "iot_worker", "ledger_worker", "__end__"]:
        """
        The Edge Controller: Evaluates internal metadata flags to switch routing lanes.
        """
        metadata = state.get("internal_metadata", {})
        next_worker = metadata.get("next_worker", "end_workflow")

        # 🚀 DEBUG PRINT 2: Edge Mapping Inspection
        print(f"🔮 [V3 DEBUG - CONDITIONAL EDGE]: Router intercepted metadata next_worker key = '{next_worker}'")

        if next_worker == "legal_worker": 
            print("🔮 [V3 DEBUG - CONDITIONAL EDGE]: Returning path selection string token -> 'legal_worker'")
            return "legal_worker"
        if next_worker == "iot_worker": 
            print("🔮 [V3 DEBUG - CONDITIONAL EDGE]: Returning path selection string token -> 'iot_worker'")
            return "iot_worker"
        if next_worker == "ledger_worker": 
            print("🔮 [V3 DEBUG - CONDITIONAL EDGE]: Returning path selection string token -> 'ledger_worker'")
            return "ledger_worker"
            
        print("🔮 [V3 DEBUG - CONDITIONAL EDGE]: Returning terminal path token -> '__end__'")
        return "__end__"

    @classmethod
    def compile_swarm_graph(cls):
        """
        Finalized Builder: Registers greenfield nodes and wires up the routing canvas layout.
        """
        workflow_builder = StateGraph(V3SwarmAgentState)

        # 1. Register Nodes
        workflow_builder.add_node("supervisor", cls.supervisor_coordinator_node)
        workflow_builder.add_node("legal_worker", cls.legal_compliance_worker_node)
        workflow_builder.add_node("legal_tools_bridge", ToolNode(_v3_legal_tools))
        workflow_builder.add_node("iot_worker", cls.iot_operations_worker_node)
        workflow_builder.add_node("iot_tools_bridge", ToolNode(_v3_iot_tools))
        
        async def ledger_worker_placeholder(state: V3SwarmAgentState) -> Dict[str, Any]:
            print("💰 [V3 LEDGER WORKER]: Running greenfield async placeholder step.")
            routing_history = list(state.get("agent_routing_history", []))
            routing_history.append("v3_financial_ledger_worker_node")
            return {"agent_routing_history": routing_history}
            
        workflow_builder.add_node("ledger_worker", ledger_worker_placeholder)
        
        # workflow_builder.add_node("ledger_worker", cls.financial_ledger_worker_node)

        # workflow_builder.add_node("ledger_tools_bridge", ToolNode(_v3_ledger_tools))

        # 2. Wire up Graph Edges
        workflow_builder.add_edge(START, "supervisor")
        workflow_builder.add_conditional_edges(
            "supervisor",
            cls.supervisor_conditional_edge,
            {
                "legal_worker": "legal_worker",
                "iot_worker": "iot_worker",
                "ledger_worker": "ledger_worker",
                "__end__": END
            }
        )

        # 🚀 3. WIRE THE LEGAL WORKER CONDITIONAL TOOLING GATES
        # If the legal worker demands a tool call, pass to its isolated tool node bridge, 
        # otherwise return control cleanly back into the supervisor coordinator for reflection!
        workflow_builder.add_conditional_edges(
            "legal_worker",
            cls.legal_routing_condition_edge,
            {
                "legal_tools_bridge": "legal_tools_bridge",
                "__end__": "supervisor"
            }
        )

        # Wire the tool bridge output row straight back into the supervisor for evaluations
        workflow_builder.add_edge("legal_tools_bridge", "supervisor")

        # 🚀 4. WIRE THE IoT WORKER CONDITIONAL TOOLING GATES
        # If the facilities worker requests a tool execution, drop down to its isolated bridge,
        # otherwise loop back up into the supervisor for continuous evaluation passes!
        workflow_builder.add_conditional_edges(
            "iot_worker",
            cls.iot_routing_condition_edge,
            {
                "iot_tools_bridge": "iot_tools_bridge",
                "__end__": "supervisor"
            }
        )
        
        # Wire the tool bridge output row straight back into the supervisor for evaluations
        workflow_builder.add_edge("iot_tools_bridge", "supervisor")

        # # 🚀 5. WIRE THE FINANCIAL LEDGER WORKAL CONDITIONAL TOOLING GATES
        # # If the ledger worker requests a tool execution, pass down to its isolated bridge,
        # # otherwise return control back into the supervisor coordinator for reflection!
        # workflow_builder.add_conditional_edges(
        #     "ledger_worker",
        #     cls.ledger_routing_condition_edge,
        #     {
        #         "ledger_tools_bridge": "ledger_tools_bridge",
        #         "__end__": "supervisor"
        #     }
        # )

        # Wire the ledger worker back into the supervisor cleanly
        workflow_builder.add_edge("ledger_worker", "supervisor")

        compiled_graph = workflow_builder.compile()
        print("🧬 [V3 SWARM GRAPH]: Isolated Multi-Agent Architecture Compiled Successfully.")
        return compiled_graph

# Initialize a centralized instance property ready for runtime call actions
v3_smart_court_swarm_engine = V3SwarmOrchestrator.compile_swarm_graph()