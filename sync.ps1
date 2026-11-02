<#
.SYNOPSIS
    Syncs plugins and skills between this repository and Antigravity's global config directory.

.EXAMPLE
    .\sync.ps1
    Deploys all plugins and skills from this repo into Antigravity using skills-store and skills.json.

.EXAMPLE
    .\sync.ps1 -FromAntigravity
    Pulls edits made inside Antigravity back into this repo so you can git commit & push.
#>

param(
    [switch]$FromAntigravity
)

$repo = $PSScriptRoot
$cfgPlugins      = "$env:USERPROFILE\.gemini\config\plugins"
$cfgSkillsStore  = "$env:USERPROFILE\.gemini\config\skills-store"
$cfgSkillsLegacy = "$env:USERPROFILE\.gemini\config\skills"
$cfgSkillsConfig = "$env:USERPROFILE\.gemini\config\skills.json"
$cfgAgents       = "$env:USERPROFILE\.gemini\config\agents"

# Ensure target directories exist
New-Item -ItemType Directory -Path "$repo\plugins", "$repo\skills", "$repo\agents" -Force | Out-Null
New-Item -ItemType Directory -Path $cfgPlugins, $cfgSkillsStore, $cfgAgents -Force | Out-Null

function Run-Robocopy {
    param($src, $dst, $excludeDirs = @())
    $argsList = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS")
    if ($excludeDirs.Count -gt 0) {
        $argsList += "/XD"
        $argsList += $excludeDirs
    }
    & robocopy @argsList | Out-Null
    # Robocopy exit codes 0-7 mean successful copies
    if ($LASTEXITCODE -gt 7) {
        Write-Warning "Robocopy encountered errors between '$src' and '$dst' (exit code: $LASTEXITCODE)."
    }
}

if ($FromAntigravity) {
    Write-Host "Syncing from Antigravity -> Git Repo..." -ForegroundColor Cyan
    Run-Robocopy "$cfgPlugins" "$repo\plugins" @("node_modules", ".data", "logs", ".git")
    if (Test-Path $cfgSkillsStore) {
        Run-Robocopy "$cfgSkillsStore" "$repo\skills" @(".git")
    } elseif (Test-Path $cfgSkillsLegacy) {
        Run-Robocopy "$cfgSkillsLegacy" "$repo\skills" @(".disabled", ".git")
    }
    Run-Robocopy "$cfgAgents" "$repo\agents" @(".disabled", ".git")
    if (Test-Path "$env:USERPROFILE\.gemini\config\AGENTS.md") {
        Copy-Item "$env:USERPROFILE\.gemini\config\AGENTS.md" "$repo\AGENTS.md" -Force
    }
    Write-Host "Done! Your repository is updated. Ready for 'git add', 'git commit', and 'git push'." -ForegroundColor Green
} else {
    Write-Host "Deploying from Git Repo -> Antigravity..." -ForegroundColor Cyan

    # Deploy plugins, skills-store, and agents
    Run-Robocopy "$repo\plugins" "$cfgPlugins" @("node_modules", ".data", "logs", ".git")
    Run-Robocopy "$repo\skills"  "$cfgSkillsStore" @(".git")
    Run-Robocopy "$repo\agents"  "$cfgAgents"  @(".disabled", ".git")

    if (Test-Path "$repo\AGENTS.md") {
        Copy-Item "$repo\AGENTS.md" "$env:USERPROFILE\.gemini\config\AGENTS.md" -Force
    }

    # Ensure ~/.gemini/config/skills.json exists and registers skills-store
    $storeEntryPath = $cfgSkillsStore.Replace('\', '/')
    $configObj = @{ entries = @() }
    if (Test-Path $cfgSkillsConfig) {
        try {
            $rawJson = Get-Content -Raw -Path $cfgSkillsConfig
            $parsed = ConvertFrom-Json $rawJson
            if ($parsed -and $parsed.entries) {
                $configObj = $parsed
            }
        } catch {
            Write-Warning "Could not parse existing skills.json; creating a fresh configuration."
        }
    }

    $existingEntry = $configObj.entries | Where-Object {
        $_.path -replace '\\', '/' -eq $storeEntryPath -or
        $_.path -replace '\\', '/' -eq '~/.gemini/config/skills-store'
    }

    if (-not $existingEntry) {
        $newEntry = [PSCustomObject]@{
            path = $storeEntryPath
            exclude = @()
        }
        $configObj.entries = @($configObj.entries) + $newEntry
    }

    $configObj | ConvertTo-Json -Depth 5 | Set-Content -Path $cfgSkillsConfig -Encoding utf8
    Write-Host "Registered skills-store in $cfgSkillsConfig" -ForegroundColor Green

    # Clean up legacy ~/.gemini/config/skills to avoid unexcluded global auto-discovery duplicates
    if (Test-Path $cfgSkillsLegacy) {
        Get-ChildItem -Directory -Path $repo\skills | ForEach-Object {
            $legacySkillDir = Join-Path $cfgSkillsLegacy $_.Name
            if (Test-Path $legacySkillDir) {
                Remove-Item -Recurse -Force $legacySkillDir -ErrorAction SilentlyContinue
                Write-Host "Migrated legacy skill: $($_.Name)" -ForegroundColor Yellow
            }
        }
        if (Test-Path "$cfgSkillsLegacy\.disabled") {
            Remove-Item -Recurse -Force "$cfgSkillsLegacy\.disabled" -ErrorAction SilentlyContinue
        }
    }

    Write-Host "Done! All plugins, skills (in skills-store via skills.json), and agents are deployed to Antigravity." -ForegroundColor Green
}
