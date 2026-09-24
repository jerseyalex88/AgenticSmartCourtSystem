# File: GlobalAcademy-AiEngine/app/graphs/v3_graph_builder.py
from typing import Dict, Any
from langgraph.graph import StateGraph, END

from app.graphs.v3_agent_state import AgentState, ExecutionStatusEnum
from app.graphs.v3_nodes import (
    EnvironmentAuditOrchestrator,
    WorkerALegalCompliance,
    WorkerBFacilitiesIoT,
    WorkerCFinancialLedger
)

class EnvironmentAuditGraphBuilder:
    """
    Builds and compiles the master state machine graph topology for Scenario 4,
    enforcing deterministic node transitions and robust state channel routing.
    """

    @staticmethod
    def router_conditional_edge(state: AgentState) -> str:
        """
        Determines the next node transition path based on the structural 
        presence of channel data, preventing recursion loops.
        """
        print(f"🔮 [GRAPH ROUTER EDGE] Evaluating Channel States -> Status: {state.execution_status}, Contexts Count: {len(state.context_retrieved_chunks)}, Snapshot IDs Count: {len(state.active_telemetry_snapshot_ids)}")

        # 1. Enforce hard-stop termination rules if a harness circuit breaker or pause gate is active
        if state.execution_status == ExecutionStatusEnum.ABORTED_CIRCUIT_BREAKER:
            print("🛑 [GRAPH ROUTER] Circuit Breaker active. Terminating graph thread.")
            return END
            
        if state.execution_status == ExecutionStatusEnum.PAUSED_PENDING_APPROVAL:
            print("🛑 [GRAPH ROUTER] Human-In-The-Loop Approval Gate engaged. Suspending execution loop context.")
            return END

        if state.execution_status == ExecutionStatusEnum.COMPLETED:
            print("✅ [GRAPH ROUTER] Execution sequence finalized cleanly.")
            return END

        # 2. DETERMINISTIC STATE TRACKING RULES
        # Step A: If no compliance documents are found yet, route to Worker A
        if not state.context_retrieved_chunks:
            print("➡️ [EDGE DECISION] No context found. Routing straight to worker_legal_rag.")
            return "worker_legal_rag"
            
        # Step B: If Worker A populated documents, but Worker B hasn't populated court snapshot primary keys, route to Worker B
        if not state.active_telemetry_snapshot_ids:
            print("➡️ [EDGE DECISION] RAG chunks present but court snapshots blank. Routing to worker_facilities_iot.")
            return "worker_facilities_iot"
            
        # Step C: If court snapshot IDs exist and state remains Active, route to Worker C to handle financial balances
        if state.execution_status == ExecutionStatusEnum.ACTIVE:
            print("➡️ [EDGE DECISION] Courts locked out. Routing to worker_financial_ledger to process financial metrics.")
            return "worker_financial_ledger"

        print("➡️ [EDGE DECISION] No matching parameters met. Dropping out of loop.")
        return END

    @classmethod
    def compile_harness_graph(cls):
        """
        Assembles nodes, binds strongly typed state schemas, maps edge routing constraints,
        and returns a functional runtime graph workflow object blueprint.
        """
        # Initialize graph layout mapping back to our Pydantic model format shape
        # LangGraph accepts a class or a dict-schema function definition block
        workflow = StateGraph(AgentState)

        # 1. Register the structural node script methods
        workflow.add_node("supervisor_brain", EnvironmentAuditOrchestrator.supervisor_coordinator_node)
        workflow.add_node("worker_legal_rag", WorkerALegalCompliance.legal_compliance_rag_node)
        workflow.add_node("worker_facilities_iot", WorkerBFacilitiesIoT.facilities_iot_override_node)
        workflow.add_node("worker_financial_ledger", WorkerCFinancialLedger.ledger_scheduling_mitigation_node)

        # 2. Set the fixed starting entrance node boundary
        workflow.set_entry_point("supervisor_brain")

        # 3. Bind worker loops back to the supervisor router node matrix
        workflow.add_edge("worker_legal_rag", "supervisor_brain")
        workflow.add_edge("worker_facilities_iot", "supervisor_brain")
        workflow.add_edge("worker_financial_ledger", "supervisor_brain")

        # 4. Attach the multi-step conditional router edge logic onto the Supervisor node
        workflow.add_conditional_edges(
            "supervisor_brain",
            cls.router_conditional_edge,
            {
                "worker_legal_rag": "worker_legal_rag",
                "worker_facilities_iot": "worker_facilities_iot",
                "worker_financial_ledger": "worker_financial_ledger",
                END: END
            }
        )

        # Compile the final graph state framework layout engine configuration
        # Note: In production, we register our custom Postgres checkpointer directly here.
        compiled_graph = workflow.compile()
        print("🧬 [LANGGRAPH WORKFLOW] Master Scenario 4 multi-agent topology compiled successfully.")
        return compiled_graph
