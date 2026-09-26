# Workspace Rules & Agent Constraints

## Browser Testing & Input Interaction
- **Clear Inputs Before Typing:** Whenever performing browser automation or scratchpad testing, always verify if the input fields are pre-filled. If an input field already contains text or a value, select all content and delete it (or backspace to clear it entirely) before typing the new value. This prevents double-typing or appending text onto existing entries.
- **Hard Reload During Browser Testing:** Whenever performing browser automation or scratchpad verification, press `Ctrl + Shift + R` (or `Control+F5` / hard reload) to bypass cached Service Worker assets and load the latest live site build immediately.

## Persistent Changelog & Complete Chat History Updates
- **Record Every Change:** Whenever you modify any code, architecture, or configuration in this workspace, you MUST append a brief summary of the changes to the `changes_happening.md` file in the root directory. Do not forget this rule under any circumstances to prevent the user from losing track of their 15+ hours of work.
- **Mandatory Two-Way Chat Logging (`chats_by_user.md` & `chat by user.md`):**
  1. **Before Entering Any Process:** As the very first action upon receiving any user prompt (or when opening a new conversation), immediately log the user's prompt with timestamp into `chats_by_user.md` and `chat by user.md`.
  2. **After Executing the Process:** Immediately update the log entry with the full system response, machine solutions, technical actions taken, and files modified.
  3. **Preserve Complete Dialogues:** Both the user-given question/instruction AND the system-given answer/solution MUST be preserved verbatim in `chat by user.md` and `chats_by_user.md`.
  4. **Local Storage Only:** Ensure `chat by user.md` and `chats_by_user.md` remain in `.gitignore` so they are stored locally on the user's PC and never pushed to remote Git repositories.

## Antigravity Brain Vault & Crash Recovery
- **Continuous Checkpointing:** When running long-duration batch jobs or multi-hour sessions, maintain active SQLite database flushing and keep `brain_vault/` synced.
- **Power-Cut Context Resumption:** If the user opens a new session mentioning a power cut, lost chat, or resuming previous work, immediately consult `brain_vault/RESUME_CONVERSATIONS.md` or `brain_vault/vault_index.json` to load the exact state of the prior session and continue without restarting from scratch.

## Strict Chat Memory Retention & Zero-Purge Mandate (Anti-Clearing Rule)
- **Zero-Purge Constraint:** Antigravity and any subagents are STRICTLY FORBIDDEN from clearing, resetting, discarding, or wiping the conversation memory or active context, even when the dialogue grows extremely large (10,000+ lines or 15MB+ transcripts).
- **Compaction Resilience & Auto-Resumption Protocol:** When the underlying LLM token window reaches capacity and the system triggers an automatic context compaction or checkpoint:
  1. The agent MUST NOT lose track of ongoing multi-step implementations or ask the user to re-explain their prompt.
  2. The agent MUST immediately inspect the tail of `chat by user.md` and `changes_happening.md` as its primary external memory to retrieve the exact active dialogue and unfinished steps (marked `In Progress` ⏳).
  3. The agent MUST autonomously continue executing the remaining implementation steps without pausing, halting prematurely, or clearing previous progress.
- **Complete Dialogue Immutability:** `chat by user.md` and `chats_by_user.md` are the permanent, un-cancellable historical record. Never truncate, overwrite, or summarize away past dialogues in these files. All historical entries must be retained indefinitely.
- **Pre-Execution Checkpointing:** Before executing any multi-tool or multi-file code modifications, the agent must ensure the incoming user request is already recorded in `chat by user.md` so that even in the case of sudden power outages, system restarts, or context compactions, 100% of the instruction remains intact and immediately resumable.


