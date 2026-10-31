# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/services/rag_service.py
# DESCRIPTION: Async database retrieval service for text-chunk lookups
# =========================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from database.models import CourtMaintenanceKnowledgeModel
from typing import List

class MaintenanceKnowledgeService:
    """Provides asynchronous retrieval interfaces for court compliance text chunks."""
    
    @staticmethod
    async def fetch_matching_guidelines(session: AsyncSession, keywords: List[str]) -> List[CourtMaintenanceKnowledgeModel]:
        """
        Asynchronously scans the knowledge table for text fragments matching 
        a set of target search keywords.
        """
        if not keywords:
            stmt = select(CourtMaintenanceKnowledgeModel).limit(10)
            result = await session.execute(stmt)
            return list(result.scalars().all())
            
        # 🚀 ALIGNED: Uses the exact DDL string definitions for lookups
        filters = []
        for kw in keywords:
            filters.append(CourtMaintenanceKnowledgeModel.DocumentName.ilike(f"%{kw}%"))
            filters.append(CourtMaintenanceKnowledgeModel.TextChunkContent.ilike(f"%{kw}%"))
            
        stmt = select(CourtMaintenanceKnowledgeModel).where(or_(*filters)).limit(25)
        result = await session.execute(stmt)
        return list(result.scalars().all())
