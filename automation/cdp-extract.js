// 상품명 전환 → 베이스튠 검색 → 컬럼헤더 + 베이스튠 행들의 숫자 덤프
const { chromium } = require('playwright');

(async () => {
  const term = process.argv[2] || '베이스튠';
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /wing\.coupang\.com/.test(p.url())) || ctx.pages()[0];
  await page.goto('https://wing.coupang.com/tenants/business-insight/sales-analysis', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find((e) => /옵션목록|상품목록/.test((e.textContent || '').trim()) && (e.textContent || '').length < 30); if (el) el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(1500);

  // 토글 → 상품명
  try {
    await page.locator('[class*="_selected_"]').filter({ hasText: '옵션' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.locator('li', { hasText: '상품명' }).first().click({ timeout: 5000 });
    console.log('상품명 전환 완료');
  } catch (e) { console.log('토글 오류:', e.message); }
  await page.waitForTimeout(2500);

  // 검색
  try {
    const s = page.locator('input[placeholder="검색"]').first();
    await s.click({ timeout: 5000 }); await s.fill(term); await page.keyboard.press('Enter');
    console.log('검색:', term);
  } catch (e) { console.log('검색 오류:', e.message); }
  await page.waitForTimeout(5000);

  // 컬럼 헤더 + 행 덤프
  const data = await page.evaluate(() => {
    const txt = (e) => (e.textContent || '').trim().replace(/\s+/g, ' ');
    // 헤더 후보: 매출/주문/판매량 등이 들어간 헤더 행
    const headerCandidates = [...document.querySelectorAll('*')].filter((e) => /매출/.test(txt(e)) && /주문|판매량|순/.test(txt(e)) && txt(e).length < 120).map(txt);
    // 베이스튠 행: 행 컨테이너 추정 (상품명 + 숫자들)
    const rowEls = [...document.querySelectorAll('div,li,tr')].filter((e) => /베이스튠|basetune/i.test(txt(e)) && /[\d,]{2,}/.test(txt(e)) && txt(e).length > 30 && txt(e).length < 400);
    // 가장 안쪽(짧은) 행만
    rowEls.sort((a, b) => txt(a).length - txt(b).length);
    const rows = rowEls.slice(0, 8).map((e) => {
      const nums = (txt(e).match(/[\d,]+%?원?/g) || []).filter((n) => /\d/.test(n));
      return { text: txt(e).slice(0, 120), nums };
    });
    return { headers: [...new Set(headerCandidates)].slice(0, 3), rowCount: rowEls.length, rows };
  });
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
})();
