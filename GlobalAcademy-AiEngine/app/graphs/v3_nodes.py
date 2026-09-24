# File: GlobalAcademy-AiEngine/app/graphs/v3_nodes.py
import json
import asyncpg
from uuid import UUID
from openai import AsyncOpenAI
from app.config import settings
from app.graphs.v3_agent_state import AgentState, ExecutionStatusEnum, PendingApprovalPayload

class EnvironmentAuditOrchestrator:
    """
    Centralized Supervisor/Coordinator Agent Node for Scenario 4.
    Decomposes the high-humidity crisis telemetry, maps out the worker execution matrix,
    and handles state shifts for the Harness Engineering Layer.
    """

    @classmethod
    async def supervisor_coordinator_node(cls, state: AgentState) -> AgentState:
        """
        Analyzes incoming context, verifies security boundaries, and routes execution
        sequentially between Workers A, B, and C.
        """
        print(f"🧠 [SUPERVISOR] Processing Thread {state.thread_id} for Academy: {state.academy_id}")
        
        # Security Assertion: Enforce that only authorized Director profiles trigger this orchestration tree
        authorized_roles = ["AcademyDirector", "GlobalAdmin"]
        if state.user_role not in authorized_roles:
            state.execution_status = ExecutionStatusEnum.ABORTED_CIRCUIT_BREAKER
            state.active_agent_response = "[SECURITY ALERT]: Access Denied. Role footprint is unauthorized to invoke environmental override streams."
            return state

        # Initialize tracking variable inside the state text channels if it's the first sweep
        if not state.active_agent_response:
            state.active_agent_response = "🔄 [Supervisor initialized execution track]: Telemetry anomaly detected."

        # Core Routing Engine / Task Decomposition Matrix
        # Step 1: Delegate to Worker A if no compliance text data has been extracted yet
        if not state.context_retrieved_chunks:
            print("➡️ Routing stream to Worker A (Legal & Compliance RAG)...")
            state.active_agent_response += "\n↳ Routing to Worker A to cross-reference insurance liability clauses."
            # We append a tag so our router knows who to pass execution to next
            state.active_telemetry_snapshot_ids = [] # Reset active snapshots for the fresh run
            return state

        # Step 2: Once Worker A retrieves documentation text chunks, route to Worker B (IoT / Court Status)
        if "Court rows locked to Maintenance_Locked" not in state.active_agent_response:
            print("➡️ Routing stream to Worker B (IoT & Facilities Operations)...")
            state.active_agent_response += "\n↳ Routing to Worker B to dispatch structural status overrides on Court telemetry rows."
            return state

        # Step 3: Once Worker B completes court locking, route to Worker C (Financial Ledger / Refunds)
        if state.execution_status == ExecutionStatusEnum.ACTIVE:
            print("➡️ Routing stream to Worker C (Financial Ledger & Scheduling)...")
            state.active_agent_response += "\n↳ Routing to Worker C to isolate affected player reservations and calculate refund balances."
            return state

        return state

class WorkerALegalCompliance:
    """
    Worker A: Legal & Compliance RAG Engine.
    Handles semantic retrieval over policy documents and insurance manuals,
    natively obeying multi-tenant database isolation boundaries.
    """

    @classmethod
    async def legal_compliance_rag_node(cls, state: AgentState) -> AgentState:
        """
        Generates text embeddings from the humidity alert input context, performs a 
        filtered multi-tenant vector similarity search, and captures compliance text chunks.
        """
        print(f"📖 [WORKER A] Executing multi-tenant RAG search for Tenant: {state.academy_id}")
        
        # 1. Initialize the Async OpenAI Client using existing configuration parameters
        openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        
        # 2. Generate vector coordinates representing the semantic meaning of the crisis prompt
        rag_query_focus = "indoor humidity limits environmental safety insurance policy breach penalties"
        
        try:
            response = await openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=rag_query_focus
            )
            query_vector = response.data.embedding
        except Exception as ex:
            print(f"❌ [WORKER A ERR] Embedding extraction failed: {ex}")
            state.active_agent_response += "\n⚠️ Worker A failed to calculate semantic vector embedding coordinates."
            return state

        # 3. Connect to the shared database instance using your asyncpg connection loop pattern
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            # Enforce strict multi-tenant typing mapping guidelines
            clean_tenant_uuid = UUID(str(state.academy_id).strip())
            
            # Execute a cosine distance similarity query over the CourtMaintenanceKnowledge table,
            # applying an iron-clad multi-tenant WHERE query firewall filter!
            query = """
                SELECT "TextChunkContent", "DocumentName", "PageNumber", "Embedding" <=> $1::vector AS distance
                FROM public."CourtMaintenanceKnowledge"
                WHERE "AcademyId" = $2::uuid
                  AND "DocumentName" ILIKE '%compliance%'
                ORDER BY distance ASC
                LIMIT 3;
            """
            
            rows = await conn.fetch(query, str(query_vector), clean_tenant_uuid)
            
            if not rows:
                # Direct transparent fallback reporting rule mapping
                state.context_retrieved_chunks = []
                state.active_agent_response += "\n❌ Worker A: No matching compliance document records located inside PostgreSQL knowledge base."
            else:
                for row in rows:
                    chunk_text = f"[{row['DocumentName']} - Page {row['PageNumber']}]: {row['TextChunkContent']}"
                    state.context_retrieved_chunks.append(chunk_text)
                
                state.active_agent_response += f"\n✅ Worker A successfully extracted {len(rows)} operational policy document chunks via pgvector search."
                
        except Exception as db_ex:
            print(f"❌ [WORKER A ERR] Database RAG execution trace failed: {db_ex}")
            state.active_agent_response += f"\n⚠️ Worker A database RAG fault: {db_ex}"
        finally:
            await conn.close()

        return state

