# File: GlobalAcademy-AiEngine/app/services/v2_tools_service.py
import asyncpg
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from langchain_core.tools import tool
import uuid

from app.config import settings
from app.services.v2_retrieval_service import v2RetrievalService
from app.services.v2_rerank_service import v2RerankService

# =========================================================================
# 📥 1. KNOWLEDGE RETRIEVAL TOOL INPUT CONFIGURATION
# =========================================================================
class KnowledgeLookupArgs(BaseModel):
    academy_id: str = Field(..., description="The unique cryptographic Academy/Tenant GUID string.")
    branch_id: str = Field(..., description="The unique Branch facility GUID string.")
    search_query: str = Field(..., description="The natural language question or keyword string targeting safety rules or maintenance parameters.")
    court_id: Optional[str] = Field(None, description="Optional specific court GUID to narrow down structural documentation limits.")

@tool("query_facility_knowledge_base", args_schema=KnowledgeLookupArgs)
async def query_facility_knowledge_base(academy_id: str, branch_id: str, search_query: str, court_id: Optional[str] = None) -> str:
    """
    Queries the multi-tenant PostgreSQL vector knowledge base using hybrid search and FlashRank reranking.
    Use this tool whenever you need to lookup safety rules, warranty thresholds, maintenance manuals, 
    or operational procedures for courts and facilities.
    """
    print(f"🛠️ [AGENT TOOL EXECUTION]: query_facility_knowledge_base targeting query '{search_query}'")
    
    # Execute your established Step 3 Hybrid Search
    raw_chunks = await v2RetrievalService.execute_hybrid_search(
        academy_id=academy_id,
        branch_id=branch_id,
        query_text=search_query,
        court_id=court_id,
        limit_results=8
    )
    
    if not raw_chunks:
        return "No specific facility reference documentation blocks discovered inside the secure database matching this query."
        
    # Execute your established Step 4 Cross-Encoder Rerank Filtering
    refined_paragraphs = v2RerankService.re_score_and_filter_context(
        query_text=search_query,
        raw_hybrid_results=raw_chunks,
        top_n=3,
        min_relevance_threshold=0.15
    )
    
    if not refined_paragraphs:
        return "Reference text matched database records but fell below the semantic relevance threshold framework."
        
    # Format the extracted paragraphs cleanly for the agent prompt context injection
    formatted_context = ""
    for idx, p in enumerate(refined_paragraphs):
        formatted_context += f"\n[Document Source Reference {idx+1}]: {p['document_name']} (Page {p['page_number']})\nText Content: \"{p['text_content']}\"\n"
        
    return formatted_context

# =========================================================================
# 🎛️ 2. COURT STATUS MODIFIER TOOL INPUT CONFIGURATION
# =========================================================================
class CourtStatusArgs(BaseModel):
    academy_id: str = Field(..., description="The unique cryptographic Academy/Tenant GUID string.")
    court_id: str = Field(..., description="The unique target Court GUID string that needs an operational status shift.")
    target_status: str = Field(..., description="The exact status code string to apply. Must be either 'Open' or 'Maintenance_Locked'.")

@tool("modify_court_operational_status", args_schema=CourtStatusArgs)
async def modify_court_operational_status(academy_id: str, court_id: str, target_status: str) -> str:
    """
    Actively writes an operational status modification directly onto a specific Court asset row inside PostgreSQL.
    Use this tool immediately when a document lookup indicates a safety breach has occurred, or when 
    a court registers metrics outside compliance limits and must be locked.
    """
    print(f"🛠️ [AGENT TOOL EXECUTION]: modify_court_operational_status transitioning Court {court_id} to '{target_status}'")
    
    if target_status not in ["Open", "Maintenance_Locked"]:
        return f"Execution rejected: '{target_status}' is an invalid state profile contract parameter."
        
    conn = await asyncpg.connect(settings.postgres_connection_string)
    try:
        # Enforce multi-tenant boundaries during the data modification sweep
        update_query = """
        UPDATE "Courts"
        SET "Status" = $1
        WHERE "Id" = $2::uuid AND "AcademyId" = $3::uuid;
        """
        status_result = await conn.execute(update_query, target_status, court_id, academy_id)
        
        # Verify if an actual row was updated or if the tenant firewall blocked it
        if "UPDATE 1" in status_result:
            return f"Success: Court asset {court_id} operational status has been updated to '{target_status}'."
        else:
            return f"Failure: No matching court found or multi-tenant boundary violation blocked execution bounds."
            
    except Exception as ex:
        print(f"❌ [TOOL DATA EXCEPTION]: Failed to execute write operation: {ex}")
        return f"Error: Database mutation transaction crashed mid-flight: {ex}"
    finally:
        await conn.close()

class ResolveDisplacementArgs(BaseModel):
    academy_id: str = Field(..., description="The unique cryptographic Academy/Tenant GUID string.")
    branch_id: str = Field(..., description="The unique Branch facility GUID string.")
    court_id: str = Field(..., description="The unique hazard Court GUID string that was locked down.")

