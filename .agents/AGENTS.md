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

