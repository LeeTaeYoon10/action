// 쿠팡 자동 로그인 (CDP 실제 Chrome에 연결해서 폼 자동입력)
// 자격증명: 환경변수 COUPANG_ID / COUPANG_PW (creds.ps1이 DPAPI 복호화 주입)
// 사용법: node autologin-coupang.js <포트>
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '9222';
  const id = process.env.COUPANG_ID, pw = process.env.COUPANG_PW;
  if (!id || !pw) { console.error('[오류] COUPANG_ID/COUPANG_PW 환경변수 없음'); process.exit(1); }

  let browser;
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  catch (e) { console.error(`[오류] 포트 ${port} 연결 실패: ${e.message}`); process.exit(1); }
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /coupang\.com/.test(p.url())) || ctx.pages()[0];

  try {
    await page.goto('https://wing.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    // 로그인 페이지(xauth/login)가 아니면 이미 로그인된 것
    if (!/xauth|\/login|\/sso\//i.test(page.url())) { console.log(`✅ 이미 로그인됨 (포트 ${port})`); process.exit(0); }

    await page.waitForSelector('#username', { timeout: 15000 });
    await page.fill('#username', id);
    await page.fill('#password', pw);
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.click('#kc-login')]);
    await page.waitForTimeout(6000);

    const url = page.url();
    const txt = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : '').catch(() => '');
    if (/wing\.coupang\.com/.test(url) && !/xauth|login/.test(url)) {
      console.log(`✅ 쿠팡 자동로그인 성공 (포트 ${port})`);
      process.exit(0);
    }
    let reason = '로그인 실패';
    if (/Access Denied|don't have permission/i.test(txt)) reason = 'Akamai 차단(Access Denied)';
    else if (/캡차|captcha|보안문자|로봇|automated/i.test(txt)) reason = '캡차 발생';
    else if (/일치하지|올바른|확인|incorrect|invalid/i.test(txt)) reason = '아이디/비번 오류';
    else if (/인증|2단계|otp/i.test(txt)) reason = '2차 인증';
    console.error(`[실패] ${reason} / URL: ${url.slice(0, 70)}\n화면: ${txt.replace(/\s+/g, ' ').slice(0, 150)}`);
    process.exit(2);
  } catch (e) { console.error('[오류]', e.message); process.exit(1); }
})();
