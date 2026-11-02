---
name: auto-code
description: >-
  CRITICAL: ONLY activate this skill when the user explicitly triggers the `/auto-code` slash command.
  DO NOT auto-trigger or invoke this skill for general coding, reviewing, debugging, or casual tasks.
  When invoked via `/auto-code`, executes an end-to-end autonomous engineering loop uniting bug triage, PR review handling, autonomous plan execution, code review, and visual verification. Supports `--micro` for fast planless trivial edits and `--no-push` to keep changes local.
argument-hint: "[--micro] [--no-push] [<issue-description|pr-number-or-url>]"
---

# Auto-Code Workflow

Unified orchestrator combining bug triage, PR review comment handling, autonomous plan execution, and code review into an autonomous closed-loop development lifecycle.

---

## 0. Invocation, Branch & Working Tree Safety Guard

1. **Invocation Guard & Flags**:
   - Only activate when explicitly invoked via `/auto-code` (e.g. `/auto-code`, `/auto-code --micro <query>`, `/auto-code --no-push <query>`).
   - Abort immediately if triggered casually.
   - Detect operational flags from user prompt:
     - `--micro` (or `--quick`): Force the streamlined micro-path (skips plan artifact, runs surgical inspect-fix-verify loop).
     - `--no-push`: Skip remote push upon completion (defaults to atomic commit & push).
2. **Branch Check**:
   - Query `git rev-parse --abbrev-ref HEAD`.
   - If on `main`, `master`, `production`, `release/*`, or detached HEAD, confirm with user before touching code or staging commits.
3. **Working Tree Dirty State Guard**:
   - Inspect workspace cleanliness via `git status -s`.
   - Note any existing uncommitted files in workspace.
   - **Non-Overlapping Tolerance**: If uncommitted changes exist in unrelated files, do **NOT** halt or prompt to stash. Proceed silently as long as dirty files do not overlap with the target files of this task.
   - **Target Collision Check**: Once target files are identified (in Phase A/B), if an uncommitted file intersects with planned target files, halt and prompt the user via `ask_question`:
     - `(Recommended) Stash uncommitted changes and proceed: git stash push -u -m "auto-code-backup"`
     - `Include existing uncommitted changes in this task`
     - `Abort execution to resolve working tree manually`
4. **Test & Diagnostic File Preservation & Cleanup on Abort**:
   - Whenever execution is aborted or cancelled at any stage:
     - **Ephemeral Diagnostics**: Written to `<Artifact Directory>/scratch/` (zero git workspace pollution).
     - **In-Repo Reproduction Tests**: If a reproduction test was created inside the project test folder (e.g. `tests/repro_*.test.ts`) and the task is aborted during triage, plan formulation, or prior to green verification:
       - Prompt the user via `ask_question`:
         - `(Recommended) Delete newly created reproduction test file`
         - `Keep reproduction test file on disk for debugging`
     - Report paths of any retained test files in chat before halting.

---

## Core Testing Invariants: Targeted & Non-Interactive (Anti-Watch Guard)

Across all testing and verification stages:
- **Run Necessary Tests Only**: Never run monolithic or entire-workspace test suites. Target only the specific file or pattern (e.g. `npm test -- run path/to/target.test.ts`, `pytest tests/test_module.py::test_case`, `go test ./pkg/... -run TestName`).
- **Non-Interactive Single-Run Mode (CRITICAL)**: Test runners must **NEVER** run in watch or interactive mode. Always use explicit single-run termination flags to prevent hanging `run_command` processes:
  - **Vitest**: Always pass `run` or `--run` (or set `CI=true` / `$env:CI='true'`). E.g. `npx vitest run <path>`, `npm test -- run <path>`, `pnpm test -- run <path>` (never invoke bare `vitest <path>` or `npm test -- <path>` without `run`).
  - **Jest**: Pass `--watch=false` or `--watchAll=false` if project default script enables watch mode.
  - **Terminal Log Suppression**: Use dot, quiet, or bail flags (`--reporter=dot`, `-q`, `--bail`) to prevent terminal log flooding.
- **🚨 Watch-Mode Detection & Immediate Task Kill (Anti-Hang Guard)**:
  - If a test command does not exit within `WaitMsBeforeAsync` and gets backgrounded as a task, OR if the command output contains `Waiting for file changes...` / `press h to show help, press q to quit`:
    - **DO NOT wait for the task to complete** (watch mode will NEVER terminate on its own, causing the agent to hang indefinitely).
    - **Immediately kill the task**: Call `manage_task` with `Action: "kill"` and the background `TaskId`.
    - **Immediately re-run the command** using single-run flags: `$env:CI="true"; npx vitest run <path>` or `$env:CI="true"; npm test -- run <path>`.

