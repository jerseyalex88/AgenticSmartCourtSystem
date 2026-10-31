# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/nodes/synthesis_node.py
# DESCRIPTION: Node B - LLM Evaluation worker utilizing anchored context chunks
# =========================================================================

from models.state import AgenticWorkflowState
from config.settings import settings
import openai

class SynthesisNode:
    """Node B: Generates deterministic court status evaluations via LLM prompting."""
    
    @staticmethod
    async def process_async(state: AgenticWorkflowState) -> AgenticWorkflowState:
        print("🤖 [NODE B]: Starting context anchoring evaluation loop...")
        state.execution_steps_history.append("SynthesisNode_Start")
        
        if not state.open_courts:
            print("🤖 [NODE B]: No active courts available in memory state. Exiting pipeline early.")
            state.execution_status = "Complete"
            return state
            
        # Compile the extracted RAG rule chunks into a single reference block
        rules_context = "\n".join([
            f"- [{rule.topic}]: {rule.rule_text}" 
            for rule in state.matched_rules
        ])
        
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Evaluate each individual court asset sequentially against the reference rules
        for court in state.open_courts:
            print(f"🤖 [NODE B]: Appraising asset '{court.name}' ({court.court_id})...")
            
            system_prompt = (
                "You are an expert sports facility maintenance compliance auditor. Your job is to evaluate "
                "an active court asset against a set of institutional maintenance guidelines and provide a "
                "concise, deterministic risk appraisal summary."
            )
            
            user_content = (
                f"Target Asset: {court.name} (Type: {court.court_type}, Status: {court.status})\n"
                f"Reference Compliance Guidelines:\n{rules_context}\n\n"
                "Task: Synthesize an evaluation summary checking if this court meets basic operational safety standards. "
                "Be direct, avoid extra introductory text, and conclude with a risk designation string token (Pass/Action_Required)."
            )
            
            try:
                response = await client.chat.completions.create(
                    model=settings.LLM_MODEL_NAME,
                    temperature=settings.LLM_TEMPERATURE,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ]
                )
                
                evaluation_summary = response.choices[0].message.content or "Failed to extract completion values."
                state.compiled_evaluations[court.court_id] = evaluation_summary.strip()
                
            except Exception as e:
                error_fallback = f"LLM Generation interrupted due to model connection fault: {str(e)}"
                state.compiled_evaluations[court.court_id] = error_fallback
                print(f"⚠️ [NODE B ERROR]: Call failed for asset {court.court_id}: {e}")
                
        state.execution_status = "Complete"
        state.execution_steps_history.append("SynthesisNode_Complete")
        return state
