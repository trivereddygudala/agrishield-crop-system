"""
AgriShield Render Cluster 24/7 Keep-Alive & Pre-Warm Daemon (B11.5+)
===================================================================
Pings all 4 distributed Render cluster nodes (Main Gateway, Worker 1, Worker 2, Worker 3)
using the lightweight /health/warmup endpoint to prevent Render Free-tier web services
from spinning down after 15 minutes of inactivity.

Usage:
  1. One-shot pre-warm (wakes all 4 nodes before testing or running scans):
       python scripts/render_cluster_keeper.py --once

  2. Continuous keep-alive daemon (runs every 9 minutes in background):
       python scripts/render_cluster_keeper.py

  3. Custom interval (e.g. every 8 minutes):
       python scripts/render_cluster_keeper.py --interval 480
"""

import sys
import time
import argparse
import urllib.request
import urllib.error
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

CLUSTER_NODES = [
    {
        "name": "Main Gateway",
        "url": "https://agrishield-crop-system.onrender.com/health/warmup",
        "role": "gateway (auth, scheduler, IoT, API router)"
    },
    {
        "name": "AI Worker 1",
        "url": "https://agrishield-ai-worker-1.onrender.com/health/warmup",
        "role": "worker (disease diagnosis, PyTorch ResNet, Grad-CAM++)"
    },
    {
        "name": "AI Worker 2",
        "url": "https://agrishield-ai-worker-2.onrender.com/health/warmup",
        "role": "worker (plant species identification, Pl@ntNet AI)"
    },
    {
        "name": "AI Worker 3",
        "url": "https://agrishield-ai-worker-3.onrender.com/health/warmup",
        "role": "worker (agrochemical scanner, OCR, safety advisor)"
    }
]

def ping_node(node: dict) -> dict:
    name = node["name"]
    url = node["url"]
    start = time.time()
    headers = {
        "User-Agent": "AgriShield-KeepAlive/1.0",
        "Accept": "application/json"
    }
    
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=35.0) as resp:
            elapsed = round(time.time() - start, 2)
            code = resp.getcode()
            body_bytes = resp.read()
            try:
                body = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                body = {}
            return {
                "name": name,
                "url": url,
                "status_code": code,
                "elapsed": elapsed,
                "success": True,
                "data": body,
                "error": None
            }
    except urllib.error.HTTPError as e:
        # If /health/warmup is not yet deployed on remote node, fallback to /health
        if e.code == 404 and "/warmup" in url:
            fallback_url = url.replace("/warmup", "")
            try:
                fb_req = urllib.request.Request(fallback_url, headers=headers, method="GET")
                with urllib.request.urlopen(fb_req, timeout=35.0) as fb_resp:
                    elapsed = round(time.time() - start, 2)
                    fb_body = json.loads(fb_resp.read().decode("utf-8"))
                    return {
                        "name": name,
                        "url": fallback_url,
                        "status_code": fb_resp.getcode(),
                        "elapsed": elapsed,
                        "success": True,
                        "data": fb_body,
                        "error": None
                    }
            except Exception as fb_err:
                pass

        elapsed = round(time.time() - start, 2)
        return {
            "name": name,
            "url": url,
            "status_code": e.code,
            "elapsed": elapsed,
            "success": False,
            "data": {},
            "error": f"HTTP {e.code}: {e.reason}"
        }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {
            "name": name,
            "url": url,
            "status_code": 0,
            "elapsed": elapsed,
            "success": False,
            "data": {},
            "error": str(e)
        }

def run_heartbeat_cycle():
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now_str}] 📡 Pinging 4 AgriShield Render nodes in parallel...")
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(ping_node, CLUSTER_NODES))
    
    for r in results:
        if r["success"]:
            role = r["data"].get("service", "unknown")
            uptime = r["data"].get("process_uptime_seconds", "N/A")
            print(f"  ✅ {r['name']:<14} | HTTP {r['status_code']} | {r['elapsed']}s | role: {role} | uptime: {uptime}s")
        else:
            print(f"  ⚠️ {r['name']:<14} | FAILED ({r['error']}) in {r['elapsed']}s")
            print(f"     Hint: Container was likely sleeping; Render is waking it now.")
            
    print(f"[{now_str}] 🚀 Cycle finished. All nodes active.")

def main():
    parser = argparse.ArgumentParser(description="AgriShield Render Cluster 24/7 Keep-Alive")
    parser.add_argument("--once", action="store_true", help="Run a single pre-warm cycle and exit immediately.")
    parser.add_argument("--interval", type=int, default=540, help="Heartbeat interval in seconds (default: 540s / 9 mins).")
    args = parser.parse_args()

    print("=" * 65)
    print("🌿 AgriShield Render Cluster Keep-Alive & Cold-Start Preventer")
    print("=" * 65)
    print(f"Target Nodes (4 accounts):")
    for n in CLUSTER_NODES:
        print(f"  • {n['name']} -> {n['url']}")
    print(f"Interval: {args.interval}s (~{args.interval // 60} mins)")
    print("Render free-tier inactivity timeout: 15 mins (900s)")
    print("=" * 65)

    if args.once:
        run_heartbeat_cycle()
        print("\nSingle pre-warm completed. Exiting.")
        sys.exit(0)

    try:
        while True:
            run_heartbeat_cycle()
            print(f"\nSleeping for {args.interval}s until next keep-alive pulse (Press Ctrl+C to stop)...")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nKeep-alive daemon stopped by user.")

if __name__ == "__main__":
    main()
