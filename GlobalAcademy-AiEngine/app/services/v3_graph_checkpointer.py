# File: GlobalAcademy-AiEngine/app/services/v3_graph_checkpointer.py
import json
from uuid import UUID
from typing import Any, Dict, Optional, Tuple
import asyncpg
from app.config import settings
from app.graphs.v3_agent_state import AgentState, ExecutionStatusEnum

class PostgresGraphCheckpointer:
    """
    Asynchronous database checkpointer mapping LangGraph runtime serialization state 
    directly to the shared PostgreSQL 'GraphStateCheckpoints' table using asyncpg,
    respecting multi-tenant isolation rules.
    """

    @classmethod
    async def get_tuple(cls, config: Dict[str, Any]) -> Optional[Tuple[AgentState, Dict[str, Any]]]:
        """
        Retrieves the latest compiled snapshot for a specific thread segment.
        Automatically handles empty session scenarios to prevent runtime dropouts.
        """
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return None

        query = """
            SELECT "AcademyId", "UserId", "ActiveNode", "SerializedState", "ContextTokenCount", "LoopIterationCount"
            FROM public."GraphStateCheckpoints"
            WHERE "ThreadId" = $1::uuid
            ORDER BY "CreatedAtUtc" DESC
            LIMIT 1;
        """
        
        conn = await asyncpg.connect(settings.postgres_connection_string)
        try:
            row = await conn.fetchrow(query, UUID(str(thread_id).strip()))
            if not row:
                return None
            
            # Unpack row metrics natively from asyncpg record object keys
            academy_id = row["AcademyId"]
            user_id = row["UserId"]
            active_node = row["ActiveNode"]
            serialized_state = row["SerializedState"]
            
            # Parse the database text back into our strongly typed Pydantic framework
            if isinstance(serialized_state, str):
                state_dict = json.loads(serialized_state)
            else:
                state_dict = serialized_state

            state = AgentState(**state_dict)
            
            metadata = {
                "source": "postgresql_harness",
                "active_node": active_node,
                "user_id": user_id,
                "academy_id": str(academy_id)
            }
            
            return state, metadata
        finally:
            await conn.close()

    @classmethod
    async def put(cls, config: Dict[str, Any], state: AgentState, active_node: str) -> str:
        """
        Atomically serializes the active state channels directly into the shared PostgreSQL row instance.
        If a container restarts mid-loop, the state is completely saved.
        """
        import uuid
        checkpoint_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO public."GraphStateCheckpoints" (
                "ThreadId", "CheckpointId", "AcademyId", "UserId", 
                "ActiveNode", "SerializedState", "ContextTokenCount", 
                "LoopIterationCount", "CreatedAtUtc"
            ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6::jsonb, $7, $8, NOW() AT TIME ZONE 'utc')
            ON CONFLICT ("ThreadId", "CheckpointId") DO UPDATE 
            SET "SerializedState" = EXCLUDED."SerializedState",
                "ContextTokenCount" = EXCLUDED."ContextTokenCount",
                "LoopIterationCount" = EXCLUDED."LoopIterationCount";
        """
        
        serialized_payload = state.model_dump_json()
        
        conn = await asyncpg.connect(settings.postgres_connection_string)
        try:
            await conn.execute(
                query,
                UUID(str(state.thread_id).strip()),
                checkpoint_id,
                UUID(str(state.academy_id).strip()),
                state.user_id,
                active_node,
                serialized_payload,
                state.harness_metrics.total_tokens_consumed,
                state.harness_metrics.current_loop_count
            )
            return checkpoint_id
        finally:
            await conn.close()
