// 스마트스토어 자동 로그인 — 네이버 아이디 경로 + 클립보드 붙여넣기(봇감지 우회)
// 자격증명: 환경변수 SS_ID / SS_PW (네이버 계정)
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '9231';
  const id = process.env.SS_ID, pw = process.env.SS_PW;
  if (!id || !pw) { console.error('[오류] SS_ID/SS_PW 없음'); process.exit(1); }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://nid.naver.com' }); } catch (_) {}
  const page = ctx.pages().find((p) => /naver\.com/.test(p.url())) || ctx.pages()[0];

  // 커머스ID 로그인폼은 React 제어 컴포넌트 → 클립보드 붙여넣기는 onChange 미발생으로 내부값이 비어
  // "로그인"이 거부됨. 사람처럼 한 글자씩 키 입력해야 각 글자마다 input 이벤트가 발생해 상태가 갱신됨.
  async function typeHuman(sel, text) {
    const el = page.locator(sel).first();
    await el.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    for (const ch of text) {
      await page.keyboard.type(ch);
      await page.waitForTimeout(40 + Math.floor(Math.random() * 110)); // 사람같은 랜덤 간격
    }
    await page.waitForTimeout(200);
  }

  try {
    await page.goto('https://sell.smartstore.naver.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    try { await page.locator('button:has-text("로그인하기"), a:has-text("로그인하기")').first().click({ timeout: 4000 }); await page.waitForTimeout(4000); } catch (_) {}
    if (!/accounts\.commerce|nid\.naver|login/i.test(page.url())) { console.log(`✅ 이미 로그인됨 (포트 ${port})`); process.exit(0); }
    // 커머스ID 페이지의 기본 탭("이메일/판매자 아이디로 로그인")에서 판매자 아이디로 로그인
    await page.waitForTimeout(3000);

    const idSel = 'input[placeholder*="아이디"], #id';
    const pwSel = 'input[type="password"], input[placeholder*="비밀번호"], #pw';
    await page.waitForSelector(idSel, { timeout: 15000 });
    await typeHuman(idSel, id);
    await typeHuman(pwSel, pw);
    await page.waitForTimeout(400);
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      page.locator('button:has-text("로그인"), #log\\.login, .btn_login').first().click({ timeout: 6000 }).catch(async () => { await page.keyboard.press('Enter'); }),
    ]);
    await page.waitForTimeout(7000);
    try { const dev = page.locator('a:has-text("등록안함"), button:has-text("등록안함")').first(); if (await dev.count()) { await dev.click({ timeout: 3000 }); await page.waitForTimeout(4000); } } catch (_) {}

    const url = page.url();
    const txt = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : '').catch(() => '');
    if (/smartstore\.naver\.com/.test(url) && !/accounts\.commerce|nid\.naver|login/i.test(url)) {
      console.log(`✅ 스마트스토어(네이버) 자동로그인 성공 (포트 ${port})`); process.exit(0);
    }
    let reason = '로그인 실패';
    if (/캡차|captcha|보안문자|자동입력 방지/i.test(txt)) reason = '캡차 발생';
    else if (/다시 로그인/i.test(txt)) reason = '네이버 봇감지 거부(다시 로그인)';
    else if (/일치하지|잘못|틀린/i.test(txt)) reason = '아이디/비번 오류';
    console.error(`[실패] ${reason} / URL: ${url.slice(0, 60)}\n화면: ${txt.replace(/\s+/g, ' ').slice(0, 140)}`);
    process.exit(2);
  } catch (e) { console.error('[오류]', e.message); process.exit(1); }
})();