class WorkerBFacilitiesIoT:
    """
    Worker B: Facilities, Telemetry & IoT Operations Engine.
    Handles automated court status updates, environmental sensor monitoring overrides,
    and mechanical facility lockouts within strict multi-tenant boundaries.
    """

    @classmethod
    async def facilities_iot_override_node(cls, state: AgentState) -> AgentState:
        """
        Locks out all indoor and outdoor tennis courts affected by the environmental deluge
        that are not already locked, and activates high-capacity HVAC/drainage overrides.
        """
        print(f"⚡ [WORKER B] Executing mechanical asset override for Branch: {state.branch_id}")
        
        # Connect to the shared database instance using your asyncpg connection loop pattern
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            clean_tenant_uuid = UUID(str(state.academy_id).strip())
            clean_branch_uuid = UUID(str(state.branch_id).strip())
            
            # 1. Isolate and identify all indoor AND outdoor courts for this branch 
            # whose current status is NOT already 'Maintenance_Locked'
            find_courts_query = """
                SELECT "Id", "Name", "IsIndoor", "Status"
                FROM public."Courts"
                WHERE "AcademyId" = $1::uuid 
                  AND "BranchId" = $2::uuid 
                  AND "Status" <> 'Maintenance_Locked';
            """
            
            target_courts = await conn.fetch(find_courts_query, clean_tenant_uuid, clean_branch_uuid)
            
            if not target_courts:
                state.active_agent_response += "\n⚠️ Worker B: No active court assets require status updates at this branch location."
                return state
                
            locked_court_names = []
            
            # 2. Open an explicit atomic database transaction block to lock court states securely
            async with conn.transaction():
                for court in target_courts:
                    court_id = court["Id"]
                    court_name = court["Name"]
                    
                    # Update row properties: Switch status to Maintenance_Locked
                    update_query = """
                        UPDATE public."Courts"
                        SET "Status" = 'Maintenance_Locked'
                        WHERE "Id" = $1::uuid
                          AND "AcademyId" = $2::uuid;
                    """
                    await conn.execute(update_query, court_id, clean_tenant_uuid)
                    
                    # Append the affected primary keys to state channels for downstream Worker C tracking
                    state.active_telemetry_snapshot_ids.append(court_id)
                    locked_court_names.append(court_name)
            
            # 3. Trigger mock mechanical system telemetry overrides over the local device infrastructure
            hvac_override_log = (
                f"[SYSTEM OVERRIDE]: Dispatched environmental response commands to IOT array. "
                f"Air systems and facility infrastructure overrides activated for: {', '.join(locked_court_names)}."
            )
            print(f"📡 {hvac_override_log}")
            
            # Append success indicator text strings so the Supervisor node maps out the next execution gate
            state.active_agent_response += (
                f"\n✅ Worker B: Court rows locked to Maintenance_Locked for ({', '.join(locked_court_names)}). "
                f"Asynchronous HVAC ventilation array activated to maximum override capacity."
            )
            
        except Exception as db_ex:
            print(f"❌ [WORKER B ERR] Facility override sequence broken: {db_ex}")
            state.active_agent_response += f"\n⚠️ Worker B facilities lockout fault: {db_ex}"
        finally:
            await conn.close()

        return state

