# 쿠팡(4)+스마트스토어+GFA용 디버그 Chrome 일괄 실행 (세션복원 ON → 창 닫아도 로그인 유지 시도)
# 사용법: powershell -File cdp-launch-all.ps1
# 각 창에서 처음 한 번 로그인(가능하면 '로그인 상태 유지' 체크). 이후엔 닫아도 유지 시도됨.

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$root = $PSScriptRoot

# (포트, 프로필명, 시작URL)
$targets = @(
  @(9222, ".cdp-chrome-1", "https://wing.coupang.com/"),
  @(9223, ".cdp-chrome-2", "https://wing.coupang.com/"),
  @(9224, ".cdp-chrome-3", "https://wing.coupang.com/"),
  @(9225, ".cdp-chrome-4", "https://wing.coupang.com/"),
  @(9231, ".cdp-ss-1",     "https://sell.smartstore.naver.com/"),
  @(9232, ".cdp-gfa-1",    "https://ads.naver.com/")
)

foreach ($t in $targets) {
  $port = $t[0]; $prof = Join-Path $root $t[1]; $url = $t[2]
  try { Invoke-WebRequest "http://127.0.0.1:$port/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null; Write-Output "포트 $port 이미 실행중 -> 건너뜀"; continue } catch {}

  # 세션복원 설정 주입 (프로필 없을 때만 - 기존 로그인 보존)
  $defDir = Join-Path $prof "Default"
  $prefFile = Join-Path $defDir "Preferences"
  if (-not (Test-Path $prefFile)) {
    New-Item -ItemType Directory -Force -Path $defDir | Out-Null
    '{"profile":{"exit_type":"Normal","exited_cleanly":true},"session":{"restore_on_startup":1}}' | Out-File -FilePath $prefFile -Encoding utf8 -NoNewline
  }
  Start-Process $chrome -ArgumentList @("--remote-debugging-port=$port", "--user-data-dir=`"$prof`"", "--restore-last-session", "--no-first-run", "--no-default-browser-check", $url)
  Write-Output "실행: 포트 $port ($($t[1]))"
  Start-Sleep -Milliseconds 900
}
Write-Output "`n각 창에서 로그인하세요(가능하면 '로그인 상태 유지' 체크)."
Write-Output "수집: run-coupang.ps1 / node scrape-smartstore.js / node scrape-gfa.js basetune"
