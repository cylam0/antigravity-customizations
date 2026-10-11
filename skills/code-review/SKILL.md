---
name: code-review
description: >-
  Adversarial multi-agent code review orchestrator with consensus voting and multi-repo support.
  CRITICAL: ONLY activate this skill when the user explicitly triggers the `/code-review` slash command.
  DO NOT auto-trigger or invoke this skill for general coding, questions, or informal diff checks.
---

# Multi-Agent Code Review Workflow

Adversarial multi-agent code review orchestrator coordinating logic, security, and simplification specialists with consensus voting.

## 0. Invocation Guard

Check the initiating user prompt:
- If this turn was **NOT** explicitly initiated by `/code-review` (or an explicit direct request for this multi-agent review), **ABORT** this workflow immediately and answer normally without invoking subagents.
- Never call subagents automatically for routine questions or diff queries.

## 1. Multi-Repository & Diff Resolution

Resolve the target repositories and diffs using smart cascade:
1. Scan for active git repositories in the workspace:
   - Root directory (`git rev-parse --show-toplevel`).
   - Sibling or child folders containing `.git` or declared in `.gitmodules`.
   - Any specific repository argument provided by user (`/code-review <repo>`).
2. For each repository, inspect git status:
   - If user passed a git range: `git -C <repo> diff <range>`
   - Else if uncommitted changes exist: `git -C <repo> diff HEAD`
   - Else if branch diverged from default: `git -C <repo> diff origin/main...HEAD` (or `main...HEAD`)
   - Fallback: `git -C <repo> diff HEAD~1`
3. Skip repositories with clean diffs. If all are clean, return: "No changes detected across repositories."
4. **Persistent Review Memory Query**:
   - For each target repo, detect branch (`git -C <repo> rev-parse --abbrev-ref HEAD`).
   - Query persistent memory via `node skills/review-memory/scripts/memory-store.mjs query --repo <repo> --branch <branch> --files "<files>"` to retrieve active conventions and previously dismissed anchor signatures.

## 2. Spawn Specialist Reviewers

Concurrently invoke the three specialist subagents using `invoke_subagent`:
- **`reviewer-logic`** (`gemini-3.1-pro`): Reliability, boundaries, async/promises, race conditions, leaks, and cross-repo API contract mismatches.
- **`reviewer-security`** (`gemini-3.1-pro`): Injections, authorization bypasses, IDOR, data/credential exposure, insecure dependencies.
- **`reviewer-simplification`** (`gemini-3.8-flash`): Over-engineering, dead flexibility, reinvented stdlib, bloated abstractions.

Pass the repository path, relative file list, diff content, and any **Active Project Conventions** loaded from review memory to each subagent.

## 3. Two-Tier Consensus & Verification

Collect and parse JSON outputs from all three specialists:
1. **Memory Filter**: Compare candidate findings against `dismissedSignatures` for the active branch. If a finding matches a previously dismissed rationale, move it to `skippedFindings` (do not flag as active blocker or warning).
2. **Critical / Blocker**: Retain immediately.
3. **Moderate / Warning / Simplification**: Retain if agreed upon across 2+ subagents OR verified by inspecting the surrounding code in the local file.
4. **Discard**: Drop unverified warnings and purely stylistic nitpicks.
5. **Line-Anchor**: Strictly ensure retained comments point to lines modified in the diff (`+` or `-`).

## 4. Output Presentation

Format the final review report:
- **Assign Stable IDs**: Tag each retained finding sequentially (`[REV-1]`, `[REV-2]`, etc.).
- **Persist Session Snapshot**: Save the findings to session memory via `node skills/review-memory/scripts/memory-store.mjs save-session`.
- **Executive Summary Table**: Scanned repositories, findings count by category, and simplification metric (`net: -<N> lines possible`).
- **Grouped Findings**: For each repository with issues:
  - Header: `### [REV-X] [<SEVERITY> <DOMAIN>] <Title> - <file-link>`
  - Concrete risk & failure mode explanation.
  - Actionable inline replacement diff block (`- old` / `+ new`).
- **Dismissed Audit Trail**: If `skippedFindings` exist, render a collapsed summary at the bottom:
  ```markdown
  <details>
  <summary>Skipped <N> previously dismissed findings for this branch</summary>

  - **[REV-old]** `<file>`: <type> (<rationale>)
  </details>
  ```
- **Verdict**: Blocking issues detected / Changes recommended / Approved.
- **Actionable Footer**:
  > *💡 Reply `Accept REV-1` or `Dismiss REV-2: <reason>` to record decisions. Reply `Un-dismiss REV-1` to revoke. Reply `Note convention: <rule>` to capture conventions.*

