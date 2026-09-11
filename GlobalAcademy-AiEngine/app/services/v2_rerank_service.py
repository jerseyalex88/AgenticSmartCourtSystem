# File: GlobalAcademy-AiEngine/app/services/v2_rerank_service.py
from typing import List, Dict
from flashrank import Ranker, RerankRequest

class v2RerankService:
    # 🚀 INITIALIZE LOCAL CORES: Boots an ultra-fast, CPU-optimized cross-encoder model checkpoint
    # Model defaults to ms-marco-MiniLM-L-6-v2, optimized for finding answers in paragraphs
    try:
        _ranker = Ranker(model_name="ms-marco-MiniLM-L-6-v2", cache_dir="/tmp/flashrank_cache")
        print("🧬 [v2 RERANK SERVICE]: Local Cross-Encoder core engine compiled successfully in memory.")
    except Exception as init_err:
        print(f"⚠️ [v2 RERANK SERVICE INIT FAULT]: Failed to boot local FlashRank libraries: {init_err}")
        _ranker = None

    @classmethod
    def re_score_and_filter_context(
        cls, 
        query_text: str, 
        raw_hybrid_results: List[Dict], 
        top_n: int = 3, 
        min_relevance_threshold: float = 0.25
    ) -> List[Dict]:
        """
        Takes raw blended database outputs from Step 3, re-evaluates semantic relevance 
        using a local Cross-Encoder model, and filters out low-quality noise blocks.
        """
        if not raw_hybrid_results:
            return []
            
        if cls._ranker is None:
            print("⚠️ [v2 RERANK SERVICE ALERT]: Reranker engine uninitialized. Falling back to basic dense sorting.")
            return sorted(raw_hybrid_results, key=lambda x: x["dense_score"], reverse=True)[:top_n]

        # 1. Format your database outputs into the precise payload contract expected by FlashRank
        pass_through_payload = [
            {
                "id": item["id"],
                "text": item["text_content"],
                # Keep parent columns completely intact inside the metadata bag
                "meta": {
                    "document_name": item["document_name"],
                    "page_number": item["page_number"],
                    "court_id": item["court_id"],
                    "dense_score": item["dense_score"],
                    "sparse_score": item["sparse_score"]
                }
            }
            for item in raw_hybrid_results
        ]

        try:
            # 2. Package the computational routing arguments
            rerank_request = RerankRequest(query=query_text, passages=pass_through_payload)
            
            # 3. Execute the local cross-evaluation pass across CPU hardware threads
            reranked_output = cls._ranker.rerank(rerank_request)
            
            # 4. Filter and restructure the scores cleanly back into your portal contracts
            optimized_context_blocks = []
            for item in reranked_output:
                score = float(item["score"])
                
                # Drop paragraphs that are completely irrelevant to the user's intent
                if score >= min_relevance_threshold:
                    optimized_context_blocks.append({
                        "id": item["id"],
                        "text_content": item["text"],
                        "document_name": item["meta"]["document_name"],
                        "page_number": item["meta"]["page_number"],
                        "court_id": item["meta"]["court_id"],
                        "rerank_score": score
                    })

            # Trim the response array strictly to your top N highest-quality items
            final_trimmings = optimized_context_blocks[:top_n]
            print(f"🧬 [v2 RERANK COMPLETE]: Compressed database context block from {len(raw_hybrid_results)} rows down to top {len(final_trimmings)} expert paragraphs.")
            return final_trimmings

        except Exception as eval_err:
            print(f"❌ [v2 RERANK ROUTINE FAILURE]: Local cross-encoder computation failed: {eval_err}")
            # Fallback gracefully to standard database ordering to preserve uptime safety
            return raw_hybrid_results[:top_n]
