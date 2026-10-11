<#
.SYNOPSIS
    Syncs plugins and skills between this repository and Antigravity's global config directory.

.EXAMPLE
    .\sync.ps1
    Deploys all plugins and skills from this repo into Antigravity.

.EXAMPLE
    .\sync.ps1 -FromAntigravity
    Pulls edits made inside Antigravity back into this repo so you can git commit & push.
#>

param(
    [switch]$FromAntigravity
)

$repo = $PSScriptRoot
$cfgPlugins = "$env:USERPROFILE\.gemini\config\plugins"
$cfgSkills  = "$env:USERPROFILE\.gemini\config\skills"

# Ensure target directories exist
New-Item -ItemType Directory -Path "$repo\plugins", "$repo\skills" -Force | Out-Null
New-Item -ItemType Directory -Path $cfgPlugins, $cfgSkills -Force | Out-Null

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
    Run-Robocopy "$cfgPlugins" "$repo\plugins" @("node_modules", ".data", "logs")
    Run-Robocopy "$cfgSkills"  "$repo\skills"  @(".disabled")
    Write-Host "Done! Your repository is updated. Ready for 'git add', 'git commit', and 'git push'." -ForegroundColor Green
} else {
    Write-Host "Deploying from Git Repo -> Antigravity..." -ForegroundColor Cyan
    Run-Robocopy "$repo\plugins" "$cfgPlugins" @("node_modules", ".data", "logs")
    Run-Robocopy "$repo\skills"  "$cfgSkills"  @(".disabled")
    Write-Host "Done! All plugins and skills are deployed to Antigravity." -ForegroundColor Green
}