@tool("resolve_displaced_player_bookings", args_schema=ResolveDisplacementArgs)
async def resolve_displaced_player_bookings(academy_id: str, branch_id: str, court_id: str) -> str:
    """
    Scans for active player bookings on a locked court and automatically re-routes them 
    to available slots or transfers them safely into the ShadowQueue system.
    Use this tool immediately after a court is locked down due to a safety violation or maintenance issue.
    """
    print(f"🛠️ [AGENT TOOL EXECUTION]: resolve_displaced_player_bookings executing fallback routines for Court {court_id}")
    
    conn = await asyncpg.connect(settings.postgres_connection_string)
    try:
        # 1. Isolate upcoming active bookings on the locked court for today
        # Only target bookings that are currently active ('Booked')
        bookings_query = """
            SELECT "Id", "BookedByUserId", "StartTimeUtc", "EndTimeUtc", "BookedPlayerName"
            FROM "Bookings"
            WHERE "CourtId" = $1::uuid 
              AND "AcademyId" = $2::uuid 
              AND ("StartTimeUtc" AT TIME ZONE 'UTC') >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '12 hours'
              AND ("Status" = 'Booked' OR "Status" IS NULL)
            ORDER BY "StartTimeUtc" ASC;
        """
        displaced_rows = await conn.fetch(bookings_query, uuid.UUID(court_id), uuid.UUID(academy_id))
        
        if not displaced_rows:
            return f"No upcoming active player reservations were scheduled on Court {court_id}. Scheduling metrics clear."

        summary_report = f"Processing displacement for {len(displaced_rows)} active bookings:\n"
        
        for booking in displaced_rows:
            b_id = booking["Id"]
            start = booking["StartTimeUtc"]
            end = booking["EndTimeUtc"]
            player_name = booking["BookedPlayerName"] or "Unknown Player"

            # 2. Look for an alternative open court of identical surface type with an empty slot
            find_alt_court_query = """
                SELECT c."Id", c."Name"
                FROM "Courts" c
                WHERE c."BranchId" = $1::uuid AND c."AcademyId" = $2::uuid 
                  AND c."Status" = 'Open' AND c."Id" != $3::uuid
                  AND c."Id" NOT IN (
                      SELECT "CourtId" FROM "Bookings" 
                      WHERE "StartTimeUtc" < $5 AND "EndTimeUtc" > $4
                        AND "Status" = 'Booked'
                  )
                LIMIT 1;
            """
            alt_court = await conn.fetchrow(find_alt_court_query, uuid.UUID(branch_id), uuid.UUID(academy_id), uuid.UUID(court_id), start, end)

            if alt_court:
                # 🚀 Option A: Move booking to the open court
                move_query = """
                    UPDATE "Bookings"
                    SET "CourtId" = $1, "Notes" = CONCAT("Notes", ' [Auto-Re-routed from locked court]')
                    WHERE "Id" = $2 AND "AcademyId" = $3;
                """
                await conn.execute(move_query, alt_court["Id"], b_id, uuid.UUID(academy_id))
                summary_report += f" - Moved player '{player_name}' cleanly over to '{alt_court['Name']}' ({start.strftime('%H:%M')} UTC).\n"
            else:
                # 🚀 Option B: Max capacity! Push into ShadowQueues WITH the new AssociatedBookingId link
                insert_queue_query = """
                    INSERT INTO "ShadowQueues"
                    ("Id", "AcademyId", "OriginalCourtId", "PlayerUserId", "OriginalStartTimeUtc", "OriginalEndTimeUtc", "QueueStatus", "DisplacementReason", "PlayerName", "IsResolved", "DisplacedAtUtc", "AssociatedBookingId")
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'Pending_Reschedule', 'Safety Hazard Structural Lockout', $6, FALSE, NOW() AT TIME ZONE 'utc', $7);
                """
                await conn.execute(insert_queue_query, uuid.UUID(academy_id), uuid.UUID(court_id), booking["BookedByUserId"], start, end, player_name, b_id)
                
                # 🚀 STATE MACHINE UPDATE: Instead of a toxic row DELETE, flip status cleanly to 'Cancelled'
                cancel_booking_query = """
                    UPDATE "Bookings"
                    SET "Status" = 'Cancelled',
                        "Notes" = CONCAT("Notes", ' [CANCELLED: Displaced to ShadowQueue due to structural court lockdown]')
                    WHERE "Id" = $1 AND "AcademyId" = $2::uuid;
                """
                await conn.execute(cancel_booking_query, b_id, uuid.UUID(academy_id))
                summary_report += f" - Capacity Breach! Swapped status to 'Cancelled' and queued player '{player_name}' into ShadowQueue.\n"

        return summary_report

    except Exception as ex:
        print(f"❌ [TOOL EXECUTION FAILURE]: {ex}")
        return f"Error: Scheduling mitigation failed mid-flight: {ex}"
    finally:
        await conn.close()

# =========================================================================
# 📦 CENTRALIZED REGISTER MATRIX PACKAGING
# =========================================================================
# Bundled clean registry array mapping to be fed straight into LangGraph orchestration layers
smart_court_tools_list = [
    query_facility_knowledge_base, 
    modify_court_operational_status,
    resolve_displaced_player_bookings
]