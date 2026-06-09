// GFA(9232) 현재 상태 확인 + 팝업 일괄 닫기 + 스크린샷
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9232';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = b.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  console.log('현재 URL:', page.url());

  const closers = ['오늘 하루 보지 않기', '오늘 그만보기', '오늘 하루', '다시 보지 않기', '닫기', '확인', '동의'];
  for (let round = 0; round < 6; round++) {
    let clicked = false;
    for (const t of closers) {
      const loc = page.locator(`button:has-text("${t}"), a:has-text("${t}"), [role=button]:has-text("${t}")`);
      const n = await loc.count();
      for (let i = 0; i < n; i++) {
        try { if (await loc.nth(i).isVisible()) { await loc.nth(i).click({ timeout: 1200 }); clicked = true; await page.waitForTimeout(400); } } catch (_) {}
      }
    }
    // X자 닫기 버튼류
    const xs = page.locator('button[class*=close], button[aria-label*=닫기], .btn_close, [class*=Close]');
    const xn = await xs.count();
    for (let i = 0; i < xn; i++) { try { if (await xs.nth(i).isVisible()) { await xs.nth(i).click({ timeout: 1000 }); clicked = true; await page.waitForTimeout(400); } } catch (_) {}
    }
    if (!clicked) break;
  }
  await page.waitForTimeout(800);
  console.log('팝업 닫기 후 URL:', page.url());
  const loggedIn = !/nid\.naver\.com|\/login/.test(page.url());
  console.log('로그인 상태:', loggedIn ? '됨(ads.naver.com 접근 가능)' : '안 됨(로그인 페이지)');
  await page.screenshot({ path: 'shots/gfa-now.png' });
  console.log('스크린샷: shots/gfa-now.png');
})();
