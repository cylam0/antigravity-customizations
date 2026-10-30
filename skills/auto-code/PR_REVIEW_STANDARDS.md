# PR Review Comments Triage & Resolution Standards

Standardized reference for inspecting, evaluating, triaging, and resolving Pull Request review comments within the `auto-code` workflow.

---

## 1. Resolution & Retrieval Usage

### 1.1 Branch & PR Resolution
1. Detect local git root and active branch:
   ```bash
   git rev-parse --show-toplevel
   git branch --show-current
   ```
2. **GitHub CLI Pre-Flight Auth Check**:
   - Run `gh auth status`.
   - If unauthenticated or failing: prompt user to authenticate or paste PR review comments directly. Output final replies and resolution notes as Markdown snippets in chat instead of GraphQL mutations.
3. If a PR number or URL is supplied in the initiating prompt, parse and use that PR.
4. Otherwise, query the active PR associated with the current branch via GitHub CLI:
   ```bash
   gh pr view --json number,title,url,headRefName,baseRefName,state
   ```

### 1.2 Fetching Unresolved Review Threads (GraphQL API)
> [!IMPORTANT]
> Do **NOT** use the REST endpoint `repos/{owner}/{repo}/pulls/{number}/comments` alone — it lacks thread resolution state and returns already-resolved comments.
> Always query GitHub's GraphQL API to strictly filter for unresolved threads (`isResolved == false`):

```bash
gh api graphql -F owner=":owner" -F repo=":repo" -F pr=<number> -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 50) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            originalLine
            comments(last: 5) {
              nodes {
                id
                author { login }
                body
                createdAt
              }
            }
          }
        }
      }
    }
  }
' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

Store each thread's GraphQL `id` as `threadId` (e.g. `PRRT_kwDO...`). This ID is required for posting thread replies and resolving threads.

### 1.3 Early Exit Guard
- If zero unresolved threads remain after filtering:
  - Output: `✅ All review comments on PR #<number> are already resolved. No open issues detected.`
  - Stop review triage cleanly.

---

## 2. Mandatory Code Inspection & Evaluation Standards

### 2.1 Context Protection & Batching Protocol
1. **Thread Truncation**: Retain only the first (initiating) comment and last (latest reply) per thread. Truncate comment bodies over 500 characters.
2. **Group by File**: Collate review threads by file path (`path`) and call `read_file` once per distinct file.
3. **Capped Active Batch**: Process at most 15 unresolved threads per turn (prioritize `isOutdated: false` threads and core source files).

### 2.2 Evaluation Rubric & Inspection
Before classifying any review comment:

1. **Mandatory Source Code Inspection**:
   - For each target file and line range, call `read_file` on source code.
   - **Never** evaluate comments or determine root causes from the reviewer's comment text alone without reading the actual source code.
2. **Already-Fixed Guard**:
   - Inspect whether the issue has already been fixed in subsequent commits on the current branch (common with `isOutdated: true` threads).
   - If the code already implements the fix, mark it as resolved and exclude from action list. Do not touch already-fixed threads on GitHub.
3. **Substance vs Style Rubric**:
   - **Substance First**: Does it identify a functional bug, security issue, race condition, data corruption, or edge case?
   - **Filter Nits**: Ignore pure personal stylistic preferences, subjective formatting preferences, or incorrect reviewer assumptions.
4. **Severity Classification**:
   - **CRITICAL**: Security vulnerability, data loss/corruption, unhandled crash in critical path.
   - **HIGH**: Logic error, boundary violation, broken API contract, resource leak.
   - **MEDIUM**: Unhandled edge case, performance bottleneck, missing validation on trusted-boundary edge.
   - **LOW**: Minor cleanup, documentation typo, non-breaking simplification.
   - **DISPUTABLE / INVALID**: Reviewer made a false assumption, misunderstood architectural intent, or requested out-of-scope changes.
5. **Review Memory Check**:
   - If `skills/review-memory/scripts/memory-store.mjs` exists:
     ```bash
     node skills/review-memory/scripts/memory-store.mjs query
     ```
     If a comment matches a previously dismissed rationale on this branch, flag it as dismissed per review memory.
   - If `memory-store.mjs` is missing, skip review memory check cleanly.

---

## 3. Advisory Triage Report & Artifact Split

To protect the parent context from token exhaustion, the triage report is divided:

1. **Visible Chat Stream**:
   - Render the Executive Summary Table directly in chat immediately before invoking `ask_question`.
2. **Plan Artifact Archiving (`auto_code_plan.md`)**:
   - Write the Detailed Findings Breakdown (root causes, failure modes, and candidate replacement diffs) into `<Artifact Directory>/auto_code_plan.md`.

### Chat Format Template

```markdown
### 📋 PR Review Comments Triage Report
**PR**: [#<number>] <Title> (`<headRefName>` -> `<baseRefName>`)

#### Executive Summary Table
| ID | Location | Reviewer | Severity | Assessment | Target Resolution | Proposed Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `[COMMENT-1]` | `<file>:<line>` | @`<reviewer>` | `CRITICAL` | `VALID` | `Addressed` | Fix via ponytail |
| `[COMMENT-2]` | `<file>:<line>` | @`<reviewer>` | `LOW` | `DISPUTABLE` | `Incorrect` | Technical pushback / No change |

👉 Detailed diffs and analysis archived in [auto_code_plan.md](file:///<path-to-artifact>)
```

