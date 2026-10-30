---
name: auto-handle
description: >-
  CRITICAL: ONLY activate this skill when the user explicitly triggers the `/auto-handle` slash command.
  DO NOT auto-trigger or invoke this skill for general coding, reviewing, debugging, or casual tasks.
  When invoked via `/auto-handle`, executes an end-to-end autonomous engineering loop uniting bug triage, PR review handling, autonomous plan execution, and code review: classifies intent, triages comments or issues, formulates and clarifies plans via grill-me, executes minimally with ponytail, verifies, reviews locally, and remediates.
argument-hint: "[<issue-description|pr-number-or-url>]"
---

# Auto-Handle Workflow

Unified orchestrator combining bug triage, PR review comment handling, autonomous plan execution, and code review into an autonomous closed-loop development lifecycle.

---

## 0. Invocation & Branch Safety Guard

1. **Invocation Guard**:
   - Only activate when explicitly invoked via `/auto-handle` (e.g. `/auto-handle`, `/auto-handle <query>`, `/auto-handle <pr-number-or-url>`).
   - Abort immediately if triggered casually.
2. **Branch Check**:
   - Query `git rev-parse --abbrev-ref HEAD`.
   - If on `main`, `master`, `production`, `release/*`, or detached HEAD, confirm with user before touching code or staging commits.
3. **Core Invariant: Test & Diagnostic File Preservation on Abort**:
   - Whenever execution is aborted or cancelled at any stage (during triage, grill-me alignment, plan invalidation, or review):
     - **NEVER delete, revert, or clean up reproduction test files, regression tests, or diagnostic scripts.**
     - Keep all newly authored test files intact on disk for developer reference and future reproduction.
     - Report the file path of any preserved test file(s) in chat before halting.

---

## 1. Initial State Assessment

