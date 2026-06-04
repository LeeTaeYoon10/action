// 프로필 방식 세션으로 URL 열고 스크린샷. 사용법: node inspect-profile.js <플랫폼> <브랜드|-> <URL> [이름]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const key = process.argv[2];
  const brandArg = process.argv[3];
  const url = process.argv[4];
  const outName = process.argv[5] || 'shot';
  const brand = (brandArg && brandArg !== '-') ? brandArg : null;
  const profileDir = path.join(__dirname, '.pw-profile', brand ? `${key}-${brand}` : key);

  const shotsDir = path.join(__dirname, 'shots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.error('이동 경고:', e.message));
  await page.waitForTimeout(4000);

  console.log('제목 :', await page.title().catch(() => ''));
  console.log('최종URL:', page.url());
  const shot = path.join(shotsDir, `${outName}.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
  console.log('스크린샷:', shot);

  await ctx.close();
  process.exit(0);
})();
