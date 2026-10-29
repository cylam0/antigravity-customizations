---
name: auto-frontend-screenshot
description: >-
  CRITICAL: ONLY activate this skill when the user explicitly triggers the `/auto-frontend-screenshot` slash command or an agent explicitly invokes it.
  DO NOT auto-trigger or invoke this skill for general coding, frontend work, testing, or casual mentions of screenshots.
  When invoked via `/auto-frontend-screenshot` or explicit agent delegation, uses an accelerated Playwright runner with pure mock data (zero backend) and instant animation freeze to capture targeted frontend screenshots to a local temp folder.
argument-hint: "<url-or-route> [--selector=<css>] [--mobile|--desktop] [--theme=dark|light] [--mock=<json|path>]"
license: MIT
---

# Auto Frontend Screenshot

Autonomous, high-speed visual verification workflow. Intercepts frontend network calls with pure mock data (zero backend dependency), freezes animations instantly, captures targeted responsive screenshots, and produces an inline visual preview in seconds.

---

## 0. Invocation Guard

Check the initiating prompt:
- If this turn was **NOT** explicitly initiated by `/auto-frontend-screenshot` (or `/screenshot`) by the user, or explicitly delegated by a caller agent/subagent, **ABORT** this workflow immediately and proceed with normal conversational or coding behavior without applying this skill.
- Do **NOT** auto-trigger for general UI work, casual mentions like "how does it look?", questions about Playwright, or when words like "screenshot" appear in conversation.
- Do **NOT** persist across subsequent turns unless explicitly invoked again.

---

## 1. Fail-Fast & Early Exit Pre-flight Checks

Before running any commands or browsers, verify the following 3 invariants. If ANY invariant fails, **QUIT EARLY** with a clear error message:

### Invariant 1: Capture Target Must Be Explicitly Specified
The user or caller agent **MUST** explicitly specify what to capture. Do not guess default routes.
- **Required**:
  1. Route/URL (e.g. `http://localhost:3000/settings`, `/dashboard`)
  2. Scope (Full page or CSS selector, e.g. `--selector=".user-profile"`)
  3. Desired state/interaction (e.g. "initial load", "dark theme", or mock state)
- **Early Exit Rule**: If the target route or component is missing or ambiguous:
  > *"❌ Aborting: Capture target unspecified. Please specify the target route (e.g. `/dashboard`), selector, and state before invoking `/auto-frontend-screenshot`."*
  Halt immediately. Do NOT run commands or generate scripts.

### Invariant 2: E2E Browser / Test Package Must Be Installed
The workspace must contain Playwright (`playwright` or `@playwright/test`) or have npx-accessible browser binaries.
- Check workspace `package.json` for `playwright` or `@playwright/test`.
- **Early Exit Rule**: If no browser automation package is found:
  > *"❌ Aborting: No Playwright or E2E browser automation package found in workspace. Cannot mock frontend or orchestrate headless browser."*
  Halt immediately.

### Invariant 3: Frontend Dev Server Must Be Reachable
The frontend server must be actively running (e.g. `http://localhost:3000`, `http://localhost:5173`).
- Probe the target port/URL.
- **Early Exit Rule**: If the frontend server is unreachable and cannot be booted:
  > *"❌ Aborting: Frontend dev server is not reachable at target URL. Ensure the dev server is running before taking screenshots."*
  Halt immediately.

---

## 2. Zero Backend Involvement & Zero Workspace Pollution

Under NO circumstances should this skill interact with a backend service or pollute the workspace repository:
- **NO test files in workspace**: ⛔ NEVER write `*.spec.*`, `*.test.*`, or test files into the repository. NEVER run `npx playwright test`. Use the CLI runner (Mode A) or conversation scratchpad (Mode B).
- **NO backend servers**: Do not start, restart, or query backend API servers.
- **NO database access**: Do not run migrations, execute SQL queries, or seed databases.
- **Pure Client Route Mocking**: Intercept all outgoing API requests (`fetch`, `xhr`, `axios`) directly in the Playwright browser context using `page.route()`, fulfilling with in-memory JSON fixtures.
- **Telemetry Abort**: Abort external tracking and analytics domains immediately to avoid unnecessary network latency.

---

## 3. Fast Execution (Two Execution Modes)

### Mode A: Fast-Path CLI Runner (Default for Standard Captures)
For standard URL, component selector, viewport, and mock fixtures, use the pre-built accelerated runner script directly (eliminates script generation latency):

```bash
node skills/auto-frontend-screenshot/scripts/capture.mjs \
  --url "http://localhost:3000/profile" \
  --selector ".user-card" \
  --viewport desktop \
  --theme light \
  --mock '{"user":{"name":"Alice","role":"Admin"}}'
```

**Options**:
- `--url <url>` (Required): Target frontend URL.
- `--selector <css>` (Optional): Captures only the targeted DOM element.
- `--viewport <desktop|mobile>` (Optional, default `desktop`).
- `--theme <light|dark>` (Optional, default `light`).
- `--mock <json-string-or-path>` (Optional): Synthetic mock data injected into `**/api/**`.
- `--fullPage` (Optional): Full page scroll capture.
- `--cdp <ws-or-http>` (Optional): Attach to existing Chrome via CDP (e.g. `http://localhost:9222`) for ~50ms launch.

### Mode B: Ephemeral Custom Script (Complex Multi-Step Interactions Only)
If the workflow requires multi-step interactive sequences (e.g. typing into multiple inputs, drag-and-drop, tab switching):

1. **Location**: Write the ephemeral test script to `<appDataDir>/brain/<conversation-id>/scratch/temp-screenshot.mjs`.
2. **Accelerated Patterns**:
   - Use `waitUntil: 'domcontentloaded'` (NEVER `networkidle`).
   - Use `animations: 'disabled'` in `page.screenshot()`.
   - Pass stripped headless args (`--disable-extensions`, `--mute-audio`, `--disable-background-networking`).
3. **Strict Teardown**: In a `finally` block, unconditionally delete the ephemeral test script so zero test code remains.

---

## 4. Presentation & Multimodal Inspection

1. **Inline Display**: Output the saved screenshot path as a clickable markdown image link:
   ```markdown
   ![Target Screenshot](file:///absolute/path/to/.screenshots/screenshot-12345.png)
   ```
2. **Visual Inspection**: Promptly inspect the rendered image:
   - Check layout integrity (alignment, padding, no unwanted text overflow or clipping).
   - Check theme styling (colors, contrasts).
   - Check data presence (verify mock data populated the expected UI fields).
3. **Confirm Cleanup**: If Mode B was used, confirm the ephemeral test script was purged.
