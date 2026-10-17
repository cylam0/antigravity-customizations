# Repo Manager Scoping Rules

When the `repo-manager` plugin is active, follow these operational rules:

1. **Active Repository Scope**:
   - Whenever an `ACTIVE REPOSITORY SCOPE` is injected into the conversation context, strictly confine file searches, file modifications, git operations, and terminal executions to those selected repositories.
   - When calling `run_command`, always set `Cwd` explicitly to the appropriate active repository directory.
   - Do not edit or create files in unticked repositories without explicit user instruction.

2. **Permissive Fallback**:
   - If no repositories are ticked in the Repo Manager panel (no `ACTIVE REPOSITORY SCOPE` is injected), treat all detected repositories in the workspace as active. Do not block execution.

3. **Branch Awareness**:
   - Keep note of the active branch reported for each repository. If a repository is checked out to a protected branch (`main`, `master`, `production`, `release/*`), inform the user before committing or modifying critical files.
