# =========================================================================
# PROJECT: TENNIS ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/models/state.py
# DESCRIPTION: Governs the shared parallel-safe state data contract structures
# =========================================================================

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class CourtRecord(BaseModel):
    """Strongly typed layout mapping active court records pulled from the DB."""
    court_id: str = Field(..., description="The unique structural database index GUID.")
    name: str = Field(..., description="The user-friendly court designation string (e.g. Court 1).")
    court_type: str = Field(default="Indoor", description="The asset categorization string tag.")
    status: str = Field(default="Open", description="The operational filtering status key.")

class MaintenanceGuideline(BaseModel):
    """Strongly typed layout mapping compliance guidelines text fragments."""
    guideline_id: int = Field(..., description="The raw database primary key integer.")
    topic: str = Field(..., description="The semantic rule topic designation header.")
    rule_text: str = Field(..., description="The raw, un-structured textual rule compliance string block.")

class AgenticWorkflowState(BaseModel):
    """
    The Centralized Memory Canvas: Manages data state variables across pipeline steps.
    Designed with precise append-only arrays for audit trails and future extensions.
    """
    # OPERATIONAL PAYLOAD MATRICES
    target_tenant_id: str = Field(default="tenant_sandbox_guid", description="The active isolation tenant GUID.")
    open_courts: List[CourtRecord] = Field(default_factory=list, description="Collection of open courts extracted for audit.")
    matched_rules: List[MaintenanceGuideline] = Field(default_factory=list, description="Extracted compliance text shards related to court topics.")
    
    # AGENT EVALUATION FEEDBACK ARRAYS
    # Key-value map storing individual court assessment summaries (CourtId -> Summary Text)
    compiled_evaluations: Dict[str, str] = Field(default_factory=dict, description="Final LLM text synthesis output records.")
    
    # RUNTIME FLIGHT RECORDING TRACKERS
    execution_steps_history: List[str] = Field(default_factory=list, description="Append-only log of executed node path steps.")
    execution_status: str = Field(default="Processing", description="The active routing control status flag.")
