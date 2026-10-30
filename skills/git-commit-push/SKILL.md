---
name: git-commit-push
description: >-
  Safe, structured, high-speed git commit and push workflow with strict no-force-push,
  no pre-push test runs, Git LFS / large file warnings, surgical staging, conventional
  commits, and auto-upstream tracking. Supports commit-only (/commit) and commit-and-push
  (/git-commit-push, /commit-push).
---

# Git Commit & Push Workflow

A high-speed, 2-phase pipeline for safely staging surgical changes, generating conventional commit messages, and pushing with automatic upstream tracking.

> [!NOTE]
> **Branch Confirmation**: Handled by the **Pre-Modification & Commit Branch Confirmation Guard** in `GEMINI.md`. If the active branch has not yet been confirmed in this conversation (e.g. committing pre-existing changes), ensure the user confirms the branch once before staging and committing.

---

## Operational Modes

The workflow supports two modes based on caller intent or invocation:
1. **Commit-Only** (`/commit` or explicit "commit" requests): Stages surgically and creates a conventional commit locally without pushing to remote.
2. **Commit & Push** (`/git-commit-push`, `/commit-push`, explicit "commit and push", or automated pipelines like `auto-fix` and `auto-proceed-plan`): Stages surgically, creates a conventional commit, and pushes to remote with automatic upstream fallback.

---

## High-Speed 2-Phase Execution Protocol

To minimize tool latency and eliminate sequential roundtrips, execute this workflow in strictly **two batched turns**:

```mermaid
flowchart LR
    P1["Turn 1: Pre-Flight & Stage<br/>- Status & branch<br/>- Secret & size scan<br/>- Surgical staging"] --> P2["Turn 2: Commit (± Push)<br/>- Conventional commit<br/>- Local commit OR atomic push<br/>- Auto-upstream tracking"]
```

---

## Phase 1: Pre-Flight Safety & Surgical Staging (Turn 1)

Execute the pre-flight inspection and staging in **one single compound command**:

### 1. Compound Inspection
Run status, branch detection, and diff summary together:
- **PowerShell**: `git status -s; git rev-parse --abbrev-ref HEAD; git diff --stat`
- **Bash / POSIX**: `git status -s && git rev-parse --abbrev-ref HEAD && git diff --stat`

### 2. Fast Safety & Leak Checks (Zero Extra Turns)
Directly evaluate the `git status -s` output:
- **Secret Files**: If any untracked or modified file matches sensitive patterns (`.env*`, `*.pem`, `*.key`, `*.pkcs12`, `*.pfx`, `id_rsa`, `id_ed25519`, `credentials.json`, `service-account*.json`, `token.txt`, `.npmrc`, `.pypirc`), **ABORT** immediately and alert the user to add it to `.gitignore`.
- **Large Files (> 5MB)**: If any modified/untracked file exceeds 5MB or contains untracked model/data weights (`.bin`, `.onnx`, `.tar.gz`, `.iso`, `.sqlite`), warn the user and check for Git LFS before staging.

### 3. Surgical Staging & Diff Confirmation
- Stage only the relevant modified or newly created files (strictly avoid blind `git add .` or `git add -A`):
  ```bash
  git add path/to/file1.ts path/to/file2.ts
  ```
- **NO TESTS OR IN-FLIGHT FORMATTING**: Never run test suites (`npm test`, `pytest`, `cargo test`) or ad-hoc formatters during the commit workflow unless explicitly requested. Formatting is the responsibility of authoring tools, IDE format-on-save, or pre-commit hooks.
- Confirm staged diff stat:
  ```bash
  git diff --cached --stat
  ```

---

## Phase 2: Conventional Commit & Execution (Turn 2)

### 1. Conventional Commit Message Synthesis
From the staged diff stat, synthesize a Conventional Commit message:
```text
<type>(<optional-scope>): <imperative summary under 72 chars>

[optional bullet points explaining WHY and WHAT changed]
```
Allowed types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `chore`, `ci`.

### 2. Atomic Execution

#### Mode A: Commit-Only (Local)
Execute the commit locally without touching remote:
- **PowerShell / Bash**:
  ```bash
  git commit -m "<message>"
  ```

#### Mode B: Commit & Push (Remote with Upstream Fallback)
Execute commit and push in **one single atomic compound execution** with automatic upstream fallback:
- **PowerShell**:
  ```powershell
  git commit -m "<message>"; if ($LASTEXITCODE -eq 0) { git push; if ($LASTEXITCODE -ne 0) { git push -u origin (git rev-parse --abbrev-ref HEAD) } }
  ```
- **Bash / POSIX**:
  ```bash
  git commit -m "<message>" && (git push || git push -u origin $(git rev-parse --abbrev-ref HEAD))
  ```

### 3. STRICT Divergence & Safety Guards
- **STRICT: NEVER FORCE PUSH** (`--force`, `-f`, or `--force-with-lease`).
- If push is rejected due to remote divergence (non-fast-forward):
  - **STOP IMMEDIATELY**.
  - Advise the user to pull and rebase cleanly: `git pull --rebase origin <branch>`.

### 4. Completion Output
Output a concise 3-line summary:
- **Commit**: `<hash>` — `<message title>`
- **Branch**: `<branch>` (local commit only | pushed to remote)
- **Files**: List of committed files
