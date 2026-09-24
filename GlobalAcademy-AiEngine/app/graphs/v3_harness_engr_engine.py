import tiktoken
from fastapi import HTTPException
from app.graphs.v3_agent_state import AgentState, ExecutionStatusEnum

class HarnessEngineeringEngine:
    @staticmethod
    def calculate_string_tokens(text: str, model_encoding: str = "cl100k_base") -> int:
        """Accurately calculates token size of text arrays using tiktoken."""
        try:
            encoding = tiktoken.get_encoding(model_encoding)
            return len(encoding.encode(text))
        except Exception:
            # Fallback estimation if encoding fails to load in isolated runtimes
            return len(text) // 4

    @classmethod
    def evaluate_harness_guardrails(cls, state: AgentState) -> AgentState:
        """
        Validates token footprints and execution iteration patterns against constraints.
        If thresholds are passed, it enforces a fallback circuit breaker configuration.
        """
        # 1. Enforce Iteration Circuit Breaker
        if state.harness_metrics.current_loop_count >= state.harness_metrics.max_loop_threshold:
            state.execution_status = ExecutionStatusEnum.ABORTED_CIRCUIT_BREAKER
            state.active_agent_response = (
                "[HARNESS CIRCUIT BREAKER] Maximum multi-agent loop boundary threshold breached (6 iterations Max). "
                "Task halted autonomously to prevent circular processing degradation."
            )
            return state

        # 2. Enforce Context Window Token Budgeting Cap
        # Combine entire state data to inspect total footprint volume
        combined_text_footprint = (
            state.raw_input_prompt 
            + state.active_agent_response 
            + "".join(state.context_retrieved_chunks)
        )
        current_tokens = cls.calculate_string_tokens(combined_text_footprint)
        state.harness_metrics.total_tokens_consumed = current_tokens

        if state.harness_metrics.total_tokens_consumed >= state.harness_metrics.token_budget_cap:
            # Automatically trim the oldest context chunks to free up token memory
            if len(state.context_retrieved_chunks) > 1:
                # Compression optimization step
                state.context_retrieved_chunks = state.context_retrieved_chunks[-1:]
                # Re-calculate
                state.harness_metrics.total_tokens_consumed = cls.calculate_string_tokens(
                    state.raw_input_prompt + state.active_agent_response + state.context_retrieved_chunks[0]
                )
            else:
                state.execution_status = ExecutionStatusEnum.ABORTED_CIRCUIT_BREAKER
                state.active_agent_response = "[HARNESS COMPRESSION FAILURE] Out of token memory budget bounds."
                
        return state
