# File: GlobalAcademy-AiEngine/app/graphs/v2_agent_state.py
from typing import List, Dict, Any, TypedDict, Annotated, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class SmartCourtAgentState(TypedDict):
    """
    The centralized memory contract governing the active state machine loop.
    Maintains cryptographic multi-tenant guardrails alongside rolling message traces.
    """
    
    # 🛡️ MULTI-TENANT CONTEXT FIREWALL BOUNDARIES
    academy_id: str
    branch_id: str

    # 🎾 ASSET-LEVEL FOCUS INTERCEPTOR
    court_id: Optional[str]
    
    # 💬 ROLLING MESSAGE HISTORY FLOW
    messages: Annotated[List[BaseMessage], add_messages]
    
    # 🗄️ INTERNAL PROCESSING MEMORY BAG
    internal_metadata: Dict[str, Any]

    # =========================================================================
    # 🚀 NEW: MULTI-AGENT SCENARIO OVERRIDE SLOTS
    # =========================================================================
    user_id: str                             # The unique acting user GUID (Player or Admin)
    user_role: str                           # Tier string determining routing: 'Player', 'AcademyDirector'
    
    extracted_legal_clauses: Dict[str, Any]  # RAG metrics (warranties, policy ceilings, shoe rules)
    telemetry_snapshot_data: Dict[str, Any]  # Live IoT metrics pulled from database table rows
    staged_operational_actions: List[Dict[str, Any]] # Proposed mutations (status locks, light relays)
    staged_financial_actions: List[Dict[str, Any]]   # Proposed financial shifts (refunds, PO creation)
    
    # 🛡️ MODULE 6.5: HARNESS ENGINEERING CIRCUITS
    agent_routing_history: List[str]         # Execution trace tracking node footsteps
    execution_status: str                    # State descriptor: 'Processing', 'Paused_Pending_Approval', 'Complete'
    token_budget_consumed: int               # Counter checking context window budgeting thresholds
