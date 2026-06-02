// 병합 보존 검증: 06-01에 메타 광고비를 먼저 입력(수동 시뮬)한 뒤 카페24 import →
// 메타 광고비가 보존되고 ROAS가 계산되는지 확인.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dashboard = 'file:///' + path.join('C:', 'Users', 'ddabl', 'Desktop', 'vs코드 연습용', 'dashboard', 'index.html').replace(/\\/g, '/');
  const json = fs.readFileSync(path.join(__dirname, 'out', 'cafe24-basetune.json'), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage();
  await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const out = await page.evaluate(async (jsonStr) => {
    localStorage.removeItem('ad_dashboard_history');
    // 1) 사용자가 06-01 베이스튠 메타 광고비 10,000,000 입력하는 상황 시뮬
    document.getElementById('date-input').value = '2026-06-01';
    onDateChange();
    document.querySelector('input[data-brand="basetune"][data-platform="meta"][data-key="cost"]').value = '10000000';
    doAutoSave();
    // 2) 카페24 import 실행
    const file = new File([jsonStr], 'cafe24-basetune.json', { type: 'application/json' });
    await window.importCollectedFiles([file]);
    // 3) 06-01 레코드 확인
    const arr = JSON.parse(localStorage.getItem('ad_dashboard_history') || '[]');
    const rec = arr.find((r) => r.date === '2026-06-01' && r.brand === 'basetune');
    return {
      meta_cost: rec?.snapshot?.meta_cost,
      cafe24_sales: rec?.snapshot?.cafe24_sales,
      cafe24_count: rec?.snapshot?.cafe24_count,
      totalSales: rec?.totalSales, totalCost: rec?.totalCost, roas: rec?.roas, cpa: rec?.cpa,
    };
  }, json);

  console.log('=== 병합 후 06-01 베이스튠 ===');
  console.log(JSON.stringify(out, null, 2));
  console.log('\n기대값: meta_cost=10000000 보존, cafe24_sales=39500556, totalSales=34627156, totalCost=10000000, roas≈346');

  await browser.close();
  process.exit(0);
})();
