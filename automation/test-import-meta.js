// 카페24(매출) + 메타(광고비) 동시 import → ROAS 계산 검증
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dashboard = 'file:///' + path.join('C:', 'Users', 'ddabl', 'Desktop', 'vs코드 연습용', 'dashboard', 'index.html').replace(/\\/g, '/');
  const cafe = fs.readFileSync(path.join(__dirname, 'out', 'cafe24-basetune.json'), 'utf8');
  const meta = fs.readFileSync(path.join(__dirname, 'out', 'meta-basetune.json'), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage();
  await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const out = await page.evaluate(async ([c, m]) => {
    localStorage.removeItem('ad_dashboard_history');
    const f1 = new File([c], 'cafe24-basetune.json', { type: 'application/json' });
    const f2 = new File([m], 'meta-basetune.json', { type: 'application/json' });
    await window.importCollectedFiles([f1, f2]);
    const arr = JSON.parse(localStorage.getItem('ad_dashboard_history') || '[]');
    const r = arr.find((x) => x.date === '2026-06-01' && x.brand === 'basetune');
    return r ? { date: r.date, cafe24_sales: r.snapshot?.cafe24_sales, meta_cost: r.snapshot?.meta_cost, totalSales: r.totalSales, totalCost: r.totalCost, roas: r.roas, cpa: r.cpa } : null;
  }, [cafe, meta]);

  console.log('=== 2026-06-01 베이스튠 (카페24+메타) ===');
  console.log(JSON.stringify(out, null, 2));
  console.log('\n검산: 순매출 34,627,156 / 광고비 10,945,328 → ROAS =', Math.round(34627156 / 10945328 * 100) + '%');

  await browser.close();
  process.exit(0);
})();
