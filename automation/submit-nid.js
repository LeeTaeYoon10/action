// nid 로그인 폼 제출 테스트 (이미 채워진 상태 가정) — 결과/캡차 확인
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const port = process.argv[2] || '9231';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = b.contexts()[0].pages().find((p) => /nid\.naver\.com/.test(p.url())) || b.contexts()[0].pages()[0];
  try { const keep = page.locator('.keep_check, label:has-text("로그인 상태 유지"), #keep').first(); if (await keep.count()) await keep.click({ timeout: 2000 }); } catch (_) {}
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    page.locator('.btn_login, #log\\.login, button:has-text("로그인")').first().click({ timeout: 6000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(7000);
  const url = page.url();
  const txt = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 500) : '').catch(() => '');
  const c = await page.context().newCDPSession(page);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'shots', 'nid-result.png'), Buffer.from(data, 'base64'));
  console.log('URL:', url);
  console.log('화면:', txt.replace(/\s+/g, ' ').slice(0, 200));
  process.exit(0);
})();
