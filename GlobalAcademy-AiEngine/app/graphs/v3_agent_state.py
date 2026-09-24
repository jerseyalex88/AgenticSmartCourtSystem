from pydantic import BaseModel, Field, UUID4
from typing import List, Dict, Any, Optional
from enum import Enum

class UserRoleEnum(str, Enum):
    ADMIN = "GlobalAdmin"
    DIRECTOR = "AcademyDirector"
    PLAYER = "Player"

class ExecutionStatusEnum(str, Enum):
    ACTIVE = "Active"
    PAUSED_PENDING_APPROVAL = "Paused_Pending_Approval"
    COMPLETED = "Completed"
    ABORTED_CIRCUIT_BREAKER = "Aborted_Circuit_Breaker"

class OperationalHarnessMetrics(BaseModel):
    """Tracks token budgets and iteration counts to prevent loop leakage."""
    total_tokens_consumed: int = Field(default=0, description="Cumulative context token count.")
    token_budget_cap: int = Field(default=45000, description="Max token allocation threshold.")
    current_loop_count: int = Field(default=0, description="Sequential loop tracking count.")
    max_loop_threshold: int = Field(default=6, description="Hard deterministic loop circuit breaker.")

class PendingApprovalPayload(BaseModel):
    """Captures metadata for high-impact actions requiring director validation."""
    target_worker: str = Field(..., description="The node generating the intercept (e.g., Worker C).")
    action_type: str = Field(..., description="Action category (e.g., Refund, CourtDecommission).")
    suggested_payload: Dict[str, Any] = Field(default_factory=dict, description="The structural JSON data staged for atomic execution.")
    audit_rationale: str = Field(..., description="RAG or diagnostic reasoning showing why the action was generated.")

class AgentState(BaseModel):
    """The master state engine context dictionary tracking the multi-agent execution thread."""
    # Cryptographic Isolation & Security Headers
    thread_id: UUID4 = Field(..., description="Unique thread identifier map matching LangGraph routing threads.")
    academy_id: UUID4 = Field(..., description="Iron-clad tenant scope boundary validator.")
    branch_id: UUID4 = Field(..., description="Branch boundary mapping location context.")
    user_id: str = Field(..., description="Validated user identity identifier token mapping back to .NET context.")
    user_role: UserRoleEnum = Field(..., description="Caller identity role clearance footprint.")
    
    # Text, Speech & Telemetry Processing Channels
    raw_input_prompt: str = Field(default="", description="The transcribed or raw text input.")
    active_agent_response: str = Field(default="", description="The final synthesized execution string output.")
    context_retrieved_chunks: List[str] = Field(default_factory=list, description="RAG text fragments parsed via pgvector/BM25 loops.")
    active_telemetry_snapshot_ids: List[UUID4] = Field(default_factory=list, description="Tracked analytical record primary keys.")
    
    # Operational Harness Governance Layers
    execution_status: ExecutionStatusEnum = Field(default=ExecutionStatusEnum.ACTIVE)
    harness_metrics: OperationalHarnessMetrics = Field(default_factory=OperationalHarnessMetrics)
    pending_approval_gate: Optional[PendingApprovalPayload] = Field(default=None, description="Staged payload for Human-In-The-Loop confirmation.")
    
    class Config:
        use_enum_values = True
