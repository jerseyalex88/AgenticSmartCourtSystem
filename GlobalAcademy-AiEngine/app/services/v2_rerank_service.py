# File: GlobalAcademy-AiEngine/app/services/v2_rerank_service.py
from typing import List, Dict
from sentence_transformers import CrossEncoder

class v2RerankService:
    # 🚀 SECURE FIXED INITIALIZATION: Points explicitly to the official global cross-encoder account repo path
    try:
        _ranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        print("🧬 [v2 RERANK SERVICE]: Standard Cross-Encoder core engine compiled successfully in memory.")
    except Exception as init_err:
        print(f"⚠️ [v2 RERANK SERVICE INIT FAULT]: Failed to boot local Cross-Encoder libraries: {init_err}")
        _ranker = None

    @classmethod
    def re_score_and_filter_context(
        cls, 
        query_text: str, 
        raw_hybrid_results: List[Dict], 
        top_n: int = 3, 
        min_relevance_threshold: float = 0.15
    ) -> List[Dict]:
        if not raw_hybrid_results or cls._ranker is None:
            # Fallback gracefully to standard database vector sorting if initialization fails
            return sorted(raw_hybrid_results, key=lambda x: x["dense_score"], reverse=True)[:top_n]

        try:
            # 1. Package the matching query/passage data pairs for evaluation
            evaluation_pairs = [[query_text, item["text_content"]] for item in raw_hybrid_results]
            
            # 2. Compute exact semantic prediction scores natively across local CPU layers
            raw_scores = cls._ranker.predict(evaluation_pairs)
            
            # 3. Re-map and filter your objects cleanly based on the new weights
            optimized_context_blocks = []
            for idx, item in enumerate(raw_hybrid_results):
                score = float(raw_scores[idx])
                
                # Filter out irrelevant text blocks
                if score >= min_relevance_threshold:
                    optimized_context_blocks.append({
                        "id": item["id"],
                        "text_content": item["text_content"],
                        "document_name": item["document_name"],
                        "page_number": item["page_number"],
                        "court_id": item["court_id"],
                        "rerank_score": score
                    })

            # Sort highest-relevance items directly to the top
            optimized_context_blocks.sort(key=lambda x: x["rerank_score"], reverse=True)
            
            final_trimmings = optimized_context_blocks[:top_n]
            print(f"🧬 [v2 RERANK COMPLETE]: Compressed database context block down to top {len(final_trimmings)} expert paragraphs.")
            return final_trimmings

        except Exception as eval_err:
            print(f"❌ [v2 RERANK ROUTINE FAILURE]: Cross-encoder calculation failed: {eval_err}")
            return raw_hybrid_results[:top_n]
