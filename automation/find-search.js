// 검색 버튼 찾고, 특정 날짜로 설정 후 검색 시 나가는 요청/결과 확인
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const authFile = path.join(__dirname, 'auth', 'cafe24-basetune.json');
  const url = 'https://basetune9000.cafe24.com/disp/admin/shop1/report/DailyList';
  const target = process.argv[2] || '2026-05-20'; // 테스트 날짜

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();

  const reqs = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/DailyList/i.test(u)) reqs.push(`${r.method()} ${u}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // '검색' 텍스트를 가진 클릭가능 요소 모두 나열
  const candidates = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a,button,span,input')];
    return els.filter((e) => /검색/.test((e.textContent || e.value || '').trim()))
      .map((e) => ({ tag: e.tagName, text: (e.textContent || e.value || '').trim().slice(0, 15), id: e.id, cls: (e.className || '').toString().slice(0, 40) }))
      .slice(0, 12);
  });
  console.log('=== "검색" 요소 후보 ===');
  console.log(JSON.stringify(candidates, null, 2));

  // 날짜 입력 채우기 시도 (duet-date 내부 input)
  try {
    await page.fill('#pr_start_date', target);
    await page.fill('#pr_end_date', target);
    await page.waitForTimeout(500);
    console.log(`\n날짜 입력 완료: ${target} ~ ${target}`);
    console.log('start값=', await page.inputValue('#pr_start_date'));
    console.log('end값=', await page.inputValue('#pr_end_date'));
  } catch (e) { console.log('날짜 입력 오류:', e.message); }

  // 검색 클릭 시도
  reqs.length = 0;
  try {
    await page.click('#search_button', { timeout: 5000 });
    await page.waitForTimeout(4500);
  } catch (e) { console.log('검색 클릭 오류:', e.message); }

  console.log('\n=== 검색 후 DailyList 요청 ===');
  [...new Set(reqs)].forEach((r) => console.log(r));

  // 검색 후 표 첫 행
  const firstRow = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')];
    const t = tables.find((tb) => /순매출/.test(tb.textContent) && /일자/.test(tb.textContent) && tb.querySelector('tbody tr td'));
    if (!t) return null;
    return [...(t.querySelector('tbody tr')?.querySelectorAll('td,th') || [])].map((c, i) => `${i}:${c.textContent.trim().replace(/\s+/g, ' ')}`);
  });
  console.log('\n=== 검색 후 표 첫 행 ===');
  console.log(JSON.stringify(firstRow));

  await browser.close();
  process.exit(0);
})();
