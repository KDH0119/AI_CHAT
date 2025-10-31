# Project Map
- Static front-end chat client built with vanilla ES modules (`index.html`, `start.html`, `Main_chat.html`) and CSS themes (`Main_chat_style.css`, `style_start.css`, `dark_mode.css`).
- Core runtime logic lives under `js/`:
  - `main.js` wires UI events, holds global `state`, and orchestrates chat flow.
  - `Api.js` wraps Google Gemini SDK streaming + token accounting.
  - `chat.js`, `message.js`, `summary.js`, `storage.js`, `ui.js` split persistence, rendering, and modal behaviour.
- No bundler/build step; open via Live Server (or any static http server) so ES modules resolve.
- localStorage persists sessions and the Gemini API key (`gemini_api_key`, `gemini_chat_sessions`).

# Key Behaviours
- Chat lifecycle:
  1. Load character template from `localStorage` (`characterFormData`), render prologue/system prompt.
  2. Append user messages to `state.chatHistory`; stream model replies via `sendToGeminiStream`.
  3. Save each exchange to `localStorage`; update sidebar list with `loadChatList`.
- Message management:
  - Each chat bubble exposes reroll/edit/delete buttons handled in `main.js` → `message.js`.
  - Summaries generated in `summary.js` call `sendToGemini` with `SUMMARY_SYSTEM_PROMPT`, trim history, and store latest digest in `state.currentSummary`.
- Token logging & cost estimates surface through console helpers (`showTokenStats`, `resetTokenStats`).

# Implementation Guardrails
- Encoding: HTML/JS currently display mojibake for Korean copy; treat source as UTF-8 and avoid re-saving in encodings that would double-corrupt text.
- API usage:
  - Respect `sendToGeminiStream` contract: history slice excludes the pending user prompt; remember to push both user/model messages to `state.chatHistory`.
  - Keep safety settings aligned unless explicitly asked (all thresholds set to `OFF`).
- State discipline:
  - Mutate `state` via existing helpers; when pruning history (e.g., during summary), maintain alternating user/model ordering and regenerate DOM via `appendMessage`.
  - When adding new fields to `state.characterInfo`, update `applyTemplate` and storage serializers (`chat.js`).
- UI changes:
  - Buttons rely on CSS classes across `Main_chat_style.css`; keep structure compatible (e.g., `.message`, `.options-sidebar`).
  - Mobile toggles (`toggleSidebar`, `toggleOptionsSidebar`) live in `ui.js`; reuse instead of duplicating logic.

# Working Notes for Agents
- Run-time testing: open `Main_chat.html` with Live Server; console logs drive debugging (no automated tests present).
- Before calling Gemini, ensure `localStorage.gemini_api_key` is set; update via `saveApiKey` UI or `window.updateApiKey`.
- Handle errors gracefully:
  - Streaming API throws for 503/429/400 with custom messages; preserve this pattern when extending error handling.
  - UI status updates funnel through `showStatus(type)`.
- Persisting chats:
  - `saveChat()` persists `state.chatMessages` keyed by `state.currentChatId`; when creating new flows, call `initializeNewChat` in `chat.js` rather than manually crafting ids.
  - `storage.js` manages generic save/load wrappers—reuse instead of direct `localStorage` access where possible.

# Potential Follow-ups
- Fix mojibake by re-saving HTML/CSS/JS with proper UTF-8 encoding.
- Add lightweight smoke tests (e.g., Cypress component checks) if automation is introduced.
- Consider extracting pricing constants into `config.js` for single-source control.
