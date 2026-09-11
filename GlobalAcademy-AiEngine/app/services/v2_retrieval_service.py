# File: GlobalAcademy-AiEngine/app/services/v2_retrieval_service.py
import os
import asyncpg
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from app.config import settings

class v2RetrievalService:
    # Initialize the centralized OpenAI model endpoint
    _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    @classmethod
    async def execute_hybrid_search(
        cls,
        academy_id: str,
        branch_id: str,
        query_text: str,
        court_id: Optional[str] = None,
        limit_results: int = 10
    ) -> List[Dict]:
        """
        Executes an un-buffered dual-pass database retrieval routine over PostgreSQL 18.
        Combines pgvector similarity scores with traditional keyword match metrics.
        """
        if not query_text.strip():
            return []

        # 1. Asynchronously transform the incoming text string into a 1536-dimensional coordinate vector
        try:
            embedding_response = await cls._openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=query_text
            )
            query_vector: List[float] = embedding_response.data[0].embedding
        except Exception as emb_err:
            print(f"❌ [v2 EMBEDDING CONVERSION FAULT]: Failed to translate retrieval string query: {emb_err}")
            return []

        # 2. Establish an active, secure transaction channel with the PostgreSQL server
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            # 🚀 THE MULTI-TENANT HYBRID QUERY GATE: 
            # We enforce strict MT partitions ($1 and $2) on BOTH select operations.
            # We compute Cosine Distance (1 - Cosine Similarity) using the <=> pgvector operator.
            # We use Postgres ILIKE text matching as an automated local sparse text ranking layer.
            
            raw_sql_query = """
            WITH dense_vector_pool AS (
                SELECT 
                    "Id", "DocumentName", "TextChunkContent", "PageNumber", "CourtId",
                    (1 - ("Embedding" <=> $3::vector)) AS vector_similarity_score
                FROM "CourtMaintenanceKnowledge"
                WHERE "AcademyId" = $1::uuid 
                  AND "BranchId" = $2::uuid
                  AND ($4::uuid IS NULL OR "CourtId" = $4::uuid)
                ORDER BY "Embedding" <=> $3::vector
                LIMIT $5
            ),
            sparse_keyword_pool AS (
                SELECT 
                    "Id", "DocumentName", "TextChunkContent", "PageNumber", "CourtId",
                    1.0 AS keyword_match_score
                FROM "CourtMaintenanceKnowledge"
                WHERE "AcademyId" = $1::uuid 
                  AND "BranchId" = $2::uuid
                  AND ($4::uuid IS NULL OR "CourtId" = $4::uuid)
                  AND "TextChunkContent" ILIKE $6
                LIMIT $5
            )
            -- Consolidate both data pools using a standard outer join matrix structure
            SELECT 
                COALESCE(d."Id", s."Id") AS chunk_id,
                COALESCE(d."DocumentName", s."DocumentName") AS document_name,
                COALESCE(d."TextChunkContent", s."TextChunkContent") AS text_content,
                COALESCE(d."PageNumber", s."PageNumber") AS page_number,
                COALESCE(d."CourtId", s."CourtId") AS court_id,
                COALESCE(d.vector_similarity_score, 0.0) AS dense_score,
                COALESCE(s.keyword_match_score, 0.0) AS sparse_score
            FROM dense_vector_pool d
            FULL OUTER JOIN sparse_keyword_pool s ON d."Id" = s."Id";
            """

            # Format the incoming search query as a permissive ILIKE pattern wildcard mapping
            wildcard_keyword_param = f"%{query_text.strip()}%"

            # Execute the combined statement natively against our database engine rows
            db_records = await conn.fetch(
                raw_sql_query,
                academy_id,               # $1
                branch_id,                # $2
                str(query_vector),        # $3
                court_id,                 # $4 (Can pass explicit court GUID or None)
                limit_results,            # $5
                wildcard_keyword_param    # $6
            )

            # 3. Format the active record collections cleanly into portable dictionaries
            blended_results_list = []
            for row in db_records:
                blended_results_list.append({
                    "id": str(row["chunk_id"]),
                    "document_name": row["document_name"],
                    "text_content": row["text_content"],
                    "page_number": row["page_number"],
                    "court_id": str(row["court_id"]) if row["court_id"] else None,
                    "dense_score": float(row["dense_score"]),
                    "sparse_score": float(row["sparse_score"])
                })

            print(f"🔍 [v2 HYBRID SEARCH COMPLETE]: Retracted {len(blended_results_list)} combined structural database slices.")
            return blended_results_list

        except Exception as db_query_err:
            print(f"❌ [v2 RETRIEVAL ERROR]: Hybrid database selection crashed: {db_query_err}")
            return []
        finally:
            await conn.close()
