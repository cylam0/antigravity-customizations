---
name: auto-review-pr
description: >-
  CRITICAL: ONLY activate this skill when the user explicitly triggers the `/auto-review-pr` slash command.
  DO NOT auto-trigger or invoke this skill for general coding, reviewing, debugging, or triage tasks.
  When invoked via `/auto-review-pr`, fetches and triages PR review comments for the current branch under code-review-commons standards, asks the user via multi-select which comments to accept, and triggers auto-fix for the issues related to the accepted comments.
argument-hint: "[<pr-number-or-url>]"
---

# Auto-Review PR Workflow

Automated PR review comment triage and resolution workflow. Fetches open pull request review comments for the current branch, evaluates each under `code-review-commons` standards, presents an advisory triage report, interactively asks the user via multi-select which comments to accept, and triggers the systematic 9-stage `auto-fix` workflow for each accepted issue.

---

## 0. Invocation Guard

Check the initiating user prompt:
- If this turn was **NOT** explicitly initiated by `/auto-review-pr` (e.g. `/auto-review-pr` or `/auto-review-pr <pr-number/url>`), **ABORT** this workflow immediately and proceed with normal conversational or coding behavior without applying auto-review-pr constraints.
- Do **NOT** auto-trigger for general code reviews, PR queries, comment triage, or when words like "review", "pr", or "comments" appear in casual conversation.
- Do **NOT** persist across subsequent turns unless the user explicitly invokes `/auto-review-pr` again.

---

## 1. Branch & PR Resolution

1. Detect current repository root and branch:
   ```bash
   git rev-parse --show-toplevel
   git branch --show-current
   ```
2. If a PR number or URL is supplied in the initiating slash command (e.g. `/auto-review-pr 42` or `/auto-review-pr https://github.com/owner/repo/pull/42`), parse and use that PR.
3. Otherwise, retrieve the active Pull Request associated with the current branch via GitHub CLI:
   ```bash
   gh pr view --json number,title,url,headRefName,baseRefName,state
   ```
