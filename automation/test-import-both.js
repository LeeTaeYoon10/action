// 두 브랜드(basetune, granny) 파일을 동시에 import → 두 브랜드 레코드 정상 생성 확인
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dashboard = 'file:///' + path.join('C:', 'Users', 'ddabl', 'Desktop', 'vs코드 연습용', 'dashboard', 'index.html').replace(/\\/g, '/');
  const jsonBase = fs.readFileSync(path.join(__dirname, 'out', 'cafe24-basetune.json'), 'utf8');
  const jsonGran = fs.readFileSync(path.join(__dirname, 'out', 'cafe24-granny.json'), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage();
  await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const summary = await page.evaluate(async ([b, g]) => {
    localStorage.removeItem('ad_dashboard_history');
    const f1 = new File([b], 'cafe24-basetune.json', { type: 'application/json' });
    const f2 = new File([g], 'cafe24-granny.json', { type: 'application/json' });
    await window.importCollectedFiles([f1, f2]);
    const arr = JSON.parse(localStorage.getItem('ad_dashboard_history') || '[]');
    const byBrand = {};
    arr.forEach((r) => { byBrand[r.brand] = (byBrand[r.brand] || 0) + 1; });
    const sample06 = arr.filter((r) => r.date === '2026-06-01').map((r) => ({ brand: r.brand, totalSales: r.totalSales, totalCount: r.totalCount }));
    return { byBrand, total: arr.length, sample06 };
  }, [jsonBase, jsonGran]);

  console.log('=== 브랜드별 레코드 수 ===');
  console.log(JSON.stringify(summary.byBrand, null, 2));
  console.log('전체 레코드:', summary.total);
  console.log('\n=== 2026-06-01 두 브랜드 ===');
  console.log(JSON.stringify(summary.sample06, null, 2));

  await browser.close();
  process.exit(0);
})();
