# 쿠팡 4계정 완전 자동수집 (창 띄움 → 자동로그인 → 수집 → 합산)
# 사용법: powershell -File run-coupang-auto.ps1 [-Date 2026-06-04]
param([string]$Date = "")
Set-Location $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$data = Get-Content (Join-Path $PSScriptRoot "secrets.enc.json") -Raw -Encoding utf8 | ConvertFrom-Json
function Dec($s) { (New-Object System.Management.Automation.PSCredential 'x', (ConvertTo-SecureString $s)).GetNetworkCredential().Password }

foreach ($i in 1, 2, 3, 4) {
  $port = 9221 + $i
  $prof = Join-Path $PSScriptRoot ".cdp-chrome-$i"
  Write-Output "===== 쿠팡 계정$i (포트 $port) ====="
  $alive = $false
  try { Invoke-WebRequest "http://127.0.0.1:$port/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null; $alive = $true } catch {}
  if (-not $alive) {
    Start-Process $chrome -ArgumentList @("--remote-debugging-port=$port", "--user-data-dir=`"$prof`"", "--no-first-run", "--no-default-browser-check", "https://wing.coupang.com/")
    Start-Sleep -Seconds 6
  }
  $e = $data."coupang-$i"
  $env:COUPANG_ID = Dec $e.id
  $env:COUPANG_PW = Dec $e.pw
  node autologin-coupang.js $port
  if ($LASTEXITCODE -ne 0) { Write-Output "  -> 로그인 실패, 수집 건너뜀"; continue }
  # PowerShell은 네이티브 명령에 빈 문자열 인자("")를 누락시켜 위치가 밀린다 → 날짜를 항상 계산해 전달
  $useDate = if ($Date) { $Date } else { (Get-Date).AddDays(-1).ToString('yyyy-MM-dd') }
  node scrape-coupang.js $i $useDate $port
}
Write-Output "===== 합산 ====="
node combine-coupang.js
