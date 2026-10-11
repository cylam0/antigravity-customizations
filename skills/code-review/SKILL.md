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

## 2. Spawn Specialist Reviewers

Concurrently invoke the three specialist subagents using `invoke_subagent`:
- **`reviewer-logic`** (`gemini-3.1-pro`): Reliability, boundaries, async/promises, race conditions, leaks, and cross-repo API contract mismatches.
- **`reviewer-security`** (`gemini-3.1-pro`): Injections, authorization bypasses, IDOR, data/credential exposure, insecure dependencies.
- **`reviewer-simplification`** (`gemini-3.8-flash`): Over-engineering, dead flexibility, reinvented stdlib, bloated abstractions.

Pass the repository path, relative file list, and diff content to each subagent.

## 3. Two-Tier Consensus & Verification

Collect and parse JSON outputs from all three specialists:
1. **Critical / Blocker**: Retain immediately.
2. **Moderate / Warning / Simplification**: Retain if agreed upon across 2+ subagents OR verified by inspecting the surrounding code in the local file.
3. **Discard**: Drop unverified warnings and purely stylistic nitpicks.
4. **Line-Anchor**: Strictly ensure retained comments point to lines modified in the diff (`+` or `-`).

## 4. Output Presentation

Format the final review report:
- **Executive Summary Table**: Scanned repositories, findings count by category, and simplification metric (`net: -<N> lines possible`).
- **Grouped Findings**: For each repository with issues:
  - Header: `### [<SEVERITY> <DOMAIN>] <Title> - <file-link>`
  - Concrete risk & failure mode explanation.
  - Actionable inline replacement diff block (`- old` / `+ new`).
- **Verdict**: Blocking issues detected / Changes recommended / Approved.
