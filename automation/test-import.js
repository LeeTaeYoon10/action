// 대시보드 import 기능 검증: 대시보드를 file://로 띄우고, 수집 JSON을 File로 만들어
// importCollectedFiles()를 실제로 호출한 뒤 localStorage 결과를 확인한다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dashboard = 'file:///' + path.join('C:', 'Users', 'ddabl', 'Desktop', 'vs코드 연습용', 'dashboard', 'index.html').replace(/\\/g, '/');
  const dataFile = path.join(__dirname, 'out', 'cafe24-basetune.json');
  const json = fs.readFileSync(dataFile, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

  await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 깨끗한 상태에서 시작
  await page.evaluate(() => localStorage.removeItem('ad_dashboard_history'));

  // 수집 JSON을 File로 만들어 실제 import 경로 실행
  const importResult = await page.evaluate(async (jsonStr) => {
    const file = new File([jsonStr], 'cafe24-basetune.json', { type: 'application/json' });
    await window.importCollectedFiles([file]);
    const arr = JSON.parse(localStorage.getItem('ad_dashboard_history') || '[]');
    return arr.filter((r) => r.brand === 'basetune').map((r) => ({
      date: r.date, brand: r.brand,
      cafe24_sales: r.snapshot?.cafe24_sales, cafe24_count: r.snapshot?.cafe24_count, cafe24_refund: r.snapshot?.cafe24_refund,
      totalSales: r.totalSales, totalCount: r.totalCount, roas: r.roas,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, json);

  console.log('=== import 후 basetune 히스토리 레코드 ===');
  console.log(JSON.stringify(importResult, null, 2));
  console.log('\n레코드 수:', importResult.length);
  if (errs.length) { console.log('\n[페이지 오류]'); errs.forEach((e) => console.log(' ', e)); }

  await browser.close();
  process.exit(0);
})();