---

## 1. Initial State Assessment & Stale Plan Guard

Check the active `<Artifact Directory>` for an existing implementation plan artifact (e.g. `auto_code_plan.md`):
- **Stale Plan Check**: Read the YAML frontmatter of `auto_code_plan.md` (if it exists):
  - If `status: COMPLETED` or `status: ABORTED`, or if the user's prompt introduces a new task or query:
    - Archive existing plan (overwrite or write backup) and proceed to [Phase A: No Plan](#phase-a-no-plan).
  - If `status: FROZEN` or `status: IN_PROGRESS` **AND** current branch matches `branch` **AND** the prompt is an explicit resumption (e.g. `/auto-code resume`):
    - Skip to [Phase B: Has Plan](#phase-b-has-plan).
- **If no plan exists**:
  - Proceed to [Phase A: No Plan](#phase-a-no-plan).

---

## Phase A: No Plan (Intent Triage & Plan Formulation)

### A.1 Intent Classification & Execution Mode Gate
Determine user intent from prompt and workspace context (do **NOT** read companion standards upfront):
1. **Execution Mode Selection**:
   - **Micro-Path (`--micro` or Auto-Triaged)**:
     - Activated if `--micro` flag is supplied OR if the task is clearly trivial (< 15 lines of code, $\le$ 2 files, unambiguous prompt, e.g. typo, off-by-one, missing property).
     - **Streamlined Workflow**:
       1. Inspect target file.
       2. Add/update targeted test or minimal reproduction check.
       3. Apply surgical fix using `ponytail`.
       4. Run targeted test (single-run non-interactive, e.g. `npx vitest run <path>` or `$env:CI="true"; npm test -- run <path>`) + fast static check (linter/typecheck).
       5. **Escalation Gate**: If the fix turns out to require > 2 files, > 25 lines, or breaks caller contracts, **escalate immediately** to Standard Path: generate plan artifact and proceed to Phase B.
       6. Skip `auto_code_plan.md` file generation and skip Phase D.3 Compliance Audit. Jump straight to [Phase D.5: Clean Completion & Finalization](#d5-clean-completion--finalization).
   - **Standard Path**:
     - For multi-file changes, architectural tasks, PR review comment batches, or complex bugs. Proceed through A.2–A.6.
2. **Intent Classification**:
   - **PR / Review Comments**: Initiated with PR reference or review feedback -> Proceed to A.2 (Subagent triage).
   - **Bug / Issue**: Initiated with a defect report or broken behavior -> Read [`BUG_FIX_STANDARDS.md`](./BUG_FIX_STANDARDS.md) and proceed to A.3.
   - **Feature / Task**: Initiated with new functionality or refactor -> Proceed to A.4 (Inline specification).

### A.2 PR Review Comment Triage (When Intent = Review Comments)
Follow [`PR_REVIEW_STANDARDS.md`](./PR_REVIEW_STANDARDS.md) using subagent delegation:
1. **Subagent Delegation (Preferred)**:
   Invoke subagent via `invoke_subagent`:
   - `TypeName: "self"`
   - `Role: "PR Review Triage Analyst"`
   - `Model: "flash"`
   - Prompt subagent to fetch threads via `node skills/auto-code/scripts/pr-comments.mjs fetch` (or save via `--out <path>`), group file reads, and return the formatted Executive Summary Table and candidate diffs.
2. **Adaptive Fallback**:
   If subagent tools are unavailable, run `node skills/auto-code/scripts/pr-comments.mjs fetch` in-process with a strict cap of 10 unresolved threads.
3. **Chat vs Artifact Split**:
   - Render the Executive Summary Table directly in chat alongside `ask_question` (multi-select).
   - Write full candidate replacement diffs and technical analyses into the draft plan artifact.

### A.3 Bug Reproduction (When Intent = Bug / Issue)
Follow the standards defined in [`BUG_FIX_STANDARDS.md`](./BUG_FIX_STANDARDS.md):
1. Trace execution paths, inspect all callers, and isolate root cause.
2. Write a minimal reproduction test and verify it **fails** (Red Phase) before touching production code (running necessary tests only, with mandatory single-run flags e.g. `npx vitest run <path>`; never run bare `vitest` or bare `npm test`).

### A.4 Feature & Task Specification (When Intent = Feature / Task)
1. **Acceptance Criteria & Non-Goals**:
   - Extract clear, verifiable acceptance criteria and declare out-of-scope non-goals.
2. **Contract-First Definition**:
   - Define minimal signatures, interfaces, or schema changes before implementation (Ponytail: zero unrequested abstractions).
3. **Caller & Compatibility Scan**:
   - Trace existing callers to ensure non-breaking additions or minimal planned caller updates.

### A.5 Multi-Approach Tradeoff Analysis & Draft Plan (Contract-First)
1. **Tradeoff Analysis (When Viable Alternatives Exist)**:
   - If more than one clean implementation or fix strategy exists:
     - Compare options across **Blast Radius** (caller impact), **Complexity** (abstractions vs stdlib), **Line Impact** (net lines), and **Maintainability**.
     - Provide an explicit recommendation based on the Ponytail Ladder (codebase reuse > stdlib > shortest working diff).
2. **Draft Structured Contract Plan**:
   - Plan by **Contract & Boundaries** rather than fragile exact diff code blocks:
     - Target files, functions, and line ranges.
     - Expected interface/behavioral contract (input/output signatures, invariants, edge cases).
     - Invariants: What must NOT change (e.g. caller contracts, public signatures).
     - Targeted verification command (necessary tests + static checks; MUST specify single-run flags e.g. `npm test -- run <path>` or `npx vitest run <path>`, never bare watch commands).

### A.6 Ambiguity, Tradeoff & Simplicity Gate (Grill-Me)
Inspect the drafted plan and tradeoff analysis:
- Are there competing architectural options, ambiguities, hidden assumptions, or unclarified requirements?
- Is the proposed solution unnecessarily complex or speculative?
- **If competing tradeoffs exist or plan is ambiguous**: Run the `/grill-me` clarification interview (using `ask_question` with `(Recommended)` for the user to select the preferred approach or resolve decisions), then update the plan.
- **If straightforward, unambiguous, and simple**: Proceed directly to Phase B.

---

## Phase B: Has Plan (Clarification & Autonomous Execution)

### B.1 Plan Verification & Gap Fill
1. Inspect the existing plan artifact.
2. Check for missing context, stale assumptions, unaddressed edge cases, or unresolved architectural tradeoffs.
3. If gaps or alternative designs exist, run `/grill-me` to clarify with the user and update the plan.

### B.2 Plan Freeze (MANDATORY)
1. Snapshot the finalized plan into a dedicated execution artifact at `<Artifact Directory>/auto_code_plan.md` using `write_file` with:
   - `ArtifactMetadata`: `{ Summary: "Frozen implementation plan for auto-code", UserFacing: true, RequestFeedback: false }`
   - YAML frontmatter:
     ```yaml
     ---
     status: FROZEN
     remediation_cycle: 0
     branch: <current-branch>
     baseline_sha: <short-sha>
     ---
     ```
   - Lock banner: `> [!IMPORTANT]\n> ### 🔒 PLAN FROZEN & IMMUTABLE\n> Auto-code execution active.`
   - Preserve any original source plan artifact intact.
2. Present a clickable link to `auto_code_plan.md` in chat.
3. **Context Baseline Checkpoint**: Once `auto_code_plan.md` is frozen, earlier exploratory context is archived; the agent strictly treats `auto_code_plan.md` as the authoritative execution baseline.

### B.3 Pre-Flight Baseline Verification
1. Run the targeted baseline test or build command to ensure the current workspace is green before modifications. (MANDATORY: Use single-run non-interactive flags, e.g. `npx vitest run <path>` or `$env:CI="true"; npm test -- run <path>`; never run bare `npm test` or bare `vitest` which triggers watch mode).
2. **Pre-Existing Failure Guard**: If the pre-flight baseline fails unexpectedly on unrelated code, alert the user before modifying any files to avoid diagnosing pre-existing breakage as new regressions.

### B.4 Autonomous Execution (Applying `ponytail`)
Execute the frozen plan sequentially without conversational pauses:
- Set `status: IN_PROGRESS` in `auto_code_plan.md`.
- **Ponytail Ladder**: Codebase reuse > Stdlib > Native platform features > Shortest working diff.
- Zero unnecessary abstractions or boilerplate.
- Apply surgical edits via `edit_file`.
- Re-run targeted verification tests after each change (always single-run, never watch; if watch mode is triggered, immediately kill background task via `manage_task` and re-run with `run`).

### B.5 Controlled Plan Invalidation & Revision Protocol
If a planned step fails verification or encounters an unexpected technical blocker during execution:
- **Zero Silent Deviation**: Never quietly edit unrelated files or expand scope without logging.
- **Case A: Tactical Adjustments (No Formal Amendment Required)**:
  - Minor adjustments within target files (missing imports, syntax tweaks, null guards, type casts) do not require formal markdown amendments in the plan.
  - Apply directly, note in chat (e.g. `> ℹ️ Added missing type guard for undefined in parseInput`), and re-run verification.
- **Case B: Formal Structural Amendment (Plan Artifact Update Required)**:
  - If an **unplanned file** must be touched or an API/contract changes:
    1. Append an amendment entry to `<Artifact Directory>/auto_code_plan.md`:
       ```markdown
       ### 📝 Amendment #1: <brief description>
       - **Reason**: <why adjustment was necessary to satisfy verification>
       - **Adjusted Scope**: <new target files or signature changes>
       ```
    2. Note in chat: `> ℹ️ Plan Amendment #1: [brief reason]`
    3. Apply amendment and re-verify targeted tests.
- **Case C: Major Strategic Invalidation** (approach is fundamentally unviable or invalidates architecture):
  1. **Halt immediately.** Do not touch further production files.
  2. Explain the fundamental roadblock clearly in chat.
  3. Prompt user via `ask_question` with options:
     - `(Recommended) Pivot to Alternative Strategy: <brief description>`
     - `Abort execution (prompt for cleanup of new test files)`
  4. If user approves pivot, update `auto_code_plan.md` with the amended strategy and resume execution. If user aborts, prompt whether to keep or remove newly created reproduction tests, report their file paths in chat, and halt cleanly.

---

## Phase C: Post-Execution Verification & Code Review

### C.1 Acceptance & Static Verification Gate
1. Confirm all targeted test cases pass cleanly (running **necessary tests only**, using single-run flags e.g. `npx vitest run <path>` or `$env:CI="true"; npm test -- run <path>`).
2. **Static Analysis & Typecheck Gate**:
   - **Targeted Lint**: Run linter on *only modified files* (e.g. `npx eslint <modified_files>`, `ruff check <modified_files>`).
   - **Project Typecheck / Compilation**: If project uses static typing or compiled languages (TypeScript `tsconfig.json`, Rust `Cargo.toml`, Go `go.mod`), run a fast non-emitting check (`npx tsc --noEmit`, `cargo check`, `go vet`).
   - Ensure zero new type errors or linter warnings exist before advancing to review.

### C.2 Review Routing (Fast-Path vs Heavy-Path)
Determine review tier:
- **Fast-Path** (Single file, < 30 lines changed, focused fix/task):
  1. **Dynamic Caller & Regression Verification**:
     - Inspect `git diff` and trace direct callers of the modified function or component.
     - For multi-caller or module boundaries, spawn subagent (`Role: "Regression Tester & Verifier"`, `Model: "flash"`) to run targeted caller tests and isolate test logs from parent context.
     - Confirm zero regressions in surrounding callers and immediate modules.
  2. **Ponytail Simplicity Audit**:
     - Verify zero unnecessary abstractions, speculative wrappers, or dead parameters.
     - Confirm adherence to standard library or existing helper reuse.
- **Heavy-Path** (Multi-file changes, architectural/API contracts, security-sensitive):
  - Run [`code-review`](../code-review/SKILL.md) orchestrator spawning specialist subagents (`reviewer-logic`, `reviewer-security`, `reviewer-simplification`).
- **Unsure**:
  - Ask user via `ask_question`: *"Run multi-agent code review or proceed to commit?"*

---

## Phase D: Remediation Loop & Completion

### D.1 Remediation Loop Guard
To prevent infinite review cycles:
- **Maximum 1 automatic remediation cycle** tracked via `remediation_cycle` in `auto_code_plan.md`.
- Only **CRITICAL** or **HIGH** severity blockers trigger automatic re-planning.
- Dismissed items or minor nits are noted in chat as advisory.

### D.2 Remediation Action
Read `auto_code_plan.md` frontmatter:
- **If blockers detected and `remediation_cycle == 0`**:
  1. Increment `remediation_cycle: 1` and set `status: REMEDIATING` in `auto_code_plan.md`.
  2. Formulate a remediation plan addressing only the blockers.
  3. Return to **Phase B: Has Plan**.
- **If blockers persist and `remediation_cycle >= 1`**:
  - Halt, update `status: ABORTED` in `auto_code_plan.md`, present findings, and ask user for direction via `ask_question`.

### D.3 Plan vs. Reality Compliance Audit
Before finalization, compare the actual modified codebase state (`git diff`) against the frozen plan artifact (`auto_code_plan.md`) and any logged amendments to guarantee zero silent scope creep:
1. **Target Scope Check**: Did all modified files and functions strictly match the planned targets without unrequested file modifications?
2. **Diff Minimization Check**: Does the diff contain only necessary code to satisfy the plan, with zero extraneous refactoring or boilerplate?
3. **Amendment Justification Check**: Were all deviations or tactical amendments logged and justified in the plan artifact?
4. **Plan Compliance Checklist**: Record the full structured checklist inside `auto_code_plan.md`. In chat, present only a 1-line compliance certification and link to the plan artifact.
5. **Certification**: Explicitly certify whether the implementation complied 100% with the frozen plan (or approved amendments), or detail any unlogged deviations.

### D.4 Visual Verification Guard (Mandatory for Frontend Appearance Changes)
For any feature, update, or bug fix that alters the visual appearance, styling, or layout of a frontend interface (HTML, CSS, UI components, pages):
1. **Pre-Flight Probe**:
   - Check if `skills/auto-frontend-screenshot/scripts/capture.mjs` exists.
   - Probe server reachability:
     ```bash
     node -e "fetch('<frontend-route-url>').then(r=>console.log(r.status)).catch(()=>console.log('OFFLINE'))"
     ```
   - If server is offline or script is missing: prompt user via `ask_question` to supply a running port or skip visual verification.
2. **Capture Execution & Proof**:
   - If server is reachable, execute `capture.mjs` (Mode A) and embed screenshot preview in closing report.

### D.5 Clean Completion & Finalization
When verification is green, the Plan Compliance Audit is confirmed (if on Standard Path), visual verification is complete (for UI changes), and no blocking review findings remain:
1. Update `status: COMPLETED` in `auto_code_plan.md` (if plan artifact exists).
2. Present the Consolidated Status Report, Plan Compliance Checklist (if on Standard Path), and any visual verification previews in chat.
3. If code changes were made:
   - **Surgical Staging**: Stage strictly the target files modified during this task (`git add <target-files>`), avoiding `git add .` or sweeping untracked workspace files.
   - **Local Commit**: Commit changes adhering to [`git-commit-push`](../git-commit-push/SKILL.md) conventions, capturing `<short-sha>`.
   - **Atomic Commit & Push Policy (Default Push)**:
     - **Mode A: Local Only (`--no-push`)**: If `--no-push` was explicitly passed, commit locally without pushing (`git commit -m "<message>"`), capturing `<short-sha>` and notifying user: `Committed <short-sha> locally (--no-push active). Review or push when ready.`
     - **Mode B: Commit & Push (Default)**: Execute commit and push in one compound command with upstream fallback (following [`git-commit-push`](../git-commit-push/SKILL.md) Mode B):
       - **PowerShell**: `git commit -m "<message>"; if ($LASTEXITCODE -eq 0) { git push; if ($LASTEXITCODE -ne 0) { git push -u origin (git rev-parse --abbrev-ref HEAD) } }`
       - **Bash / POSIX**: `git commit -m "<message>" && (git push || git push -u origin $(git rev-parse --abbrev-ref HEAD))`
       - Capture `<short-sha>` and report push status in chat.
4. If working on PR review comments:
   - For `ADDRESSED` threads: auto-reply and resolve referencing `<short-sha>` via `node skills/auto-code/scripts/pr-comments.mjs reply-and-resolve --thread-id "<threadId>" --reason ADDRESSED --body "Addressed in commit <short-sha>: <summary>"` (or batch resolve via `batch --file <path>`).
   - For `INVALID` or `WONT_FIX` threads: present draft reply in chat and confirm with user via `ask_question` before executing `node skills/auto-code/scripts/pr-comments.mjs reply-and-resolve` (or `resolve`).
   - Render the PR Resolution Summary Table per [`PR_REVIEW_STANDARDS.md`](./PR_REVIEW_STANDARDS.md).
