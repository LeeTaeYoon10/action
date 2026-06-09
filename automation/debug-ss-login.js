// 스마트스토어 커머스ID 로그인 정밀 디버그 v2: 로그인폼 띄움→키스트로크→입력반영→버튼클릭 결과
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9231';
  const id = process.env.SS_ID, pw = process.env.SS_PW;
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = b.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];
  await page.goto('https://sell.smartstore.naver.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  try { await page.locator('button:has-text("로그인하기"), a:has-text("로그인하기")').first().click({ timeout: 4000 }); await page.waitForTimeout(3500); } catch (_) { console.log('   (로그인하기 버튼 스킵)'); }
  console.log('1) URL:', page.url());

  const idSel = 'input[placeholder*="아이디"]';
  const pwSel = 'input[type="password"]';
  try { await page.waitForSelector(idSel, { timeout: 12000 }); }
  catch (_) { console.log('   폼 못찾음. URL=', page.url()); await page.screenshot({ path: 'shots/ss-debug.png' }); process.exit(1); }

  async function type(sel, t) {
    const el = page.locator(sel).first();
    await el.click(); await page.waitForTimeout(150);
    await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
    for (const c of t) { await page.keyboard.type(c); await page.waitForTimeout(70); }
  }
  await type(idSel, id);
  await type(pwSel, pw);
  console.log('2) idVal=', JSON.stringify(await page.locator(idSel).first().inputValue()), ' pwLen=', (await page.locator(pwSel).first().inputValue()).length);

  for (const c of ['button[type=submit]', 'button:has-text("로그인")', '.btn_login']) {
    console.log('   btn', c, 'count=', await page.locator(c).count());
  }
  let btn = page.locator('button[type=submit]').first();
  if (!(await btn.count())) btn = page.locator('button:has-text("로그인")').last();
  console.log('3) enabled=', await btn.isEnabled().catch(() => '?'));
  await btn.click({ timeout: 5000 }).catch((e) => console.log('   클릭오류:', e.message));
  await page.waitForTimeout(6000);
  console.log('4) 클릭후 URL:', page.url());
  const txt = await page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' '));
  const m = txt.match(/.{0,30}(틀렸|일치하지|다시 로그인|보안문자|캡차|자동입력|입력해|오류|등록).{0,30}/);
  console.log('5) 단서:', m ? m[0] : '(특이 메시지 없음)');
  await page.screenshot({ path: 'shots/ss-debug.png' });
  console.log('6) shots/ss-debug.png 저장');
})();
