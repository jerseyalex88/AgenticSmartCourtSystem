# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/nodes/ingestion_node.py
# DESCRIPTION: Node A - Async ingestion of open courts and matching context
# =========================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.connection import get_async_db_session
from database.models import CourtEntityModel
from models.state import AgenticWorkflowState, CourtRecord, MaintenanceGuideline
from services.rag_service import MaintenanceKnowledgeService

class IngestionNode:
    """Node A: Handles structural state data extractions from active database tables."""
    
    @staticmethod
    async def process_async(state: AgenticWorkflowState) -> AgenticWorkflowState:
        print("🔬 [NODE A]: Initiating async database ingestion pass...")
        state.execution_steps_history.append("IngestionNode_Start")
        
        search_keywords = ["maintenance", "surface", "moisture", "cracks"]
        
        async with get_async_db_session() as session:
            # 🚀 ALIGNED: Queries exact DDL fields for active open courts
            court_stmt = select(CourtEntityModel).where(
                CourtEntityModel.Status == "Open",
                CourtEntityModel.IsDecommissioned == False
            )
            court_result = await session.execute(court_stmt)
            db_courts = court_result.scalars().all()
            
            print(f"🔬 [NODE A]: Found {len(db_courts)} active open courts inside table partitions.")
            
            # Map database records to the typed state memory schema
            state.open_courts = [
                CourtRecord(
                    court_id=str(c.Id),
                    name=c.Name or "Unnamed Asset Slot",
                    court_type="Indoor" if c.IsIndoor else "Outdoor",
                    status=c.Status
                ) for c in db_courts
            ]
            
            # Pull matched compliance fragments using the text-search helper
            print(f"🔬 [NODE A]: Fetching text guidelines for terms: {search_keywords}")
            db_knowledge_chunks = await MaintenanceKnowledgeService.fetch_matching_guidelines(
                session=session, 
                keywords=search_keywords
            )
            
            state.matched_rules = [
                MaintenanceGuideline(
                    guideline_id=idx,
                    topic=chunk.DocumentName or "General Maintenance",
                    rule_text=chunk.TextChunkContent
                ) for idx, chunk in enumerate(db_knowledge_chunks)
            ]
            
            print(f"🔬 [NODE A]: Successfully mapped {len(state.matched_rules)} compliance knowledge text chunks.")
            
        state.execution_steps_history.append("IngestionNode_Complete")
        return state