class WorkerCFinancialLedger:
    """
    Worker C: Financial Ledger & Scheduling Engine.
    Identifies affected player reservations on locked assets, calculates total financial balances,
    routes tracking rows to the Shadow Queue, and engages the Human-In-The-Loop approval gate.
    """

    @classmethod
    async def ledger_scheduling_mitigation_node(cls, state: AgentState) -> AgentState:
        """
        Queries upcoming active bookings on affected courts, estimates refund costs,
        stages the database update payload, and pauses execution for director validation.
        """
        print(f"💰 [WORKER C] Executing ledger isolation audit for Tenant: {state.academy_id}")
        
        if not state.active_telemetry_snapshot_ids:
            state.active_agent_response += "\n⚠️ Worker C: No affected court IDs available to audit scheduling impacts."
            return state

        # Connect to the shared database instance using your asyncpg connection loop pattern
        conn = await asyncpg.connect(settings.postgres_connection_string)
        
        try:
            clean_tenant_uuid = UUID(str(state.academy_id).strip())
            
            # Map out court UUID strings explicitly for sql array unpacking compatibility
            court_uuids = [UUID(str(cid).strip()) for cid in state.active_telemetry_snapshot_ids]
            
            # 1. Fetch upcoming active bookings assigned to the disabled court assets
            # Filters out already cancelled slots to prevent double-crediting anomalies
            find_bookings_query = """
                SELECT "Id", "BookedByUserId", "BookedPlayerName", "PricePaid", "CourtName", "StartTimeUtc", "EndTimeUtc"
                FROM public."Bookings"
                WHERE "AcademyId" = $1::uuid
                  AND "CourtId" = ANY($2::uuid[])
                  AND "Status" <> 'Cancelled'
                  AND "StartTimeUtc" >= NOW() AT TIME ZONE 'utc';
            """
            
            affected_bookings = await conn.fetch(find_bookings_query, clean_tenant_uuid, court_uuids)
            
            if not affected_bookings:
                state.active_agent_response += "\n✅ Worker C: No active upcoming player bookings are impacted by the court safety locks."
                state.execution_status = ExecutionStatusEnum.COMPLETED
                return state

            total_refund_sum = 0.0
            staged_booking_ids = []
            shadow_queue_records = []
            
            # 2. Compile calculations and prepare structural JSON payload entries for the state harness
            for booking in affected_bookings:
                price = float(booking["PricePaid"])
                total_refund_sum += price
                staged_booking_ids.append(str(booking["Id"]))
                
                # Setup structural entity rows mapping to your C# ShadowQueue entity definition parameters
                shadow_record = {
                    "Id": str(uuid4()),
                    "AcademyId": str(state.academy_id),
                    "OriginalCourtId": str(state.active_telemetry_snapshot_ids[0]), # reference point anchor
                    "PlayerUserId": booking["BookedByUserId"],
                    "PlayerName": booking["BookedPlayerName"] or "Unknown Player",
                    "OriginalStartTimeUtc": booking["StartTimeUtc"].isoformat() if hasattr(booking["StartTimeUtc"], 'isoformat') else str(booking["StartTimeUtc"]),
                    "OriginalEndTimeUtc": booking["EndTimeUtc"].isoformat() if hasattr(booking["EndTimeUtc"], 'isoformat') else str(booking["EndTimeUtc"]),
                    "QueueStatus": "Pending_Reschedule",
                    "DisplacementReason": "Environmental Telemetry Deluge Lockout",
                    "IsResolved": False,
                    "AssociatedBookingId": str(booking["Id"])
                }
                shadow_queue_records.append(shadow_record)

            # 3. Formulate the explicit Staged Payload for the Harness Engineering layer
            # This structured contract will be sent directly up the SignalR/WebSocket pipe to React
            approval_payload = PendingApprovalPayload(
                target_worker="WorkerCFinancialLedger",
                action_type="Consolidated_Refund_And_Displacement",
                suggested_payload={
                    "booking_ids_to_cancel": staged_booking_ids,
                    "shadow_queue_records_to_insert": shadow_queue_records,
                    "total_credit_reversal_amount": total_refund_sum
                },
                audit_rationale=(
                    f"Identified {len(affected_bookings)} upcoming member slots impacted by environmental safety locks. "
                    f"Requires a total credit reversal of ${total_refund_sum:.2f} and automatic tracking relocation "
                    f"to the ShadowQueue platform layer."
                )
            )

            # 4. ENGAGE THE HARNESS CIRCUIT BREAKER HOOK: Suspend graph threads indefinitely
            state.pending_approval_gate = approval_payload
            state.execution_status = ExecutionStatusEnum.PAUSED_PENDING_APPROVAL
            
            state.active_agent_response += (
                f"\n🛑 [HARNESS BLOCK]: Worker C generated a pending financial refund boundary matrix. "
                f"Graph state execution frozen at thread checkpoint. Awaiting Director manual validation override "
                f"to release ${total_refund_sum:.2f} player transaction credits."
            )

        except Exception as db_ex:
            print(f"❌ [WORKER C ERR] Scheduling audit trace aborted: {db_ex}")
            state.active_agent_response += f"\n⚠️ Worker C ledger calculation fault: {db_ex}"
        finally:
            await conn.close()

        return state
