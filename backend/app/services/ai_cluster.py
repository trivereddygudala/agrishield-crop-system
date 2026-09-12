import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from backend.app.core.config import settings

logger = logging.getLogger("ai_cluster")

class AIClusterDispatcher:
    """
    Intelligent Round-Robin Load Balancer for Distributed AI Prediction Workers.
    Distributes heavy leaf scan requests across:
      - Worker 1: https://agrishield-ai-worker-1.onrender.com
      - Worker 2: https://agrishield-ai-worker-2.onrender.com
    With automatic failover and seamless local fallback.
    """
    def __init__(self):
        self._index = 0

    def get_worker_nodes(self) -> List[str]:
        workers = []
        w1 = (getattr(settings, "AI_WORKER_1_URL", "") or os.environ.get("AI_WORKER_1_URL", "")).strip().rstrip("/")
        w2 = (getattr(settings, "AI_WORKER_2_URL", "") or os.environ.get("AI_WORKER_2_URL", "")).strip().rstrip("/")
        
        if w1:
            workers.append(w1)
        if w2:
            workers.append(w2)
        return workers

    def get_next_worker(self) -> Optional[str]:
        workers = self.get_worker_nodes()
        if not workers:
            return None
        worker = workers[self._index % len(workers)]
        self._index += 1
        return worker

    async def offload_prediction(
        self,
        image_bytes: bytes,
        filename: str = "leaf.jpg",
        explainer_type: str = "gradcam++",
        crop_filter: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Dispatches inference payload to the next available worker with automatic failover.
        Returns None if all workers are offline/unreachable, triggering safe local execution.
        """
        # If this instance IS a worker, never forward
        if getattr(settings, "IS_PREDICTION_WORKER", False) or os.environ.get("IS_PREDICTION_WORKER", "").lower() == "true":
            return None

        workers = self.get_worker_nodes()
        if not workers:
            return None

        # Select active worker using round-robin
        chosen_worker = workers[self._index % len(workers)]
        self._index += 1

        target_endpoint = f"{chosen_worker}/api/worker/predict"
        try:
            logger.info(f"⚡ [AI Cluster] Dispatching scan to worker: {chosen_worker}")
            async with httpx.AsyncClient(timeout=12.0) as client:
                files = {"file": (filename, image_bytes, "image/jpeg")}
                data = {
                    "explainer_type": explainer_type,
                    "crop_filter": crop_filter or ""
                }
                response = await client.post(target_endpoint, files=files, data=data)
                
                if response.status_code == 200:
                    res_json = response.json()
                    if res_json.get("success"):
                        logger.info(f"✅ [AI Cluster] Worker {chosen_worker} finished prediction successfully!")
                        return res_json.get("result")
                else:
                    logger.warning(f"⚠️ [AI Cluster] Worker {chosen_worker} returned HTTP {response.status_code}: {response.text[:120]}")
        except Exception as e:
            logger.warning(f"⚠️ [AI Cluster] Worker {chosen_worker} request failed: {e}. Fast-failing to local inference.")

        logger.info("ℹ️ [AI Cluster] External worker node unavailable. Executing local inference immediately.")
        return None

ai_cluster = AIClusterDispatcher()
