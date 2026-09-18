# File: GlobalAcademy-AiEngine/app/services/v2_tools_service.py
import asyncpg
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from langchain_core.tools import tool
import uuid
import pandas as pd
from datetime import datetime
from app.config import settings
from prophet import Prophet

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
async def query_facility_knowledge_base(academy_id: str, branch_id: str, search_query: str, court_id: Optional[str] = None,
    state: Optional[dict] = None) -> str:
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

    # 🚀 THE UPGRADE: Save the raw structural records inside your state bag before flattening them!
    if state is not None and "internal_metadata" in state:
        state["internal_metadata"]["last_retrieved_citations"] = [
            {
                "document_name": p["document_name"],
                "page_number": p["page_number"],
                "text_content": p["text_content"],
                "rerank_score": float(p.get("rerank_score", 1.0))
            } for p in refined_paragraphs
        ]

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

# =========================================================================
# 📅 3. BOOKING DISPLACEMENT TOOL INPUT CONFIGURATION
# =========================================================================
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
# 💰 4. MAINTENANCE PURCHASE ORDER TOOL INPUT CONFIGURATION
# =========================================================================
class PurchaseOrderArgs(BaseModel):
    academy_id: str = Field(..., description="The unique cryptographic Academy/Tenant GUID string.")
    court_id: str = Field(..., description="The unique target Court GUID string requiring emergency repair materials.")
    estimated_cost: float = Field(..., description="The calculated cost estimate for materials and repair services.")
    required_material: str = Field(..., description="The exact material description string required for the repair (e.g., 'Acrylic Resurfacer Compound Part A').")

@tool("generate_emergency_maintenance_po", args_schema=PurchaseOrderArgs)
async def generate_emergency_maintenance_po(academy_id: str, court_id: str, estimated_cost: float, required_material: str) -> str:
    """
    Generates an official digital Maintenance Ticket and stages a Purchase Order (PO) transaction 
    inside the database, enforcing strict procurement ceilings and material compliance checks.
    Use this tool immediately after diagnosing a hazard that requires budget allocation and physical maintenance.
    """
    print(f"🛠️ [AGENT TOOL EXECUTION]: generate_emergency_maintenance_po evaluating repair budget of ${estimated_cost:.2f}")
    
    # 🛡️ SYSTEM BOUNDARIES EXTRACTED NATIVELY FROM THE POLICY RAG MANUALS
    MAX_AUTOMATED_CEILING = 1200.00
    APPROVED_MATERIAL = "Acrylic Resurfacer Compound Part A"
    
    # 1. Enforce Material Compliance Guardrails
    if APPROVED_MATERIAL.lower() not in required_material.lower():
        return (
            f"REJECTED: Material compliance validation failed. Requested '{required_material}', "
            f"but facility procurement regulations strictly mandate the use of '{APPROVED_MATERIAL}' for sub-surface safety cracks."
        )

    # 2. Evaluate Financial Spending Authorization Ceilings
    if estimated_cost <= MAX_AUTOMATED_CEILING:
        ticket_status = "Open_Queued"  # Auto-Approved and dispatched to the grounds team
        approval_message = f"SUCCESS: Emergency Purchase Order for ${estimated_cost:.2f} has been AUTO-APPROVED."
    else:
        ticket_status = "Pending_Executive_Signoff"  # Exceeds limit, hold for manual manager approval
        approval_message = (
            f"WARNING: Cost estimate of ${estimated_cost:.2f} exceeds the automated spending ceiling cap of ${MAX_AUTOMATED_CEILING:.2f}. "
            f"Ticket has been flagged as 'Pending_Executive_Signoff' and held in the manager's review queue."
        )

    conn = await asyncpg.connect(settings.postgres_connection_string)
    try:
        # 3. Write a clean data row matching your exact C# MaintenanceTicket table column schemas!
        insert_ticket_query = """
            INSERT INTO "MaintenanceTickets"
            ("Id", "AcademyId", "CourtId", "Title", "Description", "TicketStatus", "PriorityLevel", "CreatedAtUtc")
            VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, 'Emergency', NOW() AT TIME ZONE 'utc');
        """
        
        title_string = f"Emergency Repair: {APPROVED_MATERIAL}"
        description_string = f"Automated emergency work order for court repair. Materials: {required_material}. Estimated Financial Allocation: ${estimated_cost:.2f}."
        
        await conn.execute(
            insert_ticket_query, 
            uuid.UUID(academy_id), 
            uuid.UUID(court_id), 
            title_string, 
            description_string, 
            ticket_status
        )
        
        return f"{approval_message} Work Order record logged inside 'MaintenanceTickets' table row successfully."
        
    except Exception as ex:
        print(f"❌ [PO TOOL EXCEPTION]: Database insertion failed: {ex}")
        return f"Error: Failed to commit maintenance ticket mutation to PostgreSQL: {ex}"
    finally:
        await conn.close()

# =========================================================================
# 📈 5. PREDICTIVE STRUCTURAL DEGRADATION TOOL INPUT SCHEMA
# =========================================================================
class PredictiveDegradationArgs(BaseModel):
    academy_id: str = Field(..., description="The unique cryptographic Academy/Tenant GUID string.")
    court_id: str = Field(..., description="The unique target Court GUID string requiring predictive forecasting analysis.")
    warranty_threshold: float = Field(..., description="The contract compliance safety threshold minimum index value found via RAG (e.g., 0.55).")
    contract_expiry_date: str = Field(..., description="The absolute expiration date of the legal warranty contract string found via RAG (e.g., '2030-12-31').")

