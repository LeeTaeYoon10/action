# 매일 전체 자동수집 마스터 (자동로그인 포함). 예약작업이 이걸 실행.
# 사용법: powershell -File run-all.ps1 [-Date 2026-06-04]
param([string]$Date = "")
Set-Location $PSScriptRoot
$logFile = Join-Path $PSScriptRoot "out\daily-log.txt"
if (-not (Test-Path (Join-Path $PSScriptRoot "out"))) { New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "out") | Out-Null }
function Log($m) { $line = "$(Get-Date -Format 'MM-dd HH:mm:ss') $m"; Write-Output $line; Add-Content -Path $logFile -Value $line -Encoding utf8 }
# 간헐 실패(세션만료·네트워크) 대비: 실패 시 최대 $tries 회 재시도
function Try-Scrape($label, [scriptblock]$cmd, $tries = 3) {
  for ($t = 1; $t -le $tries; $t++) {
    & $cmd | Out-Null
    if ($LASTEXITCODE -eq 0) {
      if ($t -gt 1) { Log "$label OK (재시도 ${t}회째 성공)" } else { Log "$label OK" }
      return
    }
    Log "$label 실패(시도 $t/$tries)"
    if ($t -lt $tries) { Start-Sleep -Seconds 8 }
  }
  Log "$label 최종실패"
}
function Dec($s) { (New-Object System.Management.Automation.PSCredential 'x', (ConvertTo-SecureString $s)).GetNetworkCredential().Password }
$data = Get-Content (Join-Path $PSScriptRoot "secrets.enc.json") -Raw -Encoding utf8 | ConvertFrom-Json
$d = if ($Date) { $Date } else { "" }
Log "===== 수집 시작 ($(if($Date){$Date}else{'어제'})) ====="

$e = $data.'cafe24-basetune'; $env:CAFE24_ID = Dec $e.id; $env:CAFE24_PW = Dec $e.pw
node autologin-cafe24.js basetune | Out-Null
Try-Scrape "카페24" { node scrape-cafe24.js basetune $d }

if ($d) { powershell -File run-coupang-auto.ps1 -Date $d | Out-Null }
else     { powershell -File run-coupang-auto.ps1 | Out-Null }
switch ($LASTEXITCODE) {
  0 { Log "쿠팡 OK" }
  2 { Log "쿠팡 일부실패(일부 계정 누락)" }
  default { Log "쿠팡 전부실패(로그인 차단 의심)" }
}

foreach ($p in 'meta', 'tiktok', 'google') {
  Try-Scrape $p { node "scrape-$p.js" basetune $d }
}

node scrape-gfa.js basetune $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "GFA OK" } else { Log "GFA 건너뜀(네이버 로그인 필요)" }
node scrape-smartstore.js $d | Out-Null
if ($LASTEXITCODE -eq 0) { Log "스마트스토어 OK" } else { Log "스마트스토어 건너뜀(네이버 로그인 필요)" }

# ── 대시보드 데이터 빌드 + 보호 Firestore 업로드 (로그인한 사용자만 열람) ──
node build-dashboard-data.js | Out-Null
if ($LASTEXITCODE -eq 0) { Log "대시보드 데이터 빌드 OK" } else { Log "대시보드 빌드 실패" }
$repo = Split-Path $PSScriptRoot -Parent
$dashFile = Join-Path $repo "data\auto-basetune.json"
# 공개 push 폐지 → 보호 Firestore(dailyData/auto-basetune)로 업로드. 무인증 열람 차단.
& python "C:\Users\ddabl\Desktop\코드 모음\ad_auto\fb_upload.py" $dashFile auto-basetune | Out-Null
if ($LASTEXITCODE -eq 0) { Log "대시보드 Firestore 업로드 OK" } else { Log "대시보드 Firestore 업로드 실패(수동 확인 필요)" }

Log "===== 완료 ====="
