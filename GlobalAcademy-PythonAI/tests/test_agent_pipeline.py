# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/tests/test_agent_pipeline.py
# DESCRIPTION: Live E2E Read-Only PostgreSQL assertion pipeline verification script
# =========================================================================

import pytest
import asyncio
from sqlalchemy import select
from unittest.mock import MagicMock, patch
from database.models import CourtEntityModel
from models.state import AgenticWorkflowState
from nodes.ingestion_node import IngestionNode
from nodes.synthesis_node import SynthesisNode

@pytest.mark.asyncio
async def test_complete_agentic_workflow_over_live_postgres(live_read_only_session):
    """
    Verifies that Node A executes queries against real PostgreSQL container tables,
    extracts the first live open court asset, and matches anchoring compliance rules.
    """
    db_session = live_read_only_session
    
    # 🚀 PRE-FLIGHT CHECK: Fetch the absolute first active open court from your real database container
    check_stmt = select(CourtEntityModel).where(
        CourtEntityModel.Status == "Open",
        CourtEntityModel.IsDecommissioned == False
    ).limit(1)
    
    result = await db_session.execute(check_stmt)
    live_target_court = result.scalar_one_or_none()
    
    if not live_target_court:
        pytest.skip("Database Notice: No records currently feature a Status='Open' state inside the Courts table. Skipping E2E test.")
        
    # Capture the real, active database primary key identifier GUID
    target_court_id = str(live_target_court.Id)
    expected_court_name = live_target_court.Name
    print(f"\n🎯 [E2E TEST]: Targeted live database court asset index: '{expected_court_name}' ({target_court_id})")

    # Initialize our centralized state model schema contract
    state = AgenticWorkflowState(target_tenant_id=str(live_target_court.AcademyId))
    
    # 🚀 STEP 1: VERIFY NODE A INGESTION OVER THE LIVE POSTGRES CONTAINER
    with patch("nodes.ingestion_node.get_async_db_session") as mock_db_ctx:
        mock_db_ctx.return_value.__aenter__.return_value = db_session
        
        updated_state = await IngestionNode.process_async(state)
        
        # LIVE RE-HYDRATION ASSERTIONS: Verify that Node A successfully extracted your active record
        assert len(updated_state.open_courts) >= 1
        
        # Locate your specific targeted live court inside the extracted array collection
        live_extracted_court = next((c for c in updated_state.open_courts if c.court_id == target_court_id), None)
        assert live_extracted_court is not None, f"Fail: Active court {target_court_id} was not pulled by Node A."
        assert live_extracted_court.name == expected_court_name
        assert "IngestionNode_Complete" in updated_state.execution_steps_history

    # 🚀 STEP 2: VERIFY NODE B EVALUATION PROCESSOR WITH A TRUE ASYNC FUTURE
    # We patch the complete async client creation path to return an airtight mock structure
    with patch("openai.AsyncOpenAI") as mock_openai_class:
        mock_client_instance = MagicMock()
        mock_openai_class.return_value = mock_client_instance
        
        # 1. Build out the nested model response mock nodes
        mock_choice = MagicMock()
        mock_choice.message.content = f"[AUDIT SUCCESS]: {expected_court_name} processed. Status: Pass."
        
        mock_response_payload = MagicMock()
        mock_response_payload.choices = [mock_choice]
        
        # 2. FIXED: Create a true, native python concurrent Future contract wrapper!
        # This tells the python interpreter that this object is 100% safe to be used with the 'await' keyword.
        async_future = asyncio.Future()
        async_future.set_result(mock_response_payload)
        
        # Assign the future directly to the nested .create execution endpoint handler
        mock_client_instance.chat.completions.create.return_value = async_future
        
        # Execute Node B natively
        final_state = await SynthesisNode.process_async(updated_state)
        
        # ASSERTION ALIGNMENT: Check the evaluations map using the real court ID
        assert target_court_id in final_state.compiled_evaluations
        assert "Pass" in final_state.compiled_evaluations[target_court_id]
        assert final_state.execution_status == "Complete"
        assert "SynthesisNode_Complete" in final_state.execution_steps_history
