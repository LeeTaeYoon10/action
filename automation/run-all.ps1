# 매일 전체 자동수집 마스터 (자동로그인 포함). 예약작업이 이걸 실행.
# 사용법: powershell -File run-all.ps1 [-Date 2026-06-04]
param([string]$Date = "")
Set-Location $PSScriptRoot
$logFile = Join-Path $PSScriptRoot "out\daily-log.txt"
if (-not (Test-Path (Join-Path $PSScriptRoot "out"))) { New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "out") | Out-Null }
function Log($m) { $line = "$(Get-Date -Format 'MM-dd HH:mm:ss') $m"; Write-Output $line; Add-Content -Path $logFile -Value $line -Encoding utf8 }
function Dec($s) { (New-Object System.Management.Automation.PSCredential 'x', (ConvertTo-SecureString $s)).GetNetworkCredential().Password }
$data = Get-Content (Join-Path $PSScriptRoot "secrets.enc.json") -Raw -Encoding utf8 | ConvertFrom-Json
$d = if ($Date) { $Date } else { "" }
Log "===== 수집 시작 ($(if($Date){$Date}else{'어제'})) ====="

$e = $data.'cafe24-basetune'; $env:CAFE24_ID = Dec $e.id; $env:CAFE24_PW = Dec $e.pw
node autologin-cafe24.js basetune | Out-Null
node scrape-cafe24.js basetune $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "카페24 OK" } else { Log "카페24 실패" }

powershell -File run-coupang-auto.ps1 -Date $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "쿠팡 OK" } else { Log "쿠팡 일부실패" }

foreach ($p in 'meta', 'tiktok', 'google') {
  node "scrape-$p.js" basetune $d | Out-Null
  if ($LASTEXITCODE -eq 0) { Log "$p OK" } else { Log "$p 실패" }
}

node scrape-gfa.js basetune $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "GFA OK" } else { Log "GFA 건너뜀(네이버 로그인 필요)" }
node scrape-smartstore.js $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "스마트스토어 OK" } else { Log "스마트스토어 건너뜀(네이버 로그인 필요)" }

# ── 대시보드 데이터 빌드 + 라이브 push (수집값을 라이브 대시보드에 자동 반영) ──
node build-dashboard-data.js | Out-Null
if ($LASTEXITCODE -eq 0) { Log "대시보드 데이터 빌드 OK" } else { Log "대시보드 빌드 실패" }
$repo = Split-Path $PSScriptRoot -Parent
git -C $repo add data/auto-basetune.json 2>$null
$changed = git -C $repo status --porcelain data/auto-basetune.json
if ($changed) {
  git -C $repo commit -m "data: 자동수집 갱신 $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
  git -C $repo push origin master | Out-Null
  if ($LASTEXITCODE -eq 0) { Log "대시보드 라이브 push OK" } else { Log "push 실패(수동 확인 필요)" }
} else {
  Log "대시보드 데이터 변경없음(push 생략)"
}

Log "===== 완료 ====="
