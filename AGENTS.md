# Global Rules

## SQL Command Execution Rule

- **SQL Confirmation**: Never execute SQL commands directly on the database unless explicitly instructed by the user. Always ask the user for explicit confirmation before running any SQL migrations, queries, or updates.

## Non-Interactive Test Execution Rule (Anti-Watch & Anti-Hang Guard)

- **Single-Run Only**: Test commands executed via `run_command` must **NEVER** run in interactive or watch mode (`Waiting for file changes...`).
  - **Vitest**: Always pass `run` or `--run`, or prepend `$env:CI="true";` in PowerShell (`CI=true` in POSIX). E.g.:
    - `npx vitest run <path>` (NEVER run bare `npx vitest <path>` or bare `npm test` without `run`).
    - `npm test -- run <path>`
    - `$env:CI="true"; npm test -- run <path>`
  - **Jest / Other Runners**: Pass `--watch=false` or `--watchAll=false`.
- **Immediate Task Kill on Watch Detection**: If a test command does not exit within `WaitMsBeforeAsync`, gets backgrounded as a task, or shows `Waiting for file changes...` / `press h to show help, press q to quit`:
  - **DO NOT wait for the task to finish** (watch-mode processes never terminate and will freeze the agent indefinitely).
  - Immediately call `manage_task` with `Action: "kill"` to terminate the hanging process.
  - Re-run the test command with explicit non-interactive flags (`$env:CI="true"; npx vitest run <path>`).
