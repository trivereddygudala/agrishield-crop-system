import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from backend.app.core.config import settings

import time
logger = logging.getLogger("ai_cluster")

class AIClusterDispatcher:
    """
    Intelligent Round-Robin Load Balancer for Distributed AI Prediction Workers.
    Distributes heavy leaf scan requests across:
      - Worker 1: https://agrishield-ai-worker-1.onrender.com
      - Worker 2: https://agrishield-ai-worker-2.onrender.com
    With automatic failover, circuit breaker cooldown, and seamless local fallback.
    """
    def __init__(self):
        self._index = 0
        self._worker_cooldowns: Dict[str, float] = {}

    def get_worker_nodes(self) -> List[str]:
        # Only attempt remote cluster if explicitly enabled via environment, otherwise default to fast local PyTorch
        if not getattr(settings, "ENABLE_REMOTE_AI_CLUSTER", False) and os.environ.get("ENABLE_REMOTE_AI_CLUSTER", "").lower() != "true":
            return []

        workers = []
        w1 = (getattr(settings, "AI_WORKER_1_URL", "") or os.environ.get("AI_WORKER_1_URL", "")).strip().rstrip("/")
        w2 = (getattr(settings, "AI_WORKER_2_URL", "") or os.environ.get("AI_WORKER_2_URL", "")).strip().rstrip("/")
        w3 = (getattr(settings, "AI_WORKER_3_URL", "") or os.environ.get("AI_WORKER_3_URL", "")).strip().rstrip("/")
        
        now = time.time()
        for w in [w1, w2, w3]:
            if w and now > self._worker_cooldowns.get(w, 0.0):
                workers.append(w)
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

        # Fast connect & read timeout (2.5s) ensures that if a Render worker instance is spun down or cold,
        # we fail fast (<2.5s) to local PyTorch inference rather than stalling the user for 28 seconds.
        cluster_timeout = httpx.Timeout(connect=1.5, read=2.5, write=2.0, pool=1.5)

        # Select candidate workers starting with round-robin index
        candidates = [workers[self._index % len(workers)]]
        if len(workers) > 1:
            candidates.append(workers[(self._index + 1) % len(workers)])
        self._index += 1

        for chosen_worker in candidates:
            target_endpoint = f"{chosen_worker}/api/worker/predict"
            try:
                logger.info(f"⚡ [AI Cluster] Dispatching scan to worker: {chosen_worker}")
                async with httpx.AsyncClient(timeout=cluster_timeout) as client:
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
                        self._worker_cooldowns[chosen_worker] = time.time() + 600.0
                        logger.warning(f"⚠️ [AI Cluster] Worker {chosen_worker} returned HTTP {response.status_code}: {response.text[:120]}")
            except Exception as e:
                self._worker_cooldowns[chosen_worker] = time.time() + 600.0
                logger.warning(f"⚠️ [AI Cluster] Worker {chosen_worker} unreachable or timed out ({e}). Next attempts cool down for 10m.")

        logger.info("ℹ️ [AI Cluster] External worker nodes unavailable or sleeping. Executing local inference immediately.")
        return None

ai_cluster = AIClusterDispatcher()
