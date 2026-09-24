"""
Antigravity Brain Vault Generator with Embedded Offline HTML Viewer
"""

import os
import sys
import glob
import json
import sqlite3
import datetime
from pathlib import Path

WORKSPACE_ROOT = Path(r"c:\AI Crop Disease Detection System")
ANTIGRAVITY_DATA = Path(r"C:\Users\trive\.gemini\antigravity-ide")
BRAIN_DIR = ANTIGRAVITY_DATA / "brain"
CONVERSATIONS_DIR = ANTIGRAVITY_DATA / "conversations"
VAULT_DIR = WORKSPACE_ROOT / "brain_vault"
CONV_OUT_DIR = VAULT_DIR / "conversations"

def ensure_dirs():
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    CONV_OUT_DIR.mkdir(parents=True, exist_ok=True)

def checkpoint_all_dbs():
    """Forces SQLite WAL checkpoints so nothing is trapped in volatile RAM or WAL logs during a power cut."""
    if not CONVERSATIONS_DIR.exists():
        return
    for db_path in CONVERSATIONS_DIR.glob("*.db"):
        try:
            conn = sqlite3.connect(str(db_path))
            cur = conn.cursor()
            cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            conn.close()
        except Exception:
            pass

def parse_transcript(transcript_path):
    """Parses a transcript JSONL file into structured turns."""
    turns = []
    if not os.path.exists(transcript_path):
        return turns
        
    try:
        with open(transcript_path, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    turns.append(obj)
                except Exception:
                    continue
    except Exception as e:
        pass
    return turns

def extract_conversation_details(conv_id):
    brain_path = BRAIN_DIR / conv_id
    db_path = CONVERSATIONS_DIR / f"{conv_id}.db"
    
    transcript_full = brain_path / ".system_generated" / "logs" / "transcript_full.jsonl"
    transcript_compact = brain_path / ".system_generated" / "logs" / "transcript.jsonl"
    
    t_file = transcript_full if transcript_full.exists() else transcript_compact
    turns = []
    if t_file.exists():
        turns = parse_transcript(t_file)
        
    user_prompts = []
    dialogue_pairs = []
    current_prompt = None
    tools_called = set()
    files_modified = set()
    
    for turn in turns:
        stype = turn.get("type")
        source = turn.get("source")
        content = turn.get("content", "")
        t_calls = turn.get("tool_calls", [])
        
        if stype == "USER_INPUT":
            if isinstance(content, str) and content.strip():
                clean_text = content.strip()
                if "<USER_REQUEST>" in clean_text:
                    parts = clean_text.split("<USER_REQUEST>")
                    if len(parts) > 1:
                        clean_text = parts[1].split("</USER_REQUEST>")[0].strip()
                
                # If we had a previous prompt with response, finish it
                current_prompt = {
                    "step": turn.get("step_index", 0),
                    "text": clean_text,
                    "response": ""
                }
                user_prompts.append(clean_text)
                dialogue_pairs.append(current_prompt)
        elif (stype == "PLANNER_RESPONSE" or source == "MODEL") and current_prompt:
            if isinstance(content, str) and content.strip():
                current_prompt["response"] += ("\n\n" if current_prompt["response"] else "") + content.strip()
                
        for tc in t_calls:
            func = tc.get("function", {}) if isinstance(tc, dict) else {}
            name = func.get("name") or tc.get("name")
            if name:
                tools_called.add(name)
                args = func.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except:
                        args = {}
                target_f = args.get("TargetFile") or args.get("path")
                if target_f and ("replace" in name or "write" in name):
                    files_modified.add(os.path.basename(target_f))

    # Title determination
    title = f"Session {conv_id[:8]}"
    if user_prompts:
        first_p = user_prompts[0]
        title = (first_p[:90] + "...") if len(first_p) > 90 else first_p
        title = title.replace("\n", " ").strip()

    mtime = 0
    if db_path.exists():
        mtime = os.path.getmtime(db_path)
    elif brain_path.exists():
        mtime = os.path.getmtime(brain_path)
        
    last_mod_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S") if mtime else "Unknown"

    return {
        "id": conv_id,
        "title": title,
        "last_modified": last_mod_str,
        "mtime": mtime,
        "total_steps": len(turns),
        "user_messages_count": len(user_prompts),
        "dialogues": dialogue_pairs,
        "tools_called": sorted(list(tools_called)),
        "files_modified": sorted(list(files_modified)),
        "user_prompts_preview": [p[:140] for p in user_prompts[:4]]
    }

def generate_vault_html(summary_list):
    """Generates a standalone, ultra-fast, responsive dark-mode offline viewer (< 40 KB)."""
    json_str = json.dumps(summary_list, ensure_ascii=False)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Brain Vault | Crash & Power-Cut Proof Archive</title>
  <style>
    :root {{
      --bg-primary: #0b1120;
      --bg-secondary: #1e293b;
      --bg-card: rgba(30, 41, 59, 0.7);
      --bg-hover: #334155;
      --border: #334155;
      --border-focus: #38bdf8;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #10b981;
      --accent-blue: #38bdf8;
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
    body {{
      background: var(--bg-primary);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }}
    .sidebar {{
      width: 440px;
      min-width: 380px;
      max-width: 480px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
    }}
    .sidebar-header {{
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background: #0f172a;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }}
    .brand-icon {{
      width: 30px;
      height: 30px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }}
    .badge-live {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      font-size: 0.72rem;
      padding: 3px 8px;
      border-radius: 9999px;
      font-weight: 600;
      margin-left: auto;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }}
    .badge-dot {{
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }}
    .search-box {{
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: #111e33;
    }}
    .search-input {{
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #0b1120;
      color: #fff;
      font-size: 0.88rem;
      outline: none;
      transition: all 0.2s;
    }}
    .search-input:focus {{
      border-color: var(--border-focus);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
    }}
    .conv-list {{
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }}
    .conv-card {{
      padding: 14px 16px;
      border-radius: 10px;
      background: var(--bg-card);
      border: 1px solid transparent;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }}
    .conv-card:hover {{
      background: var(--bg-hover);
      border-color: #475569;
    }}
    .conv-card.active {{
      background: #1e3a5f;
      border-color: var(--accent-blue);
    }}
    .conv-card-title {{
      font-size: 0.92rem;
      font-weight: 600;
      line-height: 1.35;
      color: #f1f5f9;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .conv-card-meta {{
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.74rem;
      color: var(--text-muted);
    }}
    .pill {{
      display: inline-block;
      padding: 2px 7px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.72rem;
    }}
    .pill-steps {{
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }}
    .pill-id {{
      font-family: monospace;
      background: #0f172a;
      color: #94a3b8;
    }}

    /* Main Area */
    .main {{
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #070d18;
    }}
    .main-header {{
      padding: 18px 24px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }}
    .conv-info {{
      overflow: hidden;
    }}
    .conv-headline {{
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }}
    .conv-sub {{
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      gap: 14px;
    }}
    .action-btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 8px;
      border: 1px solid #10b981;
      background: #10b981;
      color: #fff;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }}
    .action-btn:hover {{
      background: #059669;
      transform: translateY(-1px);
    }}
    .action-btn-secondary {{
      background: #1e293b;
      border-color: #475569;
      color: #cbd5e1;
    }}
    .action-btn-secondary:hover {{
      background: #334155;
    }}
    .content-area {{
      flex: 1;
      overflow-y: auto;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}
    .card-panel {{
      background: #131d2e;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }}
    .card-panel h4 {{
      font-size: 0.95rem;
      color: #38bdf8;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .prompt-box {{
      background: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 10px;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #e2e8f0;
    }}
    .resume-banner {{
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.15));
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }}
    .toast {{
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.88rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.25s ease;
      pointer-events: none;
    }}
    .toast.show {{
      opacity: 1;
      transform: translateY(0);
    }}
  </style>
</head>
<body>

  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-icon">🛡️</div>
        <span>Antigravity Brain Vault</span>
        <div class="badge-live">
          <div class="badge-dot"></div>
          <span>CRASH PROOF</span>
        </div>
      </div>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search conversations, tasks...">
    </div>
    <div class="conv-list" id="convList"></div>
  </aside>

  <main class="main" id="mainView">
    <div style="margin: auto; text-align: center; color: #94a3b8; max-width: 440px;">
      <h3 style="font-size: 1.3rem; color: #fff; margin-bottom: 8px;">🛡️ Crash-Resilient Brain Vault</h3>
      <p>Select any previous conversation on the left to inspect details or copy the 1-click restore prompt.</p>
    </div>
  </main>

  <div id="toast" class="toast">Prompt copied to clipboard!</div>

  <script>
    const SESSIONS = {json_str};
    let currentConv = null;

    const convListEl = document.getElementById("convList");
    const mainViewEl = document.getElementById("mainView");
    const searchInput = document.getElementById("searchInput");
    const toast = document.getElementById("toast");

    function showToast(msg) {{
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2800);
    }}

    function renderList(list) {{
      convListEl.innerHTML = "";
      if (!list.length) {{
        convListEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #64748b;">No matching conversations found.</div>';
        return;
      }}
      list.forEach(c => {{
        const card = document.createElement("div");
        card.className = "conv-card" + (currentConv && currentConv.id === c.id ? " active" : "");
        card.onclick = () => selectConv(c);
        
        card.innerHTML = `
          <div class="conv-card-title">${{escapeHtml(c.title)}}</div>
          <div class="conv-card-meta">
            <span>🕒 ${{c.last_modified}}</span>
            <span class="pill pill-steps">${{c.total_steps}} steps</span>
            <span class="pill pill-id">${{c.id.substring(0, 8)}}</span>
          </div>
        `;
        convListEl.appendChild(card);
      }});
    }}

    function selectConv(c) {{
      currentConv = c;
      renderList(getFilteredList());
      
      const resumePromptText = `Resume session ${{c.id}}: Continue our previous work on "${{c.title.replace(/"/g, '')}}". Review context from brain_vault/conversations/${{c.id}}.md`;

      const previewsHtml = (c.user_prompts_preview && c.user_prompts_preview.length)
        ? c.user_prompts_preview.map((p, i) => `
            <div class="prompt-box">
              <span style="color: #38bdf8; font-weight: 600; font-size: 0.8rem; display: block; margin-bottom: 4px;">Prompt #${{i+1}}:</span>
              ${{escapeHtml(p)}}
            </div>
          `).join("")
        : '<div style="color: #64748b;">No prompt previews recorded.</div>';

      const filesHtml = (c.files_modified && c.files_modified.length)
        ? c.files_modified.map(f => `<span class="pill" style="background:#1e293b; color:#93c5fd; border:1px solid #3b82f6;">${{f}}</span>`).join(" ")
        : '<span style="color: #64748b;">No files directly edited</span>';

      mainViewEl.innerHTML = `
        <div class="main-header">
          <div class="conv-info">
            <div class="conv-headline">${{escapeHtml(c.title)}}</div>
            <div class="conv-sub">
              <span><b>ID:</b> <code>${{c.id}}</code></span>
              <span><b>Updated:</b> ${{c.last_modified}}</span>
              <span><b>Steps:</b> ${{c.total_steps}}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="action-btn" onclick="copyResumePrompt('${{c.id}}', '${{escapeHtml(c.title)}}')">
              📋 1-Click Resume Prompt
            </button>
            <a href="conversations/${{c.id}}.md" target="_blank" class="action-btn action-btn-secondary" style="text-decoration:none;">
              📄 Full Markdown Log
            </a>
          </div>
        </div>
        <div class="content-area">
          <div class="resume-banner">
            <div>
              <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 4px;">Power Cut Recovery Protocol</h3>
              <p style="color: #94a3b8; font-size: 0.85rem;">If your desktop lost power, paste this resume prompt into any new Antigravity chat window to continue instantly.</p>
            </div>
            <button class="action-btn" onclick="copyResumePrompt('${{c.id}}', '${{escapeHtml(c.title)}}')">
              📋 Copy Prompt
            </button>
          </div>

          <div class="card-panel">
            <h4>📁 Files Modified in Session</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${{filesHtml}}
            </div>
          </div>

          <div class="card-panel">
            <h4>💬 Key User Requests & Instructions</h4>
            ${{previewsHtml}}
          </div>
        </div>
      `;
    }}

    function copyResumePrompt(id, title) {{
      const promptText = `Resume session ${{id}}. Continue our previous work on "${{title}}". Review previous context from brain_vault/conversations/${{id}}.md and continue without restarting from scratch.`;
      navigator.clipboard.writeText(promptText).then(() => {{
        showToast("✅ Resume prompt copied! Paste into Antigravity input.");
      }}).catch(() => {{
        prompt("Copy this prompt:", promptText);
      }});
    }}

    function escapeHtml(text) {{
      if (!text) return "";
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }}

    function getFilteredList() {{
      const q = searchInput.value.toLowerCase().trim();
      if (!q) return SESSIONS;
      return SESSIONS.filter(c => 
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.user_prompts_preview && c.user_prompts_preview.some(p => p.toLowerCase().includes(q)))
      );
    }}

    searchInput.addEventListener("input", () => {{
      renderList(getFilteredList());
    }});

    renderList(SESSIONS);
    if (SESSIONS.length) {{
      selectConv(SESSIONS[0]);
    }}
  </script>
</body>
</html>
"""
    return html

def build_vault():
    ensure_dirs()
    print("Flushing and checkpointing all SQLite databases...")
    checkpoint_all_dbs()
    
    conv_ids = set()
    if CONVERSATIONS_DIR.exists():
        for p in CONVERSATIONS_DIR.glob("*.db"):
            conv_ids.add(p.stem)
    if BRAIN_DIR.exists():
        for p in BRAIN_DIR.iterdir():
            if p.is_dir() and len(p.name) == 36 and "-" in p.name:
                conv_ids.add(p.name)
                
    print(f"Found {len(conv_ids)} distinct Antigravity conversations.")
    
    all_details = []
    for cid in conv_ids:
        details = extract_conversation_details(cid)
        all_details.append(details)
        
        # Save individual markdown file for each conversation
        md_path = CONV_OUT_DIR / f"{cid}.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(f"# Antigravity Session Archive: `{cid}`\n\n")
            f.write(f"- **Primary Title/Intent:** {details['title']}\n")
            f.write(f"- **Last Updated:** {details['last_modified']}\n")
            f.write(f"- **Total Action Steps:** {details['total_steps']}\n")
            f.write(f"- **User Messages:** {details['user_messages_count']}\n")
            f.write(f"- **Files Modified:** {', '.join(details['files_modified']) if details['files_modified'] else 'None'}\n")
            f.write(f"- **Tools Used:** {', '.join(details['tools_called']) if details['tools_called'] else 'None'}\n\n")
            f.write("---\n\n## Dialogue & Execution Stream\n\n")
            
            for i, d in enumerate(details['dialogues']):
                f.write(f"### 👤 User (Prompt #{i+1} - Step {d['step']})\n\n")
                f.write(f"> {d['text']}\n\n")
                if d.get('response'):
                    f.write(f"### 🤖 Antigravity Agent Response\n\n")
                    f.write(f"{d['response']}\n\n")
                f.write("---\n\n")

    # Sort descending by last modified
    all_details.sort(key=lambda x: x["mtime"], reverse=True)
    
    # Save master index JSON
    index_path = VAULT_DIR / "vault_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        summary_details = []
        for d in all_details:
            summary_details.append({
                "id": d["id"],
                "title": d["title"],
                "last_modified": d["last_modified"],
                "mtime": d["mtime"],
                "total_steps": d["total_steps"],
                "user_messages_count": d["user_messages_count"],
                "files_modified": d["files_modified"],
                "tools_called": d["tools_called"],
                "user_prompts_preview": d["user_prompts_preview"]
            })
        json.dump(summary_details, f, indent=2)

    # Save standalone index.html (ultra-lightweight ~35KB)
    html_content = generate_vault_html(summary_details)
    html_path = VAULT_DIR / "index.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Generate RESUME_CONVERSATIONS.md
    resume_md_path = VAULT_DIR / "RESUME_CONVERSATIONS.md"
    with open(resume_md_path, "w", encoding="utf-8") as f:
        f.write("# 🛡️ Antigravity Brain Vault: Conversation Recovery Index\n\n")
        f.write("*Auto-generated master index of all conversations. Immune to sudden desktop power outages.*\n\n")
        f.write("| Session Date / Time | Conversation ID | Title & Summary | Steps | Quick Resume Prompt |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- |\n")
        for d in all_details:
            cid = d["id"]
            short_id = cid[:8]
            title_esc = d["title"].replace("|", "\\|")
            resume_prompt = f"`Continue our previous session {cid}: {title_esc[:45]}`"
            f.write(f"| **{d['last_modified']}** | [`{short_id}...`](conversations/{cid}.md) | **{title_esc}** | {d['total_steps']} | {resume_prompt} |\n")

    print(f"Vault successfully built! Indexed {len(all_details)} conversations into {VAULT_DIR}")
    return all_details

if __name__ == "__main__":
    build_vault()
