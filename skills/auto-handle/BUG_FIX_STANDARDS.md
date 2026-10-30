# Bug Triage & Reproduction Standards

Standardized reference for triaging, reproducing, and verifying bug fixes within the `auto-handle` workflow.

---

## 1. Core Invariant: Run Necessary Tests Only

Across all testing and verification stages:
- **Never run monolithic or entire-workspace test suites.** Blindly executing full test suites wastes time and risks failure on unrelated pre-existing flakiness.
- **Target only the specific file or pattern**: Execute only the isolated reproduction test or affected module tests (e.g., `npm test -- path/to/test.test.mjs`, `pytest tests/test_module.py::test_case`, `go test ./pkg/... -run TestName`).

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

1. **Write Isolated Reproduction Test**:
   - Construct a minimal, isolated test triggering the bug and asserting correct behavior.
   - Place in appropriate test directory or scratch test runner.
2. **Execute & Confirm Failure**:
   - Run targeted test via `run_command` (necessary tests only).
   - **Confirm the test FAILS** with the expected error before modifying any production code.
   - If the test does not fail, refine the test until the failure is reliably reproduced.

---

## 4. Stage 3: Multi-Fix Tradeoff Comparison

If more than one clean way to fix the problem exists:
1. Outline viable options (e.g., boundary guard, handler refactor, configuration adjustment).
2. Compare tradeoffs: blast radius, complexity, line impact, caller impact.
3. Recommend the minimal root-cause fix applying `ponytail` principles (fix where callers route through, fewest lines).

---

## 5. Stage 4: Controlled Plan Revision Protocol

If the planned diff fails to make the reproduction test pass or encounters an unexpected blocker during execution:
- **Zero Silent Deviation**: Never quietly edit unrelated files without recording the reason.
- **Minor Tactical Amendment** (e.g., missing null guard, type cast, or import):
  - Append amendment to the frozen plan artifact (`auto_handle_plan.md`):
    ```markdown
    ### 📝 Amendment #1: <brief description>
    - **Reason**: <why adjustment was necessary to pass test>
    - **Adjusted Diff**: <new minimal replacement snippet>
    ```
  - Note in chat and re-verify reproduction test.
- **Major Strategic Invalidation** (approach is fundamentally unviable):
  - Halt immediately without further edits.
  - Explain roadblock and use `ask_question` to pivot or cancel.

---

## 6. Stage 5: Post-Fix Verification (Red to Green)

1. Re-run the isolated reproduction test.
2. Verify transition from **RED** (failing) to **GREEN** (passing).
3. Verify that no unintended regressions were introduced in the immediate module.
