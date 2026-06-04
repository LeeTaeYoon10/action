// 사용법: node inspect.js <플랫폼키> <브랜드|-> <URL> [출력이름]
//   예) node inspect.js cafe24 basetune https://basetune9000.cafe24.com/admin/ admin-home
//
// 저장된 세션으로 URL을 열고, 전체 화면 스크린샷을 shots/<출력이름>.png 로 저장합니다.
// 페이지 제목/최종 URL도 출력합니다. (화면 구조 파악용)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platforms');

(async () => {
  const key = process.argv[2];
  const brandArg = process.argv[3];
  const url = process.argv[4];
  const outName = process.argv[5] || 'shot';
  const waitMs = parseInt(process.argv[6], 10) || 2500;
  const headful = process.argv[7] === 'headful';
  const brand = (brandArg && brandArg !== '-') ? brandArg : null;
  const platform = PLATFORMS[key];

  if (!platform || !url) {
    console.error('사용법: node inspect.js <플랫폼키> <브랜드|-> <URL> [출력이름]');
    process.exit(1);
  }

  const fileName = brand ? `${key}-${brand}.json` : `${key}.json`;
  const authFile = path.join(__dirname, 'auth', fileName);
  if (!fs.existsSync(authFile)) {
    console.error(`[오류] 세션 파일 없음: ${authFile}`);
    process.exit(1);
  }

  const shotsDir = path.join(__dirname, 'shots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headful });
  const context = await browser.newContext({
    storageState: authFile,
    locale: 'ko-KR',
    viewport: { width: 1480, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.error('이동 중 경고:', e.message);
  });
  await page.waitForTimeout(waitMs);

  const shotPath = path.join(shotsDir, `${outName}.png`);
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});

  console.log('제목 :', await page.title().catch(() => ''));
  console.log('최종URL:', page.url());
  console.log('스크린샷:', shotPath);

  await browser.close();
  process.exit(0);
})();
