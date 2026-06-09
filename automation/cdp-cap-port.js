// CDP 포트의 현재 화면 캡처. 사용법: node cdp-cap-port.js <포트> <출력이름>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const port = process.argv[2] || '9231';
  const out = process.argv[3] || 'cap';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const pages = b.contexts()[0].pages();
  const p = pages.find((x) => /naver|coupang|cafe24/.test(x.url())) || pages[0];
  const c = await p.context().newCDPSession(p);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  const dir = path.join(__dirname, 'shots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, out + '.png'), Buffer.from(data, 'base64'));
  console.log('saved', out + '.png', '|', p.url());
  process.exit(0);
})();
