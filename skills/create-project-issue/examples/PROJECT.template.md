# PROJECT.md Specification & Template

This file serves as a reference and template for creating a `PROJECT.md` in any repository managed with Antigravity. Place `PROJECT.md` in the root of the repository (or under `.github/PROJECT.md`).

---

## Example `PROJECT.md`

Below is an example of what a repository's `PROJECT.md` looks like:

```markdown
---
main_repo: owner/repo-name
project_url: https://github.com/orgs/my-org/projects/1
---

# Project Configuration

## Target Repository & Board
- **Main Repository**: `owner/repo-name`
- **GitHub Project**: `https://github.com/orgs/my-org/projects/1`

## Issue Types
The project supports the following native GitHub issue types:
- `Bug`: Defects, errors, crashes, and regressions.
- `Feature`: New functional requirements and enhancements.
- `Task`: Maintenance, technical debt, dependencies, and chores.

## Naming Rules
Issues must strictly adhere to the following convention:
- **Format**: `[<TYPE>] <scope>: <concise problem description>`
- **Rules**:
  - `<TYPE>` must be capitalized: `[Bug]`, `[Feature]`, or `[Task]`.
  - `<scope>` must be lowercase and identify the affected module (e.g. `auth`, `ui`, `api`, `cli`, `storage`).
  - The description must be in lowercase, imperative or descriptive mood, and must not end with a period.
  - The title must describe the **problem or gap**, not the proposed solution.
- **Examples**:
  - `[Bug] auth: session cookie is dropped after cross-origin redirect`
  - `[Feature] ui: sidecar panel lacks filter for disabled skills`
  - `[Task] ci: node 22 test runner fails on windows runners`

## Labeling Guidelines
The following labels are available and should be selected based on scope:
- **Components**:
  - `area:auth` - Authentication, sessions, permissions
  - `area:ui` - Frontend components, CSS, sidecar panes
  - `area:api` - Backend routes, RPC, WebSocket handlers
  - `area:infra` - CI/CD, scripts, tooling, build system
- **Priority (Optional)**:
  - `priority:p0` - Blocker / critical outage
  - `priority:p1` - High priority
  - `priority:p2` - Standard backlog
```
