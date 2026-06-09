// GFA(네이버광고) 자동 로그인 — nid.naver.com 키스트로크 입력 (포트 9232)
// 자격증명: 환경변수 GFA_ID / GFA_PW
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '9232';
  const id = process.env.GFA_ID, pw = process.env.GFA_PW;
  if (!id || !pw) { console.error('[오류] GFA_ID/GFA_PW 없음'); process.exit(1); }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];

  async function type(sel, t) {
    const el = page.locator(sel).first();
    await el.click(); await page.waitForTimeout(150);
    await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
    for (const c of t) { await page.keyboard.type(c); await page.waitForTimeout(45 + Math.floor(Math.random() * 90)); }
    await page.waitForTimeout(150);
  }

  try {
    if (!/nidlogin|nid\.naver/.test(page.url())) {
      await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    }
    if (/ads\.naver\.com/.test(page.url()) && !/needLogin|nidlogin/.test(page.url())) { console.log(`이미 로그인됨 (포트 ${port})`); process.exit(0); }

    await page.waitForSelector('#id', { timeout: 12000 });
    await type('#id', id);
    await type('#pw', pw);
    try { await page.check('#keep'); } catch (_) {} // 로그인 상태 유지
    await page.waitForTimeout(300);
    await page.locator('#log\\.login, button[type=submit], .btn_login').first().click({ timeout: 5000 }).catch(async () => { await page.keyboard.press('Enter'); });
    await page.waitForTimeout(7000);

    const url = page.url();
    const txt = await page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' ')).catch(() => '');
    await page.screenshot({ path: 'shots/gfa-login.png' }).catch(() => {});
    console.log('로그인후 URL:', url.slice(0, 80));

    if (/ads\.naver\.com/.test(url) && !/needLogin|nidlogin/.test(url)) { console.log('성공: GFA 로그인됨'); process.exit(0); }
    let reason = '추가단계 필요';
    if (/인증|otp|일회용|기기|새로운 기기|휴대폰|문자/i.test(txt)) reason = '휴대폰/기기 인증 화면';
    else if (/캡차|captcha|보안문자|자동입력 방지/i.test(txt)) reason = '캡차 발생';
    else if (/일치하지|잘못|틀린|확인해/i.test(txt)) reason = '아이디/비번 불일치';
    console.error(`[미완료] ${reason} / 화면: ${txt.slice(0, 160)}`);
    process.exit(2);
  } catch (e) { console.error('[오류]', e.message); process.exit(1); }
})();
