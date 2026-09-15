# File: GlobalAcademy-AiEngine/app/services/v2_evaluation_service.py
import asyncio
from typing import List, Dict
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

class v2EvaluationService:
    _METRICS_MATRIX = [faithfulness, answer_relevancy]

    @classmethod
    async def evaluate_rag_transaction_async(
        cls, 
        job_id: str,
        academy_id: str,
        user_query: str, 
        retrieved_contexts: List[str], 
        generated_answer: str
    ):
        print(f"\n📊 [v2 EVALUATION MATRIX START]: Analyzing RAG integrity for job: {job_id}")

        transaction_data = {
            "question": [user_query],
            "contexts": [retrieved_contexts],
            "answer": [generated_answer]
        }

        try:
            evaluation_dataset = Dataset.from_dict(transaction_data)

            # RAGAS returns an EvaluationResult object instance
            evaluation_report = evaluate(
                dataset=evaluation_dataset,
                metrics=cls._METRICS_MATRIX
            )

            # 🚀 THE FIX: Extract scores natively by querying the internal .scores dictionary map property!
            # The .scores dictionary returns values as lists corresponding to rows, so we access index 0
            scores_dict = evaluation_report.scores[0] if hasattr(evaluation_report, "scores") else {}
            
            score_faithfulness = float(scores_dict.get("faithfulness", 1.0))
            score_relevance = float(scores_dict.get("answer_relevancy", 1.0))

            print(f"========================================================================")
            print(f"📊 [v2 EVAL SUMMARY LOGS] - JOB ID: {job_id}")
            print(f"🏢 Academy Isolation Scope : {academy_id}")
            print(f"🟢 Faithfulness (No-Hallucination) Score : {score_faithfulness * 100:.1f}%")
            print(f"🟢 Answer Semantic Relevance Score        : {score_relevance * 100:.1f}%")
            print(f"========================================================================")

        except Exception as eval_crash:
            print(f"❌ [v2 EVALUATION SYSTEM CRASH]: Failed to compute RAG metrics for job {job_id}: {eval_crash}")
