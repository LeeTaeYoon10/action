// 사용법: node open.js <플랫폼키> [URL]
//   예) node open.js cafe24
//       node open.js cafe24 https://xxx.cafe24.com/admin/php/shop1/s/...
//
// 저장된 세션(auth/<플랫폼키>.json)으로 브라우저를 엽니다.
// - 로그인 화면 없이 바로 들어가지면 → 세션 유효 ✅
// - 로그인 화면이 뜨면 → 세션 만료, login.js 다시 실행 필요 ⚠️
//
// URL을 생략하면 platforms.js의 기본 주소로 엽니다.
// 창은 직접 닫을 때까지 열려 있습니다 (화면 구조 확인용).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platforms');

(async () => {
  const key = process.argv[2];
  const brand = process.argv[3]; // 선택: basetune / granny 등
  const url = process.argv[4];
  const platform = PLATFORMS[key];

  if (!platform) {
    console.error('사용법: node open.js <플랫폼키> [브랜드] [URL]');
    console.error('사용 가능한 키: ' + Object.keys(PLATFORMS).join(', '));
    process.exit(1);
  }

  const fileName = brand ? `${key}-${brand}.json` : `${key}.json`;
  const authFile = path.join(__dirname, 'auth', fileName);
  if (!fs.existsSync(authFile)) {
    console.error(`\n[오류] 세션 파일이 없습니다: ${authFile}`);
    console.error(`먼저 로그인하세요:  node login.js ${key}${brand ? ' ' + brand : ''}\n`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: authFile,
    locale: 'ko-KR',
    viewport: { width: 1380, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(url || platform.loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  console.log(`\n${platform.label} — 저장된 세션으로 열었습니다.`);
  console.log('로그인 화면 없이 들어가졌다면 세션 유효 ✅');
  console.log('확인 후 브라우저 창을 직접 닫으세요.\n');

  // 사용자가 창을 닫을 때까지 대기
  await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
  await browser.close().catch(() => {});
  process.exit(0);
})();
