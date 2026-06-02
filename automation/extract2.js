// 일별매출 표의 정확한 헤더 구조 + 날짜입력/검색버튼/검색요청 URL 파악
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const authFile = path.join(__dirname, 'auth', 'cafe24-basetune.json');
  const url = 'https://basetune9000.cafe24.com/disp/admin/shop1/report/DailyList';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();

  // 검색 시 어떤 요청이 나가는지 관찰
  const reqs = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/DailyList|report|daily|sales|stat/i.test(u) && r.resourceType() !== 'image') reqs.push(`${r.method()} ${u}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // 순매출 헤더를 가진 표의 thead 전체 행 (th: 텍스트+colspan)
  try {
    const theadInfo = await page.evaluate(() => {
      const tables = [...document.querySelectorAll('table')];
      const t = tables.find((tb) => /순매출/.test(tb.textContent) && /일자/.test(tb.textContent) && tb.querySelector('tbody tr td'));
      if (!t) return null;
      const headRows = [...t.querySelectorAll('thead tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => ({ t: c.textContent.trim().replace(/\s+/g, ' '), cs: c.colSpan, rs: c.rowSpan })));
      const firstBody = [...(t.querySelector('tbody tr')?.querySelectorAll('td,th') || [])].map((c, i) => `${i}:${c.textContent.trim().replace(/\s+/g, ' ')}`);
      const tfoot = [...(t.querySelector('tfoot')?.querySelectorAll('td,th') || [])].map((c, i) => `${i}:${c.textContent.trim().replace(/\s+/g, ' ')}`);
      return { headRows, firstBody, tfoot };
    });
    console.log('=== 일별매출 표 헤더 ===');
    console.log(JSON.stringify(theadInfo, null, 2));
  } catch (e) { console.log('헤더 추출 오류:', e.message); }

  // 날짜 입력 + 검색버튼
  try {
    const inputs = await page.$$eval('input[type=text],input[type=date],input:not([type])', (els) => els
      .map((e) => ({ name: e.name, id: e.id, cls: e.className, value: e.value, ph: e.placeholder }))
      .filter((e) => /\d{4}-\d{2}-\d{2}/.test(e.value) || /date|day|start|end|period|ymd/i.test(e.name + e.id + e.cls)));
    console.log('\n=== 날짜 input 후보 ===');
    console.log(JSON.stringify(inputs, null, 2));
  } catch (e) { console.log('input 추출 오류:', e.message); }

  try {
    const btns = await page.$$eval('button, a.btn, input[type=submit]', (els) => els
      .map((e) => ({ tag: e.tagName, text: (e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 20), id: e.id, cls: e.className }))
      .filter((e) => /검색|조회|search/i.test(e.text + e.id + e.cls)));
    console.log('\n=== 검색버튼 후보 ===');
    console.log(JSON.stringify(btns.slice(0, 10), null, 2));
  } catch (e) { console.log('btn 추출 오류:', e.message); }

  console.log('\n=== 로드 중 관련 요청들 ===');
  [...new Set(reqs)].slice(0, 20).forEach((r) => console.log(r));

  await browser.close();
  process.exit(0);
})();
