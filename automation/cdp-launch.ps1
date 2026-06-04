# 쿠팡 계정용 디버그 Chrome 실행기 (Akamai 우회 — 실제 Chrome + CDP)
# 사용법:  powershell -File cdp-launch.ps1 -Accounts 4
#   계정 N → 포트 (9221+N), 프로필 .cdp-chrome-N
# 각 창에서 해당 쿠팡 계정으로 직접 로그인하세요(사람이 하니 Akamai 통과).
# 로그인 세션은 프로필에 유지되어, 다음엔 바로 수집 가능합니다.

param([int]$Accounts = 4)

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { Write-Output "Chrome 없음: $chrome"; exit 1 }
$base = Join-Path $PSScriptRoot ".cdp-chrome"

for ($i = 1; $i -le $Accounts; $i++) {
  $port = 9221 + $i
  $profile = "$base-$i"
  Start-Process $chrome -ArgumentList @(
    "--remote-debugging-port=$port",
    "--user-data-dir=`"$profile`"",
    "--no-first-run", "--no-default-browser-check",
    "https://wing.coupang.com/"
  )
  Write-Output "계정$i → 포트 $port (프로필: .cdp-chrome-$i)"
  Start-Sleep -Milliseconds 800
}
Write-Output "`n각 Chrome 창에서 해당 쿠팡 계정으로 로그인하세요. (창은 닫지 마세요)"
