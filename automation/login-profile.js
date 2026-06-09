// 전용 크롬 프로필 방식 로그인 (storageState보다 안정적 — 메타/구글 등 권장)
//
// 사용법: node login-profile.js <플랫폼키> [브랜드]
//   예) node login-profile.js meta
//
// 동작: 전용 프로필 폴더(.pw-profile/<플랫폼>[-브랜드])로 브라우저를 엽니다.
//   로그인하고 → 브라우저 창을 닫으면 끝. 로그인 상태가 프로필에 영구 저장됩니다.
//   같은 프로필을 scrape 스크립트가 재사용합니다.

const { chromium } = require('playwright');
const path = require('path');
const { PLATFORMS } = require('./platforms');

(async () => {
  const key = process.argv[2];
  const brand = process.argv[3];
  const platform = PLATFORMS[key];
  if (!platform) {
    console.error('사용법: node login-profile.js <플랫폼키> [브랜드]');
    console.error('사용 가능: ' + Object.keys(PLATFORMS).join(', '));
    process.exit(1);
  }

  const profileDir = path.join(__dirname, '.pw-profile', brand ? `${key}-${brand}` : key);
  const timeoutMs = (parseInt(process.env.LOGIN_TIMEOUT, 10) || 900) * 1000;

  console.log(`\n=== ${platform.label}${brand ? ' / ' + brand : ''} 로그인 (프로필 방식) ===`);
  console.log(`프로필: ${profileDir}`);
  console.log(`브라우저를 엽니다: ${platform.loginUrl}`);
  console.log('로그인을 끝까지 마친 뒤 → 브라우저 창을 그냥 닫으세요. (자동 저장)\n');

  // 구글 등은 자동화 브라우저를 차단 → 실제 Chrome + 자동화 흔적 숨김(stealth)
  const useChrome = process.env.USE_CHROME === '1' || ['google', 'gfa'].includes(key);
  const launchOpts = {
    headless: false,
    locale: 'ko-KR',
    viewport: null,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  if (useChrome) launchOpts.channel = 'chrome';

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, launchOpts);
  } catch (e) {
    if (useChrome) { // Chrome 미설치 등 → 기본 브라우저로 폴백
      console.log('(실제 Chrome 실행 실패, 기본 브라우저로 시도:', e.message + ')');
      delete launchOpts.channel;
      ctx = await chromium.launchPersistentContext(profileDir, launchOpts);
    } else { throw e; }
  }

  // navigator.webdriver 숨기기
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let closed = false;
  ctx.on('close', () => { closed = true; });

  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  // 사용자가 창을 닫을 때까지 대기 (프로필은 세션 중 디스크에 계속 저장됨)
  const start = Date.now();
  while (!closed && Date.now() - start < timeoutMs) {
    if (ctx.pages().length === 0) break; // 모든 탭이 닫힘
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n✅ 로그인 세션이 프로필에 저장되었습니다:', profileDir);
  await ctx.close().catch(() => {});
  process.exit(0);
})();
