# File: GlobalAcademy-AiEngine/app/services/v2_ingestion_service.py
import io
import asyncpg
from typing import Optional, List, Tuple
from pypdf import PdfReader
from openai import AsyncOpenAI
from app.config import settings

class v2IngestionService:

    @classmethod
    async def process_batch_pdf_ingestion(cls, academy_id: str, branch_id: str, court_id: Optional[str], files_data: List[Tuple[str, bytes]]):
        openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            for filename, content_bytes in files_data:
                print(f"📥 Processing batch file entry: {filename}")
                pdf_stream = io.BytesIO(content_bytes)
                reader = PdfReader(pdf_stream)
                
                extracted_pages = []
                for idx, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        extracted_pages.append((idx + 1, text))
                        
                # Split text into overlapping segments
                words_chunk_size = 450
                overlap = 90
                
                for page_num, raw_text in extracted_pages:
                    words = raw_text.split()
                    for i in range(0, len(words), words_chunk_size - overlap):
                        slice_words = words[i:i + words_chunk_size]
                        if not slice_words: break
                        chunk_paragraph = " ".join(slice_words)
                        
                        # Generate OpenAI embeddings
                        response = await openai_client.embeddings.create(
                            model="text-embedding-3-small",
                            input=chunk_paragraph
                        )
                        vector = response.data[0].embedding
                        
                        await conn.execute(
                            """
                            INSERT INTO "CourtMaintenanceKnowledge" 
                            ("Id", "AcademyId", "BranchId", "CourtId", "DocumentName", "TextChunkContent", "PageNumber", "Embedding", "CreatedAtUtc")
                            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'utc');
                            """,
                            academy_id, branch_id, court_id, filename, chunk_paragraph, page_num, str(vector)
                        )
            print("✅ Batch ingestion routine finalized successfully across all vector rows.")
        except Exception as ex:
            print(f"❌ Batch critical ingestion fault: {ex}")
        finally:
            await conn.close()
