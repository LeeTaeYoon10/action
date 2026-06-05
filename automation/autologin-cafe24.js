// 카페24 자동 로그인 → storageState 저장 (세션 만료시 자동 재로그인용)
// 자격증명은 환경변수 CAFE24_ID / CAFE24_PW 로 받음 (creds.ps1이 DPAPI 복호화해서 주입)
// 사용법: node autologin-cafe24.js [브랜드]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const brand = process.argv[2] || 'basetune';
  const id = process.env.CAFE24_ID;
  const pw = process.env.CAFE24_PW;
  if (!id || !pw) { console.error('[오류] CAFE24_ID/CAFE24_PW 환경변수 없음 (creds.ps1로 주입 필요)'); process.exit(1); }

  const authDir = path.join(__dirname, 'auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const authFile = path.join(authDir, `cafe24-${brand}.json`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1380, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('https://eclogin.cafe24.com/Shop/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('input[name="loginId"]', id);
    await page.fill('input[name="loginPasswd"]', pw);
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      page.click('button:has-text("로그인")'),
    ]);
    await page.waitForTimeout(5000);

    const url = page.url();
    const bodyTxt = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : '');
    const loggedIn = /\/admin/.test(url) || /admin/.test(url);
    if (!loggedIn) {
      // 실패 원인 추정
      let reason = '로그인 실패';
      if (/비밀번호|아이디|일치하지|확인/.test(bodyTxt)) reason = '아이디/비번 오류 또는 추가확인 필요';
      if (/캡차|captcha|보안문자|자동입력/i.test(bodyTxt)) reason = '캡차(보안문자) 발생';
      if (/인증|2단계|otp/i.test(bodyTxt)) reason = '2차 인증 필요';
      console.error(`[자동로그인 실패] ${reason}\n현재URL: ${url}\n화면: ${bodyTxt.replace(/\s+/g, ' ').slice(0, 150)}`);
      await browser.close();
      process.exit(2);
    }
    await context.storageState({ path: authFile });
    console.log(`✅ 카페24 자동로그인 성공 → ${authFile}`);
    console.log(`   로그인 후 URL: ${url}`);
  } catch (e) {
    console.error('[자동로그인 오류]', e.message);
    await browser.close().catch(() => {});
    process.exit(1);
  }
  await browser.close().catch(() => {});
  process.exit(0);
})();
