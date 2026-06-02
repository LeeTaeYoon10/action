// 사용법: node click.js <플랫폼키> <브랜드|-> <URL> <클릭할텍스트>
// 페이지 로드 후 해당 텍스트를 가진 메뉴를 클릭하고, 새 탭/이동 URL을 출력합니다.

const { chromium } = require('playwright');
const path = require('path');
const { PLATFORMS } = require('./platforms');

(async () => {
  const [key, brandArg, url, clickText] = process.argv.slice(2);
  const brand = (brandArg && brandArg !== '-') ? brandArg : null;
  const authFile = path.join(__dirname, 'auth', brand ? `${key}-${brand}.json` : `${key}.json`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();

  context.on('page', async (p) => {
    await p.waitForLoadState('domcontentloaded').catch(() => {});
    console.log('🆕 새 탭 열림:', p.url());
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const before = page.url();
  // 정확히 그 텍스트를 가진 링크/버튼 클릭
  const target = page.locator(`a:has-text("${clickText}"), button:has-text("${clickText}")`).first();
  try {
    await target.click({ timeout: 8000 });
  } catch (e) {
    console.log('클릭 실패:', e.message);
  }
  await page.waitForTimeout(5000);
  console.log('이동 전 URL:', before);
  console.log('이동 후 URL:', page.url());

  await browser.close();
  process.exit(0);
})();
