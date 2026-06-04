// 사용법: node login.js <플랫폼키> [브랜드]
//   예) node login.js cafe24            → auth/cafe24.json
//       node login.js cafe24 basetune   → auth/cafe24-basetune.json
//       node login.js cafe24 granny      → auth/cafe24-granny.json
//
// 동작 (자동 저장 방식):
//   1) 브라우저 창이 열립니다.
//   2) 직접 로그인하세요 (아이디/비번/2차인증/캡차 전부 수동으로).
//   3) 로그인 성공이 감지되면 자동으로 세션이 저장됩니다 — Enter 누를 필요 없음.
//      (감지가 안 되면, 그냥 브라우저 창을 닫아도 그 시점 세션이 저장됩니다.)
//   4) auth/<플랫폼키>.json 으로 저장 → scrape 스크립트들이 재사용.
//
// 환경변수 LOGIN_TIMEOUT(초)로 최대 대기시간 조절 (기본 480초 = 8분).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platforms');

// 로그인 페이지에서 흔히 보이는 URL 조각들 (이게 있으면 아직 로그인 전)
const LOGIN_MARKERS = ['login', 'signin', 'nid.naver.com', 'eclogin', 'accounts.google.com', 'auth'];

function looksLoggedIn(url, platform) {
  // host+pathname 만 비교 (쿼리스트링의 인코딩된 returnUrl 등에 오탐하지 않도록)
  let hp;
  try { const u = new URL(url); hp = (u.host + u.pathname).toLowerCase(); }
  catch { hp = (url || '').toLowerCase(); }
  if (platform.successUrlIncludes && platform.successUrlIncludes.some((s) => hp.includes(s.toLowerCase()))) {
    return true;
  }
  return false;
}

(async () => {
  const key = process.argv[2];
  const brand = process.argv[3]; // 선택: basetune / granny 등
  const platform = PLATFORMS[key];

  if (!platform) {
    console.error('\n[오류] 플랫폼 키를 지정하세요.');
    console.error('사용법: node login.js <플랫폼키> [브랜드]');
    console.error('사용 가능한 키: ' + Object.keys(PLATFORMS).join(', ') + '\n');
    process.exit(1);
  }

  const authDir = path.join(__dirname, 'auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const fileName = brand ? `${key}-${brand}.json` : `${key}.json`;
  const authFile = path.join(authDir, fileName);

  const timeoutMs = (parseInt(process.env.LOGIN_TIMEOUT, 10) || 480) * 1000;

  console.log(`\n=== ${platform.label}${brand ? ' / ' + brand : ''} 로그인 ===`);
  console.log(`브라우저를 엽니다: ${platform.loginUrl}`);
  console.log('브라우저에서 로그인하세요. 로그인 성공이 감지되면 자동 저장됩니다.');
  console.log('(감지가 안 되면 브라우저 창을 닫으세요 — 그 시점 세션이 저장됩니다.)\n');

  // 봇 차단(Akamai 등) 사이트는 실제 Chrome + 사람처럼 보이는 지문으로 우회
  const useChrome = process.env.USE_CHROME === '1' || ['coupang', 'smartstore', 'gfa'].includes(key);
  const launchOpts = {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized', '--disable-infobars'],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  if (useChrome) launchOpts.channel = 'chrome';
  let browser;
  try { browser = await chromium.launch(launchOpts); }
  catch (e) { if (useChrome) { console.log('(실제 Chrome 실행 실패, 기본 브라우저로:', e.message + ')'); delete launchOpts.channel; browser = await chromium.launch(launchOpts); } else throw e; }

  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: useChrome ? null : { width: 1380, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
  });
  // 자동화 흔적(navigator.webdriver) 숨기기
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = window.chrome || { runtime: {} };
  });
  const page = await context.newPage();
  await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  let saved = false;
  async function save(reason) {
    if (saved) return;
    saved = true;
    try {
      await context.storageState({ path: authFile });
      console.log(`\n✅ 세션 저장 완료 (${reason}): ${authFile}`);
      console.log('   (.gitignore로 보호되어 GitHub에 올라가지 않습니다)\n');
    } catch (e) {
      console.error('세션 저장 실패:', e.message);
    }
  }

  let closedByUser = false;
  browser.on('disconnected', () => { closedByUser = true; });

  // 로그인 감지 + 주기적 저장(안전망)
  // 브라우저가 열려있는 동안 3초마다 현재 쿠키를 파일에 저장 → 닫아도 직전 상태가 남음.
  // 로그인 페이지의 쿠키를 저장해도 무방(로그인 후 덮어써짐). 감지되면 즉시 종료.
  const start = Date.now();
  let periodicSaved = false;
  while (!saved && !closedByUser && Date.now() - start < timeoutMs) {
    let url = '';
    try { url = page.url(); } catch (_) { break; }
    // 주기 저장
    try { await context.storageState({ path: authFile }); periodicSaved = true; } catch (_) {}
    if (looksLoggedIn(url, platform)) {
      console.log(`\n🔓 로그인 감지됨: ${url}`);
      await page.waitForTimeout(2500); // 쿠키 안정화
      await save('자동 감지');
      break;
    }
    await page.waitForTimeout(3000).catch(() => {});
  }

  if (!saved) {
    if (closedByUser && periodicSaved) {
      console.log('\n💾 창이 닫혔습니다 — 직전에 주기 저장된 세션을 사용합니다:', authFile);
      saved = true;
    } else if (!closedByUser) {
      console.log('\n⏱  시간 초과 — 현재 시점 세션을 저장합니다.');
      await save('시간 초과');
    }
  }

  if (saved && !closedByUser) {
    await browser.close().catch(() => {});
  }
  process.exit(saved ? 0 : 1);
})();