Check the active `<Artifact Directory>` for an existing implementation plan artifact (e.g. `*plan*.md`):
- **If an active plan exists** → Skip to [Phase B: Has Plan](#phase-b-has-plan).
- **If no plan exists** → Proceed to [Phase A: No Plan](#phase-a-no-plan).

---

## Phase A: No Plan (Intent Triage & Plan Formulation)

### A.1 Intent Classification
Determine the user's intent from the prompt and workspace context:
1. **PR / Review Comments**: Initiated with PR reference or asking to address review feedback.
2. **Bug / Issue**: Initiated with a defect report, error log, or broken behavior.
3. **Feature / Task**: Initiated with a request to create, update, or refactor functionality.

### A.2 PR Review Comment Triage (When Intent = Review Comments)
Follow the standards defined in [`PR_REVIEW_STANDARDS.md`](./PR_REVIEW_STANDARDS.md):
1. **Fetch & Resolve**: Retrieve unresolved threads (`isResolved == false`) and thread IDs via GitHub GraphQL API.
2. **Mandatory Code Inspection**: Call `read_file` on target code files and lines. Never triage from comment text alone.
3. **Filter & Dismissal Check**: Exclude already-fixed code and match against `review-memory` dismissals.
4. **Advisory Triage Report**: Render the full executive summary and breakdown table in chat.
5. **Interactive Selection**: Call `ask_question` (multi-select) for user to accept comments to fix.
6. For accepted comments, formulate the target diffs.

### A.3 Bug Reproduction (When Intent = Bug / Issue)
Follow the standards defined in [`BUG_FIX_STANDARDS.md`](./BUG_FIX_STANDARDS.md):
1. Trace execution paths, inspect all callers, and isolate root cause.
2. Write a minimal reproduction test and verify it **fails** (Red Phase) before touching production code (necessary tests only).

### A.4 Multi-Approach Tradeoff Analysis & Draft Plan
1. **Tradeoff Analysis (When Viable Alternatives Exist)**:
   - If more than one clean implementation or fix strategy exists:
     - Compare options across **Blast Radius** (caller impact), **Complexity** (abstractions vs stdlib), **Line Impact** (net lines), and **Maintainability**.
     - Provide an explicit recommendation based on the Ponytail Ladder (codebase reuse > stdlib > shortest working diff).
2. **Draft Structured Plan**:
   - Target files, functions, and line ranges.
   - Planned minimal diff (exact replacement snippet).
   - Targeted verification command (running necessary tests only).

### A.5 Ambiguity, Tradeoff & Simplicity Gate (Grill-Me)
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
1. Write/snapshot the finalized plan into `<Artifact Directory>/auto_handle_plan.md` with:
   - `ArtifactMetadata`: `{ Summary: "Frozen implementation plan for auto-handle", UserFacing: true, RequestFeedback: false }`
   - Lock banner: `> [!IMPORTANT]\n> ### 🔒 PLAN FROZEN & IMMUTABLE\n> Auto-handle execution active.`
2. Present a clickable link to `auto_handle_plan.md` in chat.

### B.3 Pre-Flight Baseline
Run the targeted baseline test or build command to ensure the current workspace is green before modifications.

### B.4 Autonomous Execution (Applying `ponytail`)
Execute the frozen plan sequentially without conversational pauses:
- **Ponytail Ladder**: Codebase reuse > Stdlib > Native platform features > Shortest working diff.
- Zero unnecessary abstractions or boilerplate.
- Apply surgical edits via `edit_file`.
- Re-run targeted verification tests after each change.

### B.5 Controlled Plan Invalidation & Revision Protocol
If a planned step fails verification or encounters an unexpected technical blocker during execution:
- **Zero Silent Deviation**: Never quietly edit unrelated files or expand scope without logging.
- **Case A: Minor Tactical Amendment** (same strategy, e.g. missing import, null guard, or type adjustment):
  1. Append an amendment entry to `<Artifact Directory>/auto_handle_plan.md`:
     ```markdown
     ### 📝 Amendment #1: <brief description>
     - **Reason**: <why adjustment was necessary to satisfy verification>
     - **Adjusted Diff**: <new minimal replacement snippet>
     ```
  2. Note in chat: `> ℹ️ Plan Amendment #1: [brief reason]`
  3. Apply amendment and re-verify targeted tests.
- **Case B: Major Strategic Invalidation** (approach is fundamentally unviable or invalidates architecture):
  1. **Halt immediately.** Do not touch further files. Preserve all test files and current workspace state intact.
  2. Explain the fundamental roadblock clearly in chat.
  3. Prompt user via `ask_question` with options:
     - `(Recommended) Pivot to Alternative Strategy: <brief description>`
     - `Abort execution (preserve reproduction tests and state)`
  4. If user approves pivot, update `auto_handle_plan.md` with the amended strategy and resume execution. If user aborts, preserve all test files and state intact, report their file paths in chat, and halt cleanly.

---

## Phase C: Post-Execution Verification & Code Review

### C.1 Acceptance Verification
Confirm all targeted test cases pass cleanly (running **necessary tests only**).

### C.2 Review Routing (Fast-Path vs Heavy-Path)
Determine review tier:
- **Fast-Path** (Single file, < 30 lines changed, focused fix/task):
  1. **Dynamic Caller & Regression Verification**:
     - Inspect `git diff` and trace direct callers of the modified function or component.
     - Execute targeted unit tests for affected callers or execute a focused boundary test case (running **necessary tests only**).
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
- **Maximum 1 automatic remediation cycle** by default.
- Only **CRITICAL** or **HIGH** severity blockers trigger automatic re-planning.
- Dismissed items or minor nits are noted in chat as advisory.

### D.2 Remediation Action
- **If blockers are detected (Loop 0)**:
  1. Formulate a remediation plan addressing only the blockers.
  2. Increment loop counter.
  3. Return to **Phase B: Has Plan**.
- **If blockers persist after Loop 1**:
  - Halt, present findings, and ask user for direction via `ask_question`.

### D.3 Plan vs. Reality Compliance Audit
Before finalization, compare the actual modified codebase state (`git diff`) against the frozen plan artifact (`auto_handle_plan.md`) and any logged amendments to guarantee zero silent scope creep:
1. **Target Scope Check**: Did all modified files and functions strictly match the planned targets without unrequested file modifications?
2. **Diff Minimization Check**: Does the diff contain only necessary code to satisfy the plan, with zero extraneous refactoring or boilerplate?
3. **Amendment Justification Check**: Were all deviations or tactical amendments logged and justified in the plan artifact?
4. **Plan Compliance Checklist**: Include a structured checklist in the final report:
   - Target files matched artifact plan? (Yes / No)
   - Diff scope matched artifact plan + logged amendments without extra modifications? (Yes / No)
   - Any amendments logged and justified? (Yes / None needed / Unlogged divergence)
   - Targeted verification tests verified? (Yes / No)

### D.4 Clean Completion & Finalization
When verification is green, the Plan Compliance Audit is confirmed, and no blocking review findings remain:
1. Present the Consolidated Status Report & Plan Compliance Checklist in chat.
2. If working on PR review comments, reply to and resolve threads on GitHub per [`PR_REVIEW_STANDARDS.md`](./PR_REVIEW_STANDARDS.md) (`ADDRESSED`, `INVALID`, or `WONT_FIX`) and render the PR Resolution Summary Table.
3. Commit and push changes safely adhering to [`git-commit-push`](../git-commit-push/SKILL.md).
