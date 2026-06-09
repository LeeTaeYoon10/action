// "알림 다시 보내기" 클릭 후 2FA 승인 대기
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9231');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  console.log('현재 URL:', page.url().slice(0, 80));

  // "알림 다시 보내기" 클릭 (resendBtn)
  try {
    await page.click('#resendBtn', { timeout: 5000 });
    console.log('알림 재발송 클릭');
  } catch(e) { console.log('재발송 버튼 오류:', e.message); }

  await page.waitForTimeout(2000);
  console.log('2FA 승인 대기 중... (최대 120초)');
  const start = Date.now();
  while (Date.now() - start < 120000) {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!/nidlogin/.test(url)) {
      console.log('리디렉션 감지:', url.slice(0, 100));
      break;
    }
  }
  console.log('최종 URL:', page.url().slice(0, 100));
  const pages = ctx.pages();
  for (let i = 0; i < pages.length; i++) {
    console.log('탭', i, ':', pages[i].url().slice(0, 80));
  }
  await browser.close();
})();
