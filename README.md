# Antigravity Customizations

A collection of custom UI extensions, plugins, and skills for Google Antigravity.

## Structure

```text
antigravity-customizations/
├── plugins/                  # UI extension plugins (e.g. skills-manager)
│   └── skills-manager/
├── skills/                   # Standalone skills
├── sync.ps1                  # Two-way sync script with Antigravity
├── package.json              # NPM scripts for deployment and verification
└── README.md
```

## Commands

| Command | Action |
| :--- | :--- |
| `npm run deploy` (or `npm run sync`) | Deploys all plugins and skills from this repo into Antigravity. |
| `npm run pull` | Pulls edits/creations from Antigravity back into this repo. |
| `npm test` (or `npm run check`) | Runs syntax checks across all sidecar backend scripts. |

## Workflow

1. **Pulling changes made in Antigravity:**
   ```bash
   npm run pull
   git add .
   git commit -m "feat: updated skills"
   git push
   ```

2. **Deploying repo changes to Antigravity:**
   ```bash
   git pull
   npm run deploy
   ```
