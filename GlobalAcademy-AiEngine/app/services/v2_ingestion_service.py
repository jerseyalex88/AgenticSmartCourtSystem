# File: GlobalAcademy-AiEngine/app/services/v2_ingestion_service.py
import io
import httpx
import asyncpg
from typing import Optional, List
from pypdf import PdfReader
from openai import AsyncOpenAI
import os

from app.config import settings

class v2IngestionService:

    @classmethod
    async def process_document_ingetion(
        cls, 
        client: httpx.AsyncClient, 
        academy_id: str, 
        branch_id: str, 
        court_id: Optional[str], 
        document_name: str, 
        file_bytes: bytes
    ):
        print(f"\n📥 [v2 RAG INGESTION]: Commencing parsing pipeline for: {document_name}")
        
        # 1. Asynchronously parse PDF pages out of memory streams
        try:
            pdf_stream = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_stream)
            extracted_pages_data = []
            
            for page_idx, page in enumerate(reader.pages):
                text_content = page.extract_text()
                if text_content and text_content.strip():
                    extracted_pages_data.append((page_idx + 1, text_content))
            
            print(f"   📄 Extracted {len(extracted_pages_data)} readable textual pages from document memory.")
        except Exception as pdf_err:
            print(f"   ❌ [PDF PARSE FAULT]: Extraction failure: {pdf_err}")
            return

        # 2. Shred the text blocks using a Recursive Token Slit strategy
        chunked_records = cls._generate_overlapping_chunks(extracted_pages_data)
        print(f"   ✂️ Fragmented document text into {len(chunked_records)} unique overlapping semantic paragraphs.")

        # 3. Batch process embedding matrices using the active OpenAI API Key
        openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        
        # Open an active connection block straight to your PostgreSQL 18 engine
        # using the exact string variable loaded from your C# appsettings.json file!
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            for page_num, text_chunk in chunked_records:
                # Fire embedding request over our non-blocking network client
                response = await openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text_chunk
                )
                embedding_vector: List[float] = response.data[0].embedding
                
                # 4. Atomic raw SQL insert matching our C# EF Core table columns completely
                # casting the Python float list string natively into a pgvector query parameter
                await conn.execute(
                    """
                    INSERT INTO "CourtMaintenanceKnowledge" 
                    ("Id", "AcademyId", "BranchId", "CourtId", "DocumentName", "TextChunkContent", "PageNumber", "Embedding", "CreatedAtUtc")
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'utc');
                    """,
                    academy_id, branch_id, court_id, document_name, text_chunk, page_num, str(embedding_vector)
                )
                
            print(f"✅ [v2 INGESTION SUCCESS]: Successfully vectorized and persisted context blocks into PostgreSQL tables!")
            
        except Exception as db_err:
            print(f"❌ [v2 DATABASE INGESTION CRASH]: Failed to commit row parameters: {db_err}")
        finally:
            await conn.close()

    @classmethod
    def _generate_overlapping_chunks(cls, pages_data: List[tuple], chunk_size: int = 500, overlap: int = 100) -> List[tuple]:
        """
        Shreds text arrays into clean overlapping chunks while maintaining page mapping metadata.
        """
        compiled_chunks = []
        for page_num, text in pages_data:
            words = text.split()
            for i in range(0, len(words), chunk_size - overlap):
                chunk_words = words[i:i + chunk_size]
                if not chunk_words:
                    break
                chunk_text = " ".join(chunk_words)
                compiled_chunks.append((page_num, chunk_text))
                if i + chunk_size >= len(words):
                    break
        return compiled_chunks
