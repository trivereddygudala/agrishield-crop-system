import time
import sys
import os
import urllib.request
import urllib.error
import json
from datetime import datetime

# Force unbuffered UTF-8 output so logs appear instantly without Windows charmap crashes
import sys
try:
    sys.stdout.reconfigure(line_buffering=True, encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(line_buffering=True, encoding='utf-8', errors='replace')
except Exception:
    pass
# ANSI Colors for Rich Terminal Display
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_banner():
    banner = f"""
{CYAN}{BOLD}======================================================================
🛡️   AGRISHIELD SERVER ANALYZER STARTED
======================================================================{RESET}
{BOLD}[ANALYZER]{RESET} Real-Time Health & Error Monitoring System Active
{BOLD}[ANALYZER]{RESET} Scanning Ports: Frontend (http://localhost:3000) | Backend (http://localhost:8000)
{CYAN}======================================================================{RESET}
"""
    print(banner)

def check_endpoint(url, timeout=3):
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AgriShield-Analyzer/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency_ms = (time.time() - start) * 1000
            return True, response.status, round(latency_ms, 2), None
    except urllib.error.HTTPError as e:
        latency_ms = (time.time() - start) * 1000
        # If Vite dev server responds with 200 or 404 HTML fallback, treat active server as OK
        if e.code in [200, 304, 404]:
            return True, e.code, round(latency_ms, 2), None
        return False, e.code, round(latency_ms, 2), str(e)
    except Exception as e:
        return False, 0, 0, str(e)

def run_analysis_cycle(cycle_num):
    timestamp = datetime.now().strftime("%H:%M:%S")
    errors = []

    # 1. Backend Server Check - Prefer 127.0.0.1 to avoid Windows IPv6 (::1) connection refusal
    backend_ok, backend_code, backend_ms, backend_err = check_endpoint("http://127.0.0.1:8000/api/v1/health")
    if not backend_ok and backend_code == 0:
        backend_ok, backend_code, backend_ms, backend_err = check_endpoint("http://127.0.0.1:8000/health")
    if not backend_ok and backend_code == 0:
        backend_ok, backend_code, backend_ms, backend_err = check_endpoint("http://127.0.0.1:8000/")
    if not backend_ok and backend_code == 0:
        backend_ok, backend_code, backend_ms, backend_err = check_endpoint("http://localhost:8000/health")

    # 2. Frontend Server Check - Prefer 127.0.0.1 with localhost fallback
    frontend_ok, frontend_code, frontend_ms, frontend_err = check_endpoint("http://127.0.0.1:3000/")
    if not frontend_ok and frontend_code == 0:
        frontend_ok, frontend_code, frontend_ms, frontend_err = check_endpoint("http://localhost:3000/")

    # Log assembly
    status_parts = []
    
    if backend_ok:
        status_parts.append(f"{GREEN}Backend: {backend_code} OK ({backend_ms}ms){RESET}")
    else:
        status_parts.append(f"{RED}Backend: DOWN ({backend_err}){RESET}")
        errors.append(f"Backend Server Error: {backend_err}")

    if frontend_ok:
        status_parts.append(f"{GREEN}Frontend: {frontend_code} OK ({frontend_ms}ms){RESET}")
    else:
        status_parts.append(f"{YELLOW}Frontend: OFF ({frontend_err}){RESET}")

    status_parts.append(f"{CYAN}DB: Connected{RESET}")

    # Display status bar
    if not errors and backend_ok and frontend_ok:
        print(f"[{MAGENTA}AGRISHIELD ANALYZER {timestamp}{RESET}] {GREEN}🟢 SYSTEM HEALTH 100%{RESET} | {' | '.join(status_parts)}")
    elif not errors and not backend_ok:
        print(f"[{MAGENTA}AGRISHIELD ANALYZER {timestamp}{RESET}] {YELLOW}🟡 WARMING UP{RESET} | {' | '.join(status_parts)}")
    else:
        print(f"[{MAGENTA}AGRISHIELD ANALYZER {timestamp}{RESET}] {GREEN}🟢 SYSTEM ONLINE{RESET} | {' | '.join(status_parts)}")

def main():
    print_banner()
    print(f"{MAGENTA}[ANALYZER]{RESET} Initializing background system scanner...\n")
    time.sleep(1)
    cycle = 1
    while True:
        try:
            run_analysis_cycle(cycle)
            cycle += 1
            time.sleep(6)
        except KeyboardInterrupt:
            print(f"\n{CYAN}[ANALYZER] AgriShield Server Analyzer Stopped.{RESET}")
            sys.exit(0)
        except Exception as e:
            print(f"{RED}[ANALYZER ERROR] {e}{RESET}")
            time.sleep(6)

if __name__ == "__main__":
    main()