### Artifact Breakdown Format (Recorded in `auto_code_plan.md`)

```markdown
### Detailed Findings Breakdown

#### `[COMMENT-1]` `<file>:<line>` by @`<reviewer>`
> "<quoted reviewer comment>"

- **Assessment**: `[VALID - <SEVERITY>]` or `[DISPUTABLE / NO CHANGE NEEDED]`
- **Target Resolution**: `Addressed (ADDRESSED)`, `Incorrect (INVALID)`, or `Won't fix (WONT_FIX)`
- **Root Cause & Technical Analysis**:
  - Behavior, trigger conditions, and blast radius.
- **Actionable Replacement Diff**:
  ```diff
  - old code
  + suggested replacement code
  ```
- **Draft Reply**:
  - If valid: `Addressed in commit <short-sha>: <brief explanation>`
  - If disputable / invalid: `<polite, evidence-based technical justification>`
  - If skipped: `Won't fix for this PR: Deferred / out of scope. <brief rationale>`
```

---

## 4. Interactive User Selection & Decision Recording

Prompt the user using `ask_question` with `is_multi_select: true`:
- List each actionable comment referencing its ID, location, severity, and brief fix summary:
  - `(Recommended) [COMMENT-1] <file>:<line> (<SEVERITY>) - <brief issue summary>`
- Include an explicit cancel option:
  - `None / Cancel (Do not fix any comments)`

### Anti-Premature Execution Rule
The tool call `ask_question` **must** be accompanied by the full triage report in the same turn. Never ask without presenting the analysis.

### Record Decisions in Review Memory
If `skills/review-memory/scripts/memory-store.mjs` exists:
- **Accepted Comments**:
  ```bash
  node skills/review-memory/scripts/memory-store.mjs record-decision --id COMMENT-<N> --status accepted --rationale "Accepted during /auto-code"
  ```
- **Dismissed Comments**:
  ```bash
  node skills/review-memory/scripts/memory-store.mjs record-decision --id COMMENT-<N> --status dismissed --rationale "<reason>"
  ```
Otherwise, skip memory recording cleanly.

---

## 5. GitHub Reply & Thread Resolution Workflow

After code changes are executed and verified (or if user selects "None / Cancel"):

### Resolution Reason Mapping
GitHub GraphQL enum `PullRequestReviewThreadResolutionReason`:
- **`ADDRESSED`**: Comment was accepted and fixed.
- **`INVALID`** (*"Incorrect"* in GitHub UI): Comment was evaluated as a false positive, invalid assumption, or intentional behavior.
- **`WONT_FIX`**: Comment was valid but not selected for fixing (deferred / out of scope).

### Execution Protocol: Automated vs Confirmed Resolution
1. **`ADDRESSED` (Automatic Safe-Path)**:
   - Threads where accepted code fixes were committed (referencing `<short-sha>`) can be automatically replied to and resolved via GraphQL mutations without extra prompts.
2. **`INVALID` & `WONT_FIX` (Interactive Confirmation Gate)**:
   - To prevent social friction and preserve healthy team dynamics, **NEVER** auto-resolve threads as `INVALID` ("Incorrect") or `WONT_FIX` without user confirmation.
   - Present the draft reply in chat and prompt the user via `ask_question`:
     - `(Recommended) Approve reply and resolve thread on GitHub`
     - `Edit reply manually (do not submit or resolve on GitHub)`
     - `Leave thread open for human follow-up`
3. **No Direct Tagging**: Do **NOT** include `@<reviewer>` mentions in reply bodies. GitHub notifies thread participants automatically without extra pings.
4. **Best-Effort Processing**: Iterate through triaged threads. If an individual GraphQL call fails (e.g., permissions or network glitch), log the error and continue processing remaining threads.
5. **Fallback Snippets**: For any failed or skipped API calls, provide ready-to-copy reply snippets in the final report for manual entry.

### GraphQL Mutations

1. **Add Reply to Thread**:
   ```bash
   gh api graphql -f query='
     mutation($threadId: ID!, $body: String!) {
       addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
         comment { id url }
       }
     }
   ' -F threadId="<threadId>" -F body="<draftReply>"
   ```

2. **Resolve Thread**:
   ```bash
   gh api graphql -f query='
     mutation($threadId: ID!, $reason: PullRequestReviewThreadResolutionReason!) {
       resolveReviewThread(input: { threadId: $threadId, resolutionReason: $reason }) {
         thread { id isResolved resolutionReason }
       }
     }
   ' -F threadId="<threadId>" -F reason="<ADDRESSED|INVALID|WONT_FIX>"
   ```

---

## 6. PR Resolution Summary Table

Render a closing summary in chat:

```markdown
### 📋 PR Resolution Summary Table
| ID | Reviewer | Location | Target Resolution | GitHub Status | Reply Summary / Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `[COMMENT-1]` | @`alice` | `src/api.ts:42` | `Addressed` | `Resolved ✅` | Commit `<hash>`: Fixed null check |
| `[COMMENT-2]` | @`bob` | `src/db.ts:15` | `Incorrect` | `Resolved ✅` | Pushback: Handled by outer transaction |
| `[COMMENT-3]` | @`carol` | `src/util.ts:88` | `Won't fix` | `Resolved ✅` | Deferred: Out of scope |
```
