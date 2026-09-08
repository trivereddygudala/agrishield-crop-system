import os
import sys

# Limit CPU threads to prevent 100% CPU spikes on shared cloud instances (Render Free Tier)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Ensure repository root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    host = "0.0.0.0"
    print(f"🚀 [AgriShield] Starting Uvicorn on {host}:{port} (Render Cloud Environment)...")
    uvicorn.run("backend.app.main:app", host=host, port=port, log_level="info", access_log=True)
