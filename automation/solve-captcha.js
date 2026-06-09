// 네이버 로그인 캡차 답 입력 후 로그인 (포트 9232) — 답은 인자로
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9232';
  const ans = process.argv[3] || '7';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = b.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];

  const capSel = 'input[placeholder*="정답"]';
  await page.waitForSelector(capSel, { timeout: 8000 }).catch(() => {});
  const el = page.locator(capSel).first();
  await el.click(); await page.waitForTimeout(150);
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  for (const c of ans) { await page.keyboard.type(c); await page.waitForTimeout(70); }
  await page.waitForTimeout(300);
  console.log('입력한 답:', ans);

  await page.locator('#log\\.login, button:has-text("로그인")').first().click({ timeout: 5000 }).catch(async () => { await page.keyboard.press('Enter'); });
  await page.waitForTimeout(7000);
  const url = page.url();
  console.log('로그인후 URL:', url.slice(0, 80));
  await page.screenshot({ path: 'shots/gfa-after-captcha.png' }).catch(() => {});
  const txt = await page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' ')).catch(() => '');
  const ok = /ads\.naver\.com/.test(url) && !/nidlogin|needLogin/.test(url);
  if (ok) { console.log('성공: GFA 로그인됨'); process.exit(0); }
  console.log('미완료 / 화면:', txt.slice(0, 160));
  process.exit(2);
})();
