// DailyList 표 구조 파악용. 표 헤더 + 첫 몇 행 + 날짜입력/폼 정보를 덤프.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const url = process.argv[2] || 'https://basetune9000.cafe24.com/disp/admin/shop1/report/DailyList';
  const authFile = path.join(__dirname, 'auth', 'cafe24-basetune.json');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // 모든 테이블의 헤더와 첫 3행 텍스트
  const tables = await page.$$eval('table', (tbls) => tbls.map((t, i) => {
    const headerRow = t.querySelector('thead tr') || t.querySelector('tr');
    const headers = headerRow ? [...headerRow.querySelectorAll('th,td')].map((c) => c.textContent.trim().replace(/\s+/g, ' ')) : [];
    const bodyRows = [...t.querySelectorAll('tbody tr')].slice(0, 4).map((r) => [...r.querySelectorAll('td,th')].map((c) => c.textContent.trim().replace(/\s+/g, ' ')));
    return { idx: i, rowCount: t.querySelectorAll('tbody tr').length, headers, bodyRows };
  }));

  console.log('=== 테이블 ' + tables.length + '개 ===');
  for (const t of tables) {
    if (t.headers.length === 0 && t.bodyRows.length === 0) continue;
    console.log(`\n[table#${t.idx}] tbody행수=${t.rowCount}`);
    console.log('  헤더:', JSON.stringify(t.headers));
    t.bodyRows.forEach((r, i) => console.log(`  행${i}:`, JSON.stringify(r)));
  }

  // 날짜 입력 요소
  const dateInputs = await page.$$eval('input', (els) => els
    .filter((e) => /date|day|start|end|ymd/i.test(e.name + e.id) || e.type === 'date' || /\d{4}-\d{2}-\d{2}/.test(e.value))
    .map((e) => ({ name: e.name, id: e.id, type: e.type, value: e.value })));
  console.log('\n=== 날짜 관련 input ===');
  console.log(JSON.stringify(dateInputs, null, 2));

  // 폼 action
  const forms = await page.$$eval('form', (fs) => fs.map((f) => ({ name: f.name, id: f.id, action: f.action, method: f.method })));
  console.log('\n=== form ===');
  console.log(JSON.stringify(forms, null, 2));

  await browser.close();
  process.exit(0);
})();
