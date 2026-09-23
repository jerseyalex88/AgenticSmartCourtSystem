# File: GlobalAcademy-AiEngine/app/graphs/v2_agent_orchestrator.py
import os
import json
from typing import Literal, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from app.graphs.v2_agent_state import SmartCourtAgentState
from app.services.v2_tools_service import smart_court_tools_list

from langchain_core.messages import SystemMessage, HumanMessage
from app.services.v2_tools_service import (
    query_facility_knowledge_base,
    modify_court_operational_status,
    forecast_structural_degradation_risk,
    resolve_displaced_player_bookings,
    generate_emergency_maintenance_po
)
from langchain_core.utils.function_calling import convert_to_openai_tool

# 🚀 DECOUPLED TOOL SUB-ARRAYS BINDINGS
_legal_tools = [query_facility_knowledge_base]
_iot_tools = [modify_court_operational_status, forecast_structural_degradation_risk]
_ledger_tools = [resolve_displaced_player_bookings, generate_emergency_maintenance_po]

class v2AgentOrchestrator:
    # 🚀 INITIALIZE COMPONENT MODELS AND TOOLS BINDINGS
    _model = ChatOpenAI(model="gpt-5.4-mini", api_key=os.getenv("OPENAI_API_KEY"), temperature=0.0)
    _model_with_tools = _model.bind_tools(smart_court_tools_list)
    
    # Pre-built tool executor node handles running the matching function when requested
    _tool_node = ToolNode(smart_court_tools_list)

    @classmethod
    async def call_oracle_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        The Oracle Reasoning Node. Evaluates rolling message arrays, appends multi-tenant 
        system parameters, and determines if it requires database actions.
        """
        messages_pool = list(state.get("messages", []))
        academy_id = state.get("academy_id")
        branch_id = state.get("branch_id")
        court_id = state.get("court_id")

        # Inject strict system context instructions directly into the thinking layer
        system_instruction = (
            "You are the senior executive Smart Court Operator Brain. You have access to tools "
            "to query facility knowledge manuals and update court operational statuses.\n"
            f"CRITICAL SYSTEM GAURDRAILS:\n"
            f"- Active Tenant AcademyId: {academy_id}\n"
            f"- Active BranchId: {branch_id}\n"
            f"- Focused Court Asset Id Target: {court_id if court_id else 'None/Broad Scope'}\n"
            "You MUST always forward these ID values exactly into any tool executions you make. "
            "If document parameters indicate a threshold violation, you must autonomously "
            "call the status adjustment tool to lock that specific court asset row."
        )
        
        # Structure the payload safely for the LLM execution processing window
        from langchain_core.messages import SystemMessage
        execution_messages = [SystemMessage(content=system_instruction)] + messages_pool
        
        # Execute the model loop pass
        response = await cls._model_with_tools.ainvoke(execution_messages)
        
        # Return an incremental update map matching our TypedDict state properties
        return {"messages": [response]}

    @classmethod
    def routing_condition_edge(cls, state: SmartCourtAgentState) -> Literal["tools", "__end__"]:
        """
        Conditional Router Edge. Inspects the last message returned by the Oracle Node.
        If OpenAI requested tool arguments, routes to the Action Rails, otherwise exits the loop.
        """
        messages = state.get("messages", [])
        if not messages:
            return "__end__"
            
        last_message = messages[-1]
        
        # If the last message contains tool_calls parameter arrays, divert to the tools executor node
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
            
        return "__end__"

    @classmethod
    def compile_agent_graph(cls):
        """
        Assembles, binds, and compiles the physical worker nodes, tool nodes, and 
        conditional supervisor routing edges into a finalized stateful workflow instance.
        """
        # 1. Instantiate the StateGraph bound to our specific shared memory contract
        workflow_builder = StateGraph(SmartCourtAgentState)

        # 2. Register our specialized Multi-Agent Compute Nodes
        workflow_builder.add_node("supervisor", cls.supervisor_coordinator_node)
        workflow_builder.add_node("legal_worker", cls.legal_compliance_worker_node)
        workflow_builder.add_node("iot_worker", cls.iot_operations_worker_node)
        workflow_builder.add_node("ledger_worker", cls.financial_ledger_worker_node)

        # 🚀 CONNECT THE DECOUPLED TOOL NODE BRIDGES
        # Each worker agent node maps to its own specialized execution bridge node container!
        workflow_builder.add_node("legal_tools_bridge", ToolNode(_legal_tools))
        workflow_builder.add_node("iot_tools_bridge", ToolNode(_iot_tools))
        workflow_builder.add_node("ledger_tools_bridge", ToolNode(_ledger_tools))

        # 3. Define Entry Point Anchor
        workflow_builder.add_edge(START, "supervisor")

        # 4. Inject Supervisor Traffic Routing Rules Conditional Edges
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

        # 5. Connect Workers down to their respective Tool Node Bridges
        # If an agent decides it needs to make a tool call, the conditional routing edge passes it through!
        workflow_builder.add_conditional_edges(
            "legal_worker",
            cls.routing_condition_edge,
            {"tools": "legal_tools_bridge", "__end__": "supervisor"} # Returns to supervisor for reflection
        )
        workflow_builder.add_conditional_edges(
            "iot_worker",
            cls.routing_condition_edge,
            {"tools": "iot_tools_bridge", "__end__": "supervisor"}
        )
        workflow_builder.add_conditional_edges(
            "ledger_worker",
            cls.routing_condition_edge,
            {"tools": "ledger_tools_bridge", "__end__": "supervisor"}
        )

        # 6. Wire the Tool Bridges outputs directly back into the supervisor for evaluations
        workflow_builder.add_edge("legal_tools_bridge", "supervisor")
        workflow_builder.add_edge("iot_tools_bridge", "supervisor")
        workflow_builder.add_edge("ledger_tools_bridge", "supervisor")

        # 7. Compile the architecture into a runnable engine instance wrapper
        compiled_agent_executor = workflow_builder.compile()
        print("🧬 [v2 GRAPH ORCHESTRATOR]: Stateful Multi-Agent Mesh Engine Compiled Successfully.")
        return compiled_agent_executor

    # =========================================================================
    # 🛡️ MODULE 6.5: HARNESS ENGINEERING CIRCUIT BREAKER REGION
    # =========================================================================
    @classmethod
    def evaluate_harness_circuit_breakers(cls, state: SmartCourtAgentState) -> Literal["paused_gate", "continue_loop", "abort_circuit"]:
        """
        Enforces deterministic token tracking limits, max step reflection counts, 
        and asynchronous human-in-the-loop validation checkpoints.
        """
        MAX_REFLECTION_STEPS = 6
        MAX_TOKEN_BUDGET = 30000

        routing_history = state.get("agent_routing_history", [])
        token_consumed = state.get("token_budget_consumed", 0)
        staged_financials = state.get("staged_financial_actions", [])
        exec_status = state.get("execution_status", "Processing")

        # 🚀 FIXED (1): Dictionary syntax access applied across all state checks
        # Circuit Breaker 1: Infinite Loop Prevention Check
        if len(routing_history) >= MAX_REFLECTION_STEPS:
            print(f"🚨 [CIRCUIT BREAKER ABORT]: Graph thread exceeded max step reflection limit ({MAX_REFLECTION_STEPS}).")
            return "abort_circuit"
            
        # Circuit Breaker 2: Context Token Window Budgeting Control
        if token_consumed > MAX_TOKEN_BUDGET:
            print(f"🚨 [TOKEN BUDGET EXHAUSTED]: Context budget breached ceiling limit ({MAX_TOKEN_BUDGET} tokens).")
            return "abort_circuit"

        # Circuit Breaker 3: Asynchronous Human-In-The-Loop Approval Intercept
        if len(staged_financials) > 0 and exec_status != "Approved_By_Human":
            print("👥 [HUMAN-IN-THE-LOOP INTERCEPT]: Financial ledger modification staged. Pausing graph state machine.")
            return "paused_gate"

        return "continue_loop"

    # =========================================================================
    # 🧠 CENTRAL COORDINATOR SUPERVISOR PLANNING NODE
    # =========================================================================
    @classmethod
    async def supervisor_coordinator_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        The Master Brain: Contextually reviews rolling conversation parameters via LLM, 
        decomposes requirements, and delegates tasks to Legal, IoT, or Ledger agents.
        """
        routing_history = list(state.get("agent_routing_history", []))
        messages_pool = list(state.get("messages", []))
        user_role = state.get("user_role", "Player")
        
        routing_history.append("supervisor_coordinator_node")
        
        # 🛡️ DETERMINISTIC INF-LOOP BREAK DEFENSE:
        # Check what workers have already contributed to this active thread memory bag
        has_run_legal = "legal_compliance_worker_node" in routing_history
        has_run_iot = "iot_operations_worker_node" in routing_history
        has_run_ledger = "financial_ledger_worker_node" in routing_history

        # 1. Isolate text parameters
        latest_text = ""
        if messages_pool:
            latest_text = getattr(messages_pool[-1], "content", str(messages_pool[-1])).lower()

        print(f"🧠 [SUPERVISOR NODE]: Evaluating request queue history. Steps run: {len(routing_history)}")

        # 🚀 DETERMINISTIC WORKFLOW GATE RE-ROUTING (Bypasses LLM hallucinations if tasks are fulfilled!)
        if ("rained_out" in latest_text or "storm" in latest_text) and not has_run_legal:
            next_worker = "legal_compliance_worker"
        elif ("rained_out" in latest_text or "storm" in latest_text) and has_run_legal and not has_run_ledger:
            next_worker = "financial_ledger_worker"
        elif "clay" in latest_text and not has_run_legal:
            next_worker = "legal_compliance_worker"
        elif "tension" in latest_text and not has_run_iot:
            next_worker = "iot_operations_worker"
        else:
            # 2. If deterministic paths are clear, run the LLM completion planner as normal
            system_instruction = (
                "You are the Central Coordinator Supervisor Agent managing an elite sports facility network matrix.\n"
                "Your task is analyzing the user prompt and choosing the NEXT worker agent to route to.\n\n"
                "CHOICES: [legal_compliance_worker, iot_operations_worker, financial_ledger_worker, end_workflow]\n"
                "Rules: If all required steps are satisfied, output exactly 'end_workflow'."
            )
            execution_messages = [SystemMessage(content=system_instruction)] + messages_pool
            response = await cls._model.ainvoke(execution_messages)
            next_worker_token = str(response.content).strip().lower()

            if "legal" in next_worker_token: next_worker = "legal_compliance_worker"
            elif "iot" in next_worker_token or "operation" in next_worker_token: next_worker = "iot_operations_worker"
            elif "ledger" in next_worker_token or "financial" in next_worker_token: next_worker = "financial_ledger_worker"
            else: next_worker = "end_workflow"

        print(f"🎯 [LLM COORDINATOR DECISION]: Next designated node selected -> '{next_worker}'")

        metadata = dict(state.get("internal_metadata", {}))
        metadata["next_worker"] = next_worker

        return {
            "messages": [AIMessage(content=f"[Planning Trace]: Routing task control to {next_worker}.")],
            "agent_routing_history": routing_history,
            "internal_metadata": metadata
        }

    @classmethod
    def supervisor_conditional_edge(cls, state: SmartCourtAgentState) -> Literal["legal_worker", "iot_worker", "ledger_worker", "__end__"]:
        """
        The Traffic Controller: Evaluates the next_worker parameter mapped by the supervisor node 
        and physically routes the running thread token down the correct graph corridor lane.
        """
        metadata = state.get("internal_metadata", {})
        next_worker = metadata.get("next_worker", "end_workflow")

        if next_worker == "legal_compliance_worker":
            return "legal_worker"
        elif next_worker == "iot_operations_worker":
            return "iot_worker"
        elif next_worker == "financial_ledger_worker":
            return "ledger_worker"
        
        return "__end__"

    # =========================================================================
    # ⚖️ WORKER NODE 1: LEGAL & COMPLIANCE RAG WORKER
    # =========================================================================
    @classmethod
    async def legal_compliance_worker_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        Specialized Worker A: Extracts contract ceilings, warranty timelines, 
        shoe regulations, and liability rules via RAG lookups.
        """
        print("⚖️ [WORKER NODE]: legal_compliance_worker_node executing data extraction pass...")
        routing_history = list(state.get("agent_routing_history", []))
        routing_history.append("legal_compliance_worker_node")

        # Bind exclusively to legal/RAG tools
        model_with_legal = cls._model.bind_tools(_legal_tools)
        
        system_prompt = (
            "You are the specialized Legal & Compliance RAG Worker Agent. Your sole responsibility "
            "is querying facility handbooks, insurance contracts, and equipment guides.\n"
            f"FIREWALL BOUNDARIES: Tenant AcademyId: {state.get('academy_id')}\n"
            "Extract rules exactly as written in the text documents. Do not manipulate database statuses."
        )
        
        messages = [SystemMessage(content=system_prompt)] + list(state.get("messages", []))
        response = await model_with_legal.ainvoke(messages)
        
        return {
            "messages": [response],
            "agent_routing_history": routing_history
        }

    # =========================================================================
    # 🏠 WORKER NODE 2: FACILITIES & IoT TELEMETRY OPERATIONS WORKER
    # =========================================================================
    @classmethod
    async def iot_operations_worker_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        Specialized Worker B: Modifies facility table statuses, triggers hardware light 
        relays, and tracks time-series surface degradation wear curves.
        """
        print("🏠 [WORKER NODE]: iot_operations_worker_node executing asset mutation pass...")
        routing_history = list(state.get("agent_routing_history", []))
        routing_history.append("iot_operations_worker_node")

        # Bind exclusively to facilities and machine learning forecasting tools
        model_with_iot = cls._model.bind_tools(_iot_tools)
        
        system_prompt = (
            "You are the specialized Facilities & IoT Operations Worker Agent. Your responsibility "
            "is managing physical court attributes, locking down courts, and generating Prophet forecasts.\n"
            f"IoT TARGET SECTORS: BranchId: {state.get('branch_id')} | CourtId: {state.get('court_id')}\n"
            "You have direct authority to update 'Status' and 'FloodlightState' properties."
        )
        
        messages = [SystemMessage(content=system_prompt)] + list(state.get("messages", []))
        response = await model_with_iot.ainvoke(messages)
        
        return {
            "messages": [response],
            "agent_routing_history": routing_history
        }

    # =========================================================================
    # 💰 WORKER NODE 3: FINANCIAL LEDGER & SCHEDULING WORKER
    # =========================================================================
    @classmethod
    async def financial_ledger_worker_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        Specialized Worker C: Migrates player bookings to shadow queues, processes 
        cancellation refunds, and stages formal maintenance purchase order tickets.
        """
        print("💰 [WORKER NODE]: financial_ledger_worker_node executing transaction pass...")
        routing_history = list(state.get("agent_routing_history", []))
        routing_history.append("financial_ledger_worker_node")

        # Bind exclusively to scheduling, relocation, and purchasing tools
        model_with_ledger = cls._model.bind_tools(_ledger_tools)
        
        system_prompt = (
            "You are the specialized Financial Ledger & Scheduling Worker Agent. Your responsibility "
            "is executing player booking cancellations, processing reversals, and staging purchase orders.\n"
            f"LEDGER BOUNDARIES: AcademyId: {state.get('academy_id')}\n"
            "If an operation requires cost allocation, ensure you pass the exact verified material name."
        )
        
        messages = [SystemMessage(content=system_prompt)] + list(state.get("messages", []))
        response = await model_with_ledger.ainvoke(messages)
        
        return {
            "messages": [response],
            "agent_routing_history": routing_history
        }
        
# Initialize a centralized instance property ready for runtime call actions
smart_court_agent_engine = v2AgentOrchestrator.compile_agent_graph()
