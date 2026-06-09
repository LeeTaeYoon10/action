// 네이버(nid) 로그인 폼 구조 파악 (CDP 포트 인자)
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9231';
  const startUrl = process.argv[3] || 'https://sell.smartstore.naver.com/';
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  try { await page.locator('button:has-text("로그인하기"), a:has-text("로그인하기")').first().click({ timeout: 5000 }); await page.waitForTimeout(5000); } catch (_) {}
  const info = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].filter((e) => ['text', 'password', 'email', ''].includes(e.type) || /id|pass|pw|user|login/i.test(e.name + e.id)).map((e) => ({ name: e.name, id: e.id, type: e.type, ph: e.placeholder }));
    const btns = [...document.querySelectorAll('button,input[type=submit],a.btn')].filter((e) => /로그인|login|submit/i.test((e.textContent || e.value || '') + e.id + e.className + e.type)).map((e) => ({ tag: e.tagName, type: e.type, text: (e.textContent || e.value || '').trim().slice(0, 15), id: e.id, cls: (e.className || '').toString().slice(0, 25) })).slice(0, 6);
    const captcha = /캡차|captcha|보안문자|자동입력 방지/i.test(document.body ? document.body.innerText : '');
    return { url: location.href, title: document.title, inputs, btns, captcha };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})();