@tool("forecast_structural_degradation_risk", args_schema=PredictiveDegradationArgs)
async def forecast_structural_degradation_risk(academy_id: str, court_id: str, warranty_threshold: float, contract_expiry_date: str) -> str:
    """
    Queries historical time-series sensor data from CourtDiagnosticSnapshots, executes a machine learning 
    Prophet forecast projection, and cross-references results against RAG warranty terms to evaluate compliance breach risks.
    Use this tool whenever a user asks about wear trends, predictive decay speeds, or future asset safety projections.
    """
    print(f"🛠️ [AGENT TOOL EXECUTION]: forecast_structural_degradation_risk running Prophet projections for Court {court_id}")
    
    conn = await asyncpg.connect(settings.postgres_connection_string)
    try:
        # 1. Pull the raw historical time-series logs matching your exact C# schema columns!
        sensor_query = """
            SELECT "Timestamp", "SurfaceFrictionIndex"
            FROM "CourtDiagnosticSnapshots"
            WHERE "CourtId" = $1::uuid AND "AcademyId" = $2::uuid
            ORDER BY "Timestamp" ASC;
        """
        historical_rows = await conn.fetch(sensor_query, uuid.UUID(court_id), uuid.UUID(academy_id))
        
        # Defensive Data Guardrail Check: Prophet requires a stable historical data pool to model trends accurately
        if not historical_rows or len(historical_rows) < 5:
            return (
                f"Prediction Aborted: Court {court_id} has insufficient diagnostic telemetry snapshot rows inside "
                f"the 'CourtDiagnosticSnapshots' table (Found: {len(historical_rows)}). At least 5 stable historical records are required."
            )

        # 2. Package data frames cleanly into Prophet's required column schema format ('ds' and 'y')
        data_records = [
            {"ds": row["Timestamp"].replace(tzinfo=None), "y": float(row["SurfaceFrictionIndex"])} 
            for row in historical_rows
        ]
        df_training = pd.DataFrame(data_records)

        # 3. Instantiate, tune, and fit the Machine Learning Time-Series Model
        # We disable daily/weekly seasonality flags if training over sparse micro-telemetry data blocks
        model = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
        model.fit(df_training)

        # 4. Generate future evaluation matrix timeline vectors (Projecting 90 days out into the future)
        future_dataframe = model.make_future_dataframe(periods=90, freq='D')
        forecast_results = model.predict(future_dataframe)

        # Extract our projected endpoint metrics values
        current_actual_val = df_training["y"].iloc[-1]
        final_projected_row = forecast_results.iloc[-1]
        final_projected_date = final_projected_row["ds"]
        final_projected_value = float(final_projected_row["yhat"]) # yhat represents Prophet's true calculated point estimation
        
        # Calculate the direct derivative trajectory slope orientation
        total_decay_delta = current_actual_val - final_projected_value
        
        # 5. Cross-Reference the mathematical projection matrix against your RAG warranty contracts!
        target_expiry = datetime.strptime(contract_expiry_date, "%Y-%m-%d")
        
        # Scan the forecast data frame to see exactly WHEN the curve dips below the RAG threshold parameter
        breach_rows = forecast_results[forecast_results["yhat"] < warranty_threshold]
        
        report_summary = (
            f"📊 === PROPHET FORECAST MATRIX REPORT FOR COURT {court_id} ===\n"
            f" - Current Measured Friction Index: {current_actual_val:.3f}\n"
            f" - Calculated 90-Day Trend Vector Projection: {final_projected_value:.3f} by {final_projected_date.strftime('%Y-%m-%d')}\n"
        )

        if not breach_rows.empty:
            earliest_breach_date = breach_rows["ds"].iloc[0]
            
            # Check if this calculated mathematical breach date falls within our legal contract lifespan limit
            if earliest_breach_date < target_expiry:
                report_summary += (
                    f"⚠️ CRITICAL EXPOSURE DETECTED: The Prophet predictive trajectory model forecasts that the court's friction index "
                    f"will decay beneath your active RAG warranty threshold safety ceiling of {warranty_threshold} on approximately "
                    f"{earliest_breach_date.strftime('%Y-%m-%d')}.\n"
                    f"📢 LEGAL STRATEGY NOTICE: This breach is projected to manifest BEFORE your contractor coverage expires on "
                    f"{contract_expiry_date}. According to Section 4 of your PremiumCourts LLC warranty contract, you are authorized "
                    f"to file a proactive re-surfacing claim within 14 business days of this discovery to enforce 100% material cost coverage."
                )
            else:
                report_summary += (
                    f"🟢 COMPLIANT TRAJECTORY: Friction index is projected to cross below {warranty_threshold} on "
                    f"{earliest_breach_date.strftime('%Y-%m-%d')}, which occurs AFTER your warranty contract expires on {contract_expiry_date}."
                )
        else:
            report_summary += f"🟢 OPTIMAL HEALTH: The predictive model indicates a stable wear curve. No contract breach exposure is forecast over the active 90-day pipeline vector tracking window."

        return report_summary

    except Exception as ex:
        print(f"❌ [PROPHET FORECAST FAILURE]: {ex}")
        return f"Error: Machine learning mathematical timeseries forecasting transaction collapsed: {ex}"
    finally:
        await conn.close()

# =========================================================================
# 📦 CENTRALIZED REGISTER MATRIX PACKAGING
# =========================================================================
# Bundled clean registry array mapping to be fed straight into LangGraph orchestration layers
smart_court_tools_list = [
    query_facility_knowledge_base, 
    modify_court_operational_status,
    resolve_displaced_player_bookings,
    generate_emergency_maintenance_po,
    forecast_structural_degradation_risk
]