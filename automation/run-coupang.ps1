# 쿠팡 4개 계정 일괄 수집 + 합산
# 사전: 디버그 Chrome 4개(포트 9222~9225)가 떠 있고 각 계정 로그인된 상태여야 함
#   (cdp-launch.ps1 로 띄우고 로그인 → 창 닫지 말 것! 쿠팡은 세션쿠키라 닫으면 로그아웃됨)
# 사용법: powershell -File run-coupang.ps1 [-Date 2026-06-03]
param([string]$Date = "")

Set-Location $PSScriptRoot
foreach ($i in 1, 2, 3, 4) {
  $port = 9221 + $i
  Write-Output "===== 계정$i (포트 $port) ====="
  if ($Date) { node scrape-coupang.js $i $Date $port } else { node scrape-coupang.js $i "" $port }
}
Write-Output "===== 합산 ====="
node combine-coupang.js
Write-Output "`n→ 대시보드에서 out/coupang-basetune.json 을 '자동수집 불러오기' 하세요."
