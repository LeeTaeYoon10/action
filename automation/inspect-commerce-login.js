// 현재 떠있는 스마트스토어(커머스ID) 로그인 페이지 구조 덤프 — 셀렉터 파악용
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9231';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = b.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];
  console.log('URL:', page.url());
  const inputs = await page.$$eval('input', (els) =>
    els.map((e) => ({ id: e.id, name: e.name, ph: e.placeholder, type: e.type, vis: e.offsetParent !== null })));
  console.log('INPUTS:', JSON.stringify(inputs));
  const btns = await page.$$eval('button, a, [role=button]', (els) =>
    [...new Set(els.map((e) => (e.innerText || e.value || '').trim()).filter((t) => t && t.length < 40))]);
  console.log('CLICKABLE:', JSON.stringify(btns));
  try { await page.screenshot({ path: 'shots/ss-login-now.png' }); console.log('스크린샷: shots/ss-login-now.png'); } catch (_) {}
})();
