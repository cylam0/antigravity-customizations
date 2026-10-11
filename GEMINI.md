# GEMINI.md - Antigravity Customizations Monorepo

## Overview

This repository is the central management and development monorepo for Google Antigravity customizations, including custom **UI extensions (plugins)**, **sidecars**, and **skills**.

Customizations developed here are deployed to and synced with Antigravity's global configuration directory (`~/.gemini/config/`).

---

## Repository Structure

```text
antigravity-customizations/
├── agents/                        # Custom subagents and orchestrators
│   ├── code-reviewer/             # Multi-agent code review orchestrator
│   ├── reviewer-logic/            # Reliability & boundary condition specialist
│   ├── reviewer-security/         # Application security specialist
│   └── reviewer-simplification/   # Minimalist/YAGNI code simplification specialist
├── plugins/                       # Antigravity plugins & UI extensions
│   ├── skills-manager/            # Interactive Sidecar UI extension to manage skills
│   │   ├── assets/                # Plugin icons and static graphics
│   │   ├── sidecars/panel/        # Sidecar web UI (HTML, CSS, JS) and backend (main.mjs)
│   │   ├── plugin.json            # Plugin manifest definition
│   │   └── README.md
│   └── modern-web-guidance-plugin/# Web development guidance plugin
├── skills/                        # Standalone custom skills
│   ├── codebase-guard/            # Issue library and tagging audit skill
│   ├── code-review/               # Multi-agent review slash command (/code-review)
│   ├── karpathy-guidelines-nodejs-agent/ # Node.js agent constraints & practices
│   ├── ponytail/                  # Minimalist/YAGNI code simplification skill
│   ├── ponytail-review/           # Over-engineering code review skill
│   └── review-common/             # Shared code review persona and rubrics
├── sync.ps1                       # Bi-directional sync script (Robocopy engine)
├── package.json                   # NPM lifecycle scripts for deployment and verification
├── README.md                      # Public overview documentation
└── GEMINI.md                      # Workspace context and rules for AI agents
```

---

## Core Commands & Scripts

All primary workflows are available via `npm` scripts:

| Command | Script Target | Description |
| :--- | :--- | :--- |
| `npm run deploy` | `powershell ... sync.ps1` | Deploys all plugins, skills, and agents from this repository into `~/.gemini/config/`. |
| `npm run sync` | `npm run deploy` | Alias for `npm run deploy`. |
| `npm run pull` | `powershell ... sync.ps1 -FromAntigravity` | Pulls live edits made inside Antigravity back into this repository. |
| `npm test` | `node --check ... && node scripts/...` | Runs script syntax checks and frontmatter validation across skills & agents. |
| `npm run check` | `npm test` | Alias for syntax and schema validation. |

---

## Synchronization Workflows

### 1. Deploying Repository Changes to Antigravity
When you make changes to plugins or skills in this repository:
```bash
npm test          # Verify syntax of all scripts
npm run deploy    # Copy files to ~/.gemini/config/
```

### 2. Pulling Live Runtime Changes Back to the Repository
When skills or settings are modified directly from within Antigravity:
```bash
npm run pull      # Sync files from ~/.gemini/config/ into repo
git status        # Review changes
git add .
git commit -m "feat/fix: sync updates from Antigravity"
git push
```

> **Note on Exclusions:** The sync script automatically ignores transient and environment-specific folders:
> - `plugins/`: ignores `node_modules/`, `.data/`, and `logs/`
> - `skills/`: ignores `.disabled/`

---

## Authoring Standards & Conventions

### 1. Skills (`skills/<skill-name>/SKILL.md`)
- **Frontmatter**: Each skill must contain YAML frontmatter with `name` and `description`:
  ```yaml
  ---
  name: my-skill
  description: Clear summary of the skill's capability and specific trigger keywords.
  ---
  ```
- **Progressive Disclosure**: Keep descriptions action-oriented and keyword-rich so Antigravity can discover them on demand without blowing context budgets.
- **Modularity**: Supporting files (reference docs, checklists, issue templates) should reside inside the skill's subdirectory or relative resources.

### 2. Plugins & Sidecars (`plugins/<plugin-name>/`)
- **Plugin Manifest**: Must include a valid `plugin.json` declaring `name`, `description`, and any assets.
- **Sidecar Architecture**:
  - UI extensions live under `sidecars/<pane-name>/`.
  - Configured via `sidecar.json` specifying entrypoint (e.g. `SIDECAR_UI_ENTRYPOINT_AUX_PANE`), process command, and restart policy.
  - Backend servers use Node.js ES Modules (`.mjs`) importing `sidecar_sdk`.
- **Node.js Guidelines**:
  - Prefer native Node.js APIs (`node:fs`, `node:path`, `node:os`, `node:url`) over third-party dependencies.
  - Implement strict path traversal guards (normalize, resolve, and assert canonical boundaries) for security.
  - Ensure Windows path compatibility (handle drive letters, path separators, and case insensitivity).
- **Web UI Guidelines**:
  - Responsive, clean UI matching Antigravity's native dark/light theme tokens.
  - Pure vanilla JavaScript, CSS, and semantic HTML without complex bundle build steps unless necessary.

### 3. Custom Agents (`agents/<agent-name>/agent.md`)
- **Frontmatter**: Must include `name`, `description`, `kind: local`, and `model` (e.g. `gemini-3.1-pro` or `inherit`).
- **Subagent vs Main**: Set `subagent: true` for specialist roles callable by orchestrators; set `mainAgent: true` for top-level entrypoints.
- **Output Contracts**: Adversarial reviewers should output strict JSON array findings to facilitate automated aggregation and consensus voting.

---

## Agent Operational Rules

1. **Verify Before Deploying**: Always run `npm test` (or `node --check`) before executing `npm run deploy` to avoid breaking Antigravity's runtime sidecars.
2. **Preserve User Edits**: Before overwriting any files when running syncs, confirm whether any uncommitted local work exists using `git status`.
3. **Cross-Platform Compatibility**: Always ensure scripts and path logic work correctly on Windows (`PowerShell`, backslashes, drive roots) as well as POSIX systems.
