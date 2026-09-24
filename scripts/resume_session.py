"""
Antigravity Session Resumer CLI
Allows instantaneous inspection and restoration of past conversations, especially after sudden PC power outages.
"""

import sys
import json
from pathlib import Path

WORKSPACE_ROOT = Path(r"c:\AI Crop Disease Detection System")
VAULT_DIR = WORKSPACE_ROOT / "brain_vault"
INDEX_PATH = VAULT_DIR / "vault_index.json"

def load_index():
    if not INDEX_PATH.exists():
        print("Brain vault index not found. Building now...")
        import subprocess
        subprocess.run([sys.executable, str(WORKSPACE_ROOT / "scripts" / "build_brain_vault.py")])
        
    if not INDEX_PATH.exists():
        print("Error: Could not locate or generate vault_index.json.")
        sys.exit(1)
        
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def display_sessions(sessions, limit=8):
    print("\n" + "="*80)
    print("🛡️  ANTIGRAVITY BRAIN VAULT — RECENT SESSIONS")
    print("="*80)
    for i, s in enumerate(sessions[:limit], 1):
        cid = s["id"]
        short_id = cid[:8]
        title = s["title"]
        if len(title) > 65:
            title = title[:62] + "..."
        print(f"[{i}] {s['last_modified']} | {short_id} | {s['total_steps']} steps")
        print(f"    Intent: {title}")
        if s.get("files_modified"):
            print(f"    Files: {', '.join(s['files_modified'][:4])}")
        print("-" * 80)

def show_session_detail(s):
    cid = s["id"]
    print("\n" + "#"*80)
    print(f"📂 SESSION DETAILS: {cid}")
    print(f"🕒 Last Active: {s['last_modified']}")
    print(f"🔢 Total Steps: {s['total_steps']} | Messages: {s['user_messages_count']}")
    print(f"🎯 Objective: {s['title']}")
    print("#"*80)
    
    md_path = VAULT_DIR / "conversations" / f"{cid}.md"
    if md_path.exists():
        print(f"\n📖 Complete markdown log available at: {md_path}")
        
    print("\n" + "-"*80)
    print("📋 READY-TO-PASTE RESUME PROMPT FOR ANTIGRAVITY:")
    print("-" * 80)
    print(f"Resume session {cid}. Continue our previous task: '{s['title']}'. Review previous context from brain_vault/conversations/{cid}.md and continue without restarting from scratch.")
    print("-" * 80 + "\n")

def main():
    sessions = load_index()
    if not sessions:
        print("No sessions indexed in the vault.")
        return

    arg = sys.argv[1].strip() if len(sys.argv) > 1 else None

    if not arg or arg.lower() == "list":
        display_sessions(sessions)
        print("\nTo inspect and resume a session, run:")
        print("  python scripts/resume_session.py 1       (for latest session)")
        print("  python scripts/resume_session.py <conversation_id>\n")
        return

    selected = None
    if arg.isdigit():
        idx = int(arg) - 1
        if 0 <= idx < len(sessions):
            selected = sessions[idx]
        else:
            print(f"Invalid index {arg}. Choose between 1 and {len(sessions)}.")
            return
    elif arg.lower() in ("latest", "last"):
        selected = sessions[0]
    else:
        # Match by ID or substring
        for s in sessions:
            if arg.lower() in s["id"].lower():
                selected = s
                break

    if not selected:
        print(f"Could not find session matching '{arg}'.")
        display_sessions(sessions)
        return

    show_session_detail(selected)

if __name__ == "__main__":
    main()
