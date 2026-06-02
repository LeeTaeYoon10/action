// 사용법: node links.js <플랫폼키> <브랜드|-> <URL> <정규식>
//   예) node links.js cafe24 basetune "https://basetune9000.cafe24.com/disp/admin/shop1/main/dashboard" "통계|매출|stat"
// 페이지 안의 모든 <a> 중 텍스트/href가 정규식에 맞는 것을 출력합니다.

const { chromium } = require('playwright');
const path = require('path');
const { PLATFORMS } = require('./platforms');

(async () => {
  const [key, brandArg, url, re] = process.argv.slice(2);
  const brand = (brandArg && brandArg !== '-') ? brandArg : null;
  if (!PLATFORMS[key] || !url) { console.error('사용법: node links.js <키> <브랜드|-> <URL> <정규식>'); process.exit(1); }
  const authFile = path.join(__dirname, 'auth', brand ? `${key}-${brand}.json` : `${key}.json`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const rx = new RegExp(re || '.', 'i');
  const links = await page.$$eval('a', (els) => els.map((e) => ({ text: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), href: e.href })));
  const seen = new Set();
  for (const l of links) {
    if (!l.href) continue;
    if (!(rx.test(l.text) || rx.test(l.href))) continue;
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    console.log(`${l.text}  →  ${l.href}`);
  }
  console.log(`\n(전체 링크 ${links.length}개 중 매칭)`);
  await browser.close();
  process.exit(0);
})();
