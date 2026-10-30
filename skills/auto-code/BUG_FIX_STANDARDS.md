# Bug Triage & Reproduction Standards

Standardized reference for triaging, reproducing, and verifying bug fixes within the `auto-code` workflow.

---

## 1. Core Invariant: Run Necessary Tests Only

Across all testing and verification stages:
- **Never run monolithic or entire-workspace test suites.** Blindly executing full test suites wastes time and risks failure on unrelated pre-existing flakiness.
- **Target only the specific file or pattern**: Execute only the isolated reproduction test or affected module tests (e.g., `npm test -- path/to/test.test.mjs`, `pytest tests/test_module.py::test_case`, `go test ./pkg/... -run TestName`).
- **Terminal Log Suppression**: Use dot, quiet, or bail flags (e.g., `npm test -- --reporter=dot`, `pytest -q --tb=short`, `go test -short`) to suppress verbose outputs from flooding the conversation transcript.

---

## 2. Stage 1: Triage & Root Cause Analysis

1. **Trace Callers & Data Flow**:
   - Grep for all callers of the affected function before modifying code.
   - Identify the root cause where all callers route through, rather than patching only the reported symptom in a single caller.
2. **Handling "No Problem Found" or Ambiguity**:
   - If the code operates as designed, cannot be reproduced, or the description is under-specified:
     - **Do NOT speculate or fabricate changes.**
     - Inspect and explain why current implementation appears correct.
     - Prompt user via `ask_question`:
       1. *Provide additional reproduction details* (error payload, stack trace, environment specifics) -> Re-triage.
       2. *Write expected behavior test anyway* -> Assert expected behavior. If it passes, code works as intended (exit cleanly). If it fails, advance to Red Phase.
       3. *Working as Intended* -> Exit cleanly without modifying codebase.

---

## 3. Stage 2: Build Reproduction Test (Red Phase)

1. **Test Placement & Classification**:
   - **Permanent Regression Test**: Place inside project test directory (e.g. `tests/`). Use clear naming (e.g., `tests/repro_<issue>.test.ts`) so new test artifacts are easily identifiable.
   - **Ephemeral Diagnostic Probe (Scratch)**: Write to `<Artifact Directory>/scratch/` when probing standalone logic to avoid workspace changes.
2. **Execute & Confirm Failure**:
   - Run targeted test via `run_command` (necessary tests only).
   - **Confirm the test FAILS** with the expected error before modifying any production code.
   - If the test does not fail, refine the test until the failure is reliably reproduced.
3. **Abort & Cleanup Guard**:
   - If execution is aborted before the fix is completed:
     - Prompt the user whether to keep the newly created reproduction test or delete it, avoiding untracked test pollution.

---

## 4. Stage 3: Multi-Fix Tradeoff Comparison

If more than one clean way to fix the problem exists:
1. Outline viable options (e.g., boundary guard, handler refactor, configuration adjustment).
2. Compare tradeoffs: blast radius, complexity, line impact, caller impact.
3. Recommend the minimal root-cause fix applying `ponytail` principles (fix where callers route through, fewest lines).

---

## 5. Stage 4: Controlled Plan Revision Protocol

If the planned implementation fails verification or encounters an unexpected blocker during execution:
- **Zero Silent Deviation**: Never quietly edit unrelated files without recording the reason.
- **Tactical Adjustments (No Formal Amendment Required)**:
  - Minor fixes (missing import, syntax tweak, null guard, type cast within target files) do not require formal markdown amendments. Apply directly, note in chat (e.g., `> ℹ️ Added missing null check for user.id`), and re-run verification.
- **Formal Amendments (Plan Artifact Update Required)**:
  - If an **unplanned file** must be touched or an API/contract changes:
    - Append amendment to the frozen plan artifact (`auto_code_plan.md`):
      ```markdown
      ### 📝 Amendment #1: <brief description>
      - **Reason**: <why adjustment was necessary>
      - **Target Files / Changes**: <new target files or contract adjustment>
      ```
    - Note in chat and re-verify.
- **Major Strategic Invalidation** (approach is fundamentally unviable):
  - Halt immediately without touching further production files.
  - Explain roadblock and use `ask_question` to pivot or cancel.
  - On cancellation, prompt whether to keep or remove the reproduction test.

---

## 6. Stage 5: Post-Fix Verification (Red to Green) & Static Analysis Gate

1. **Reproduction Proof**: Re-run the isolated reproduction test and verify transition from **RED** to **GREEN**.
2. **Static Analysis & Typecheck Gate**:
   - **Targeted Lint**: Run linter on *only modified files* (e.g. `npx eslint <modified_files>`, `ruff check <modified_files>`).
   - **Project Typecheck / Compilation**: If project uses static typing or compiled languages (TypeScript `tsconfig.json`, Rust `Cargo.toml`, Go `go.mod`), run a fast non-emitting check (`npx tsc --noEmit`, `cargo check`, `go vet`).
   - Fix any type errors or lint warnings introduced by the changes before concluding verification.
3. **Dynamic Caller & Regression Check**:
   - Trace all callers of the modified function.
   - Run targeted tests for directly affected caller modules or write a focused boundary test case covering edge values (null, empty, limits).
   - Ensure necessary tests pass cleanly with zero side effects.
