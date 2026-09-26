# Antigravity & Gemini Workspace Instructions

## Strict Chat Memory Retention & Zero-Purge Mandate (Anti-Clearing Rule)
- **Zero-Purge Constraint:** Antigravity and any subagents are STRICTLY FORBIDDEN from clearing, resetting, discarding, or wiping the conversation memory or active context, even when the dialogue grows extremely large (10,000+ lines or 15MB+ transcripts).
- **Compaction Resilience & Auto-Resumption Protocol:** When the underlying LLM token window reaches capacity and the system triggers an automatic context compaction or checkpoint:
  1. The agent MUST NOT lose track of ongoing multi-step implementations or ask the user to re-explain their prompt.
  2. The agent MUST immediately inspect the tail of `chat by user.md` and `changes_happening.md` as its primary external memory to retrieve the exact active dialogue and unfinished steps (marked `In Progress` ⏳).
  3. The agent MUST autonomously continue executing the remaining implementation steps without pausing, halting prematurely, or clearing previous progress.
- **Complete Dialogue Immutability:** `chat by user.md` and `chats_by_user.md` are the permanent, un-cancellable historical record. Never truncate, overwrite, or summarize away past dialogues in these files. All historical entries must be retained indefinitely.
- **Pre-Execution Checkpointing:** Before executing any multi-tool or multi-file code modifications, the agent must ensure the incoming user request is already recorded in `chat by user.md` so that even in the case of sudden power outages, system restarts, or context compactions, 100% of the instruction remains intact and immediately resumable.

## Persistent Changelog & Complete Chat History Updates
- **Record Every Change:** Whenever you modify any code, architecture, or configuration in this workspace, you MUST append a brief summary of the changes to the `changes_happening.md` file in the root directory.
- **Mandatory Two-Way Chat Logging (`chats_by_user.md` & `chat by user.md`):**
  1. Before entering any process: immediately log user prompt with timestamp.
  2. After executing: update log entry with full system response, machine solutions, technical actions, and files modified.
  3. Local storage only: never push chat logs to remote git repositories.
