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

### A.4 Draft Implementation Plan
Formulate a concise, structured plan detailing:
- Target files and functions.
- Planned minimal diff (following `ponytail` principles).
- Targeted verification command.

### A.5 Ambiguity & Simplicity Gate (Grill-Me)
Inspect the drafted plan:
- Does it contain ambiguities, hidden assumptions, or unclarified user expectations?
- Is it unnecessarily complex or speculative?
- **If ambiguous or complex**: Run the `/grill-me` clarification interview (using `ask_question` or concise conversational queries) to resolve design decisions, then update the plan.
- **If clear and simple**: Proceed to Phase B.

---

## Phase B: Has Plan (Clarification & Autonomous Execution)

### B.1 Plan Verification & Gap Fill
1. Inspect the existing plan artifact.
2. Check for missing context, stale assumptions, or unaddressed edge cases.
3. If gaps exist, run `/grill-me` to clarify and update the plan.

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

---

## Phase C: Post-Execution Verification & Code Review

### C.1 Acceptance Verification
Confirm all targeted test cases pass cleanly (running **necessary tests only**).

### C.2 Review Routing (Fast-Path vs Heavy-Path)
Determine review tier:
- **Fast-Path** (Single file, < 30 lines changed, routine fix):
  - In-line Ponytail Simplicity Audit (verify zero over-engineering, stdlib reuse).
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

### D.3 Clean Completion & Finalization
When verification is green and no blocking review findings remain:
1. Provide a concise execution summary.
2. If working on PR review comments, reply to and resolve threads on GitHub per [`PR_REVIEW_STANDARDS.md`](./PR_REVIEW_STANDARDS.md) (`ADDRESSED`, `INVALID`, or `WONT_FIX`).
3. Commit and push changes safely adhering to [`git-commit-push`](../git-commit-push/SKILL.md).