4. Fetch inline review comments and conversation threads:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
   gh pr view --comments
   ```
   *Fallback:* If `gh` is unauthenticated or no PR exists for this branch, prompt user:
   > *"No active PR found via `gh`. Please supply the PR number, URL, or paste the comment thread."*
5. Filter for open/unresolved comments. If no unresolved comments exist on the PR, inform the user:
   > *"✅ No unresolved review comments found on PR #<number> (<title>)."*
   and halt cleanly.

---

## 2. Evaluation via Code Review Commons & Review Memory

For each unresolved review comment:
1. **Context Lookup**: Inspect the referenced file and line range using `read_file`.
2. **Apply Standards**: Evaluate strictly under [`skills/review-common/SKILL.md`](../review-common/SKILL.md) (`code-review-commons`):
   - **Substance First**: Does it identify a functional bug, security issue, race condition, data corruption, or edge case?
   - **Filter Nits**: Ignore pure stylistic preferences, formatting preferences, or invalid reviewer assumptions.
   - **Severity**: Classify as **CRITICAL**, **HIGH**, **MEDIUM**, **LOW**, or **INVALID/NO FIX NEEDED**.
3. **Review Memory Check**: Query [`skills/review-memory/SKILL.md`](../review-memory/SKILL.md) to check for known branch dismissals or project conventions:
   ```bash
   node skills/review-memory/scripts/memory-store.mjs query
   ```
   If a comment matches a previously dismissed rationale on this branch, flag it as dismissed per review memory.

---

## 3. Advisory Triage Report

Present findings clearly in chat with designated comment identifiers before requesting user selection:

### PR: [#<number>] <Title> (`<headRefName>` -> `<baseRefName>`)

For each comment:
#### `[COMMENT-<N>]` `<file>:<line>` by @`<reviewer>`
> "<quoted reviewer comment>"

- **Assessment**: `[VALID - <SEVERITY>]` or `[DISPUTABLE / NO CHANGE NEEDED]`
- **Rationale**: 1-2 sentences on correctness, failure mode, and potential blast radius.
- **Actionable Replacement Diff** (if code change needed):
  ```diff
  - old code
  + suggested replacement code
  ```
- **Draft Reply** (if pushback, explanation, or clarification needed).

---

## 4. Interactive Selection of Comments to Accept (Multi-Select)

Prompt the user to choose which valid comments to accept and fix using the `ask_question` tool with `is_multi_select: true`.

### Tool Call Configuration
- `is_multi_select`: `true`
- `question`: "Select which PR review comments to accept and auto-fix:"
- `options`:
  - List each valid actionable comment formatted as the user's response:
    - Prefix recommended comments (e.g. **CRITICAL**, **HIGH**, **MEDIUM**) with `(Recommended)`:
      - `"(Recommended) [COMMENT-1] <file>:<line> - <brief issue summary>"`
      - `"(Recommended) [COMMENT-2] <file>:<line> - <brief issue summary>"`
    - List any lower-priority or disputable comments without the prefix.
  - Include an explicit cancel option:
    - `"None / Cancel (Do not fix any comments)"`

### Handling the User Decision
- **If the user selects one or more comments:**
  - Proceed immediately to **Stage 5** to fix each accepted comment.
- **If the user selects "None / Cancel" (or selects zero comments):**
  - Record any dismissed comments in review memory if rationales were supplied:
    ```bash
    node skills/review-memory/scripts/memory-store.mjs record-decision --id COMMENT-<N> --status dismissed --rationale "<reason>"
    ```
  - Halt cleanly without modifying any codebase files.

---

## 5. Trigger Auto-Fix for Accepted Comments

For each accepted comment, execute the systematic 9-stage **Auto-Fix** workflow defined in [`skills/auto-fix/SKILL.md`](../auto-fix/SKILL.md).

> [!NOTE]
> Process accepted comments sequentially in order of severity (**CRITICAL** -> **HIGH** -> **MEDIUM** -> **LOW**).

For each accepted comment `[COMMENT-<N>]`:

1. **Initialize Auto-Fix Context**:
   - Construct the problem description:
     `"<file>:<line>: <reviewer comment / problem description> (PR #<number> [COMMENT-<N>])"`
   - Record acceptance in review memory:
     ```bash
     node skills/review-memory/scripts/memory-store.mjs record-decision --id COMMENT-<N> --status accepted --rationale "Accepted during /auto-review-pr"
     ```

2. **Execute Auto-Fix Stages (from `skills/auto-fix/SKILL.md`)**:
   - **Stage 1 (Triage & Code Analysis)**: Trace execution paths and confirm root cause.
   - **Stage 2 (Reproduction Test)**: Build isolated reproduction test asserting correct behavior; confirm it FAILS (RED).
   - **Stage 3 & 4 (Explain & Multi-Fix Comparison / Decision)**: Formulate fix options; if tradeoffs exist, prompt user or proceed with recommended minimal approach.
   - **Stage 5 (Frozen Plan Artifact)**: Create `<Artifact Directory>/auto_fix_plan.md` locking the target files, diff, and verification commands.
   - **Stage 6 (Execute Plan via `ponytail`)**: Apply minimal surgical fix adhering to `ponytail` (shortest working diff, no over-engineering); verify reproduction test passes (GREEN).
   - **Stage 7 (Multi-Dimensional Post-Fix Review)**: Run regression subagent (`TypeName: "self"`, `Role: "Regression Tester & Verifier"`) to verify edge cases and callers.
   - **Stage 8 (Consolidated Status Report)**: Report test transitions and plan compliance.
   - **Stage 9 (Automated Git Commit & Push via `git-commit-push`)**: Commit surgically with conventional commit message referencing the comment (e.g. `fix(<scope>): address review comment on <file> (#<pr-number>)`) and push upstream.

---

## 6. Final Summary & PR Status

After all accepted comments are resolved and committed:
1. Present a concise wrap-up report:
   - **Resolved Comments**: List of resolved comments with corresponding commit hashes.
   - **Dismissed / Skipped Comments**: List of any comments that were skipped or dismissed with recorded rationales.
   - **Branch & PR Status**: Current commit HEAD and push status.
2. Provide ready-to-paste draft responses for each comment on GitHub, or offer to post replies via `gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies` if confirmed by the user.
