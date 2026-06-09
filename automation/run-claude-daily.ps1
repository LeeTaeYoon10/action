# Daily unattended Claude check entrypoint. Task Scheduler runs this file.
# Decrypts credentials into env vars, then hands daily-claude-task.md to Claude (-p).
# ASCII-only on purpose: PowerShell 5.1 reads BOM-less files as the system codepage,
# which corrupts hardcoded Korean. Paths come from $PSScriptRoot, messages are English.
$ErrorActionPreference = 'Continue'
$a = $PSScriptRoot
Set-Location $a
$outDir = Join-Path $a 'out'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$log = Join-Path $outDir ("claude-run-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Dec($s) { (New-Object System.Management.Automation.PSCredential 'x', (ConvertTo-SecureString $s)).GetNetworkCredential().Password }
try {
  $data = Get-Content (Join-Path $a 'secrets.enc.json') -Raw -Encoding utf8 | ConvertFrom-Json
  $env:GFA_ID = Dec $data.gfa.id;        $env:GFA_PW = Dec $data.gfa.pw
  $env:SS_ID  = Dec $data.smartstore.id; $env:SS_PW  = Dec $data.smartstore.pw
} catch {
  "[$(Get-Date)] credential decrypt failed (check DPAPI user): $($_.Exception.Message)" | Out-File $log -Encoding utf8
  exit 1
}

$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) { $claude = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\claude.exe' }

$prompt = Get-Content (Join-Path $a 'daily-claude-task.md') -Raw -Encoding utf8

"[$(Get-Date)] Claude check start" | Out-File $log -Encoding utf8
# Empty stdin avoids the 'no stdin' wait. bypassPermissions: unattended cannot prompt.
'' | & $claude -p $prompt --permission-mode bypassPermissions --add-dir $a --model sonnet *>&1 |
  Out-File -FilePath $log -Append -Encoding utf8
"[$(Get-Date)] Claude check end (exit=$LASTEXITCODE)" | Out-File $log -Append -Encoding utf8
