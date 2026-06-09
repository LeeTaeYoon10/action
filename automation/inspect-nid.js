// nid.naver.com 로그인 폼 input/버튼 선택자 덤프 (포트 9231)
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9231';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = b.contexts()[0].pages().find((p) => /nid\.naver\.com/.test(p.url())) || b.contexts()[0].pages()[0];
  const info = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].map((e) => ({ name: e.name, id: e.id, type: e.type, ph: e.placeholder, val: (e.value || '').slice(0, 12) }));
    const btns = [...document.querySelectorAll('button,input[type=submit],a')].filter((e) => /로그인|login|submit/i.test((e.textContent || e.value || '') + e.id + e.type)).map((e) => ({ tag: e.tagName, type: e.type, text: (e.textContent || e.value || '').trim().slice(0, 12), id: e.id, cls: (e.className || '').toString().slice(0, 25) })).slice(0, 6);
    return { url: location.href, inputs, btns };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})();
