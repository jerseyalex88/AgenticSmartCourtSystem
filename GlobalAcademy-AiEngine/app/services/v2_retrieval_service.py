# File: GlobalAcademy-AiEngine/app/services/v2_retrieval_service.py
import os
import asyncpg
from uuid import UUID
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from app.config import settings

class v2RetrievalService:
    _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    @classmethod
    async def execute_hybrid_search(cls, academy_id: str, branch_id: str, query_text: str, court_id: Optional[str] = None, limit_results: int = 10) -> List[Dict]:
        if not query_text.strip(): return []
        try:
            emb = await cls._openai_client.embeddings.create(model="text-embedding-3-small", input=query_text)
            query_vector = emb.data[0].embedding
        except Exception as ex:
            print(f"❌ Embedding Error: {ex}"); return []

        # print(f"📡 [DEBUG execute_hybrid_search]: settings.postgres_connection_string: {settings.postgres_connection_string}")

        conn = await asyncpg.connect(settings.postgres_connection_string)
        try:
            raw_sql = """
            WITH dense_vector_pool AS (
                SELECT "Id", "DocumentName", "TextChunkContent", "PageNumber", "CourtId",
                       (1 - ("Embedding" <=> $3::vector)) AS vector_similarity_score
                FROM "CourtMaintenanceKnowledge"
                WHERE "AcademyId" = $1::uuid 
                  AND "BranchId" = $2::uuid 
                  -- 🚀 FIXED: Returns specific court documents OR general facility-wide manuals!
                  AND ($4::uuid IS NULL OR "CourtId" = $4::uuid OR "CourtId" IS NULL)
                ORDER BY "Embedding" <=> $3::vector LIMIT $5
            ),
            sparse_keyword_pool AS (
                SELECT "Id", "DocumentName", "TextChunkContent", "PageNumber", "CourtId", 1.0 AS keyword_match_score
                FROM "CourtMaintenanceKnowledge"
                WHERE "AcademyId" = $1::uuid 
                  AND "BranchId" = $2::uuid 
                  -- 🚀 FIXED: Applies the same inclusive hierarchy to keyword searches
                  AND ($4::uuid IS NULL OR "CourtId" = $4::uuid OR "CourtId" IS NULL)
                  AND "TextChunkContent" ILIKE $6 LIMIT $5
            )
            SELECT COALESCE(d."Id", s."Id") AS chunk_id, COALESCE(d."DocumentName", s."DocumentName") AS document_name,
                   COALESCE(d."TextChunkContent", s."TextChunkContent") AS text_content, COALESCE(d."PageNumber", s."PageNumber") AS page_number,
                   COALESCE(d."CourtId", s."CourtId") AS court_id, COALESCE(d.vector_similarity_score, 0.0) AS dense_score, COALESCE(s.keyword_match_score, 0.0) AS sparse_score
            FROM dense_vector_pool d FULL OUTER JOIN sparse_keyword_pool s ON d."Id" = s."Id";
            """
            db_records = await conn.fetch(raw_sql, academy_id, branch_id, str(query_vector), court_id, limit_results, f"%{query_text}%")
            return [{
                "id": str(r["chunk_id"]), "document_name": r["document_name"], "text_content": r["text_content"],
                "page_number": r["page_number"], "court_id": str(r["court_id"]) if r["court_id"] else None,
                "dense_score": float(r["dense_score"]), "sparse_score": float(r["sparse_score"])
            } for r in db_records]
        finally: await conn.close()

    @classmethod
    async def fetch_unique_uploaded_documents(cls, academy_id: str) -> List[Dict]:
        """
        Executes a DISTINCT grouping query to pull unique filenames currently loaded under a tenant boundary.
        """
        # print("\n🔎 [DEBUG - FETCH_UNIQUE_DOCUMENTS START]")
        # print(f"   👉 Incoming raw academy_id string literal: '{academy_id}'")
        # print(f"   👉 Length of string: {len(academy_id)}")
        
        try:
            clean_uuid = UUID(academy_id.strip())
            print(f"   👉 Parsed into true Python UUID object: {clean_uuid} (Type: {type(clean_uuid)})")
        except Exception as parse_ex:
            print(f"   ❌ [DEBUG ERROR] Failed to convert string to UUID: {parse_ex}")
            return []
        
        # print(f"\n[v2 DEBUG fetch_unique_uploaded_documents]: settings.postgres_connection_string: {settings.postgres_connection_string}")

        conn = await asyncpg.connect(settings.postgres_connection_string)
        try:
            query = """
            SELECT DISTINCT k."DocumentName", k."CourtId", COALESCE(c."Name", 'Entire Facility') as court_name, MAX(k."CreatedAtUtc") as created_at
            FROM "CourtMaintenanceKnowledge" k
            LEFT JOIN "Courts" c ON k."CourtId" = c."Id"
            WHERE k."AcademyId" = $1::uuid
            GROUP BY k."DocumentName", k."CourtId", c."Name";
            """
            records = await conn.fetch(query, academy_id)

            # print(f"   🚀 [QUERY EXECUTED]: Returned {len(records)} matching rows for AcademyId {clean_uuid}")
            
            # for idx, r in enumerate(records):
            #     print(f"      📍 Match [{idx}]: DocumentName='{r['DocumentName']}' | CourtName='{r['court_name']}'")

            return [{
                "document_name": r["DocumentName"],
                "court_id": str(r["CourtId"]) if r["CourtId"] else None,
                "court_name": r["court_name"],
                "created_at_utc": r["created_at"].isoformat()
            } for r in records]

        except Exception as db_ex:
            print(f"   ❌ [DEBUG ERROR] Database operation failed: {db_ex}")
            return []
        
        finally: await conn.close()

    @classmethod
    async def reconstruct_document_text(cls, academy_id: str, document_name: str) -> List[Dict]:
        """
        Pulls all shredded text blocks for a specific file name, ordered cleanly by page layout numbers.
        """
        conn = await asyncpg.connect(settings.postgres_connection_string)
        try:
            query = """
            SELECT "PageNumber", "TextChunkContent"
            FROM "CourtMaintenanceKnowledge"
            WHERE "AcademyId" = $1::uuid AND "DocumentName" = $2
            ORDER BY "PageNumber" ASC;
            """
            records = await conn.fetch(query, academy_id, document_name)
            return [{"page_number": r["PageNumber"], "text_content": r["TextChunkContent"]} for r in records]
        finally: await conn.close()
