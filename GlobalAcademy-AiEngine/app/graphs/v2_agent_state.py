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
    # These parameters must be passed in by .NET on boot and are appended to ALL downstream SQL queries.
    academy_id: str
    branch_id: str

    # 🎾 ASSET-LEVEL FOCUS INTERCEPTOR
    # Captures a specific court GUID context if passed down from a localized React view page.
    # Set as Optional so it gracefully falls back to None for broad facility-wide queries.
    court_id: Optional[str]
    
    # 💬 ROLLING MESSAGE HISTORY FLOW
    # Annotated with add_messages so LangGraph automatically appends new messages 
    # to the running list instead of overwriting the previous conversational text.
    messages: Annotated[List[BaseMessage], add_messages]
    
    # 🗄️ INTERNAL PROCESSING MEMORY BAG
    # Allows nodes to pass unstructured metadata flags or custom tool outputs 
    # directly across routing edges (e.g., tracking a specific court_id discovered mid-flight).
    internal_metadata: Dict[str, Any]
