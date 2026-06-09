// 떠있는 크롬(9231)에서 "네이버 아이디로 로그인"을 눌러 nid 로그인 페이지로 이동만 시킴 (자동입력 X)
const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2] || '9231';
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = b.contexts()[0];
  const page = ctx.pages().find((p) => /naver/.test(p.url())) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  try { await page.locator('button:has-text("로그인하기"), a:has-text("로그인하기")').first().click({ timeout: 3000 }); await page.waitForTimeout(2500); } catch (_) {}
  try { await page.locator('button:has-text("네이버 아이디로 로그인"), a:has-text("네이버 아이디로 로그인")').first().click({ timeout: 6000 }); } catch (e) { console.log('  버튼 클릭 실패:', e.message); }
  await page.waitForTimeout(3500);
  console.log('현재 URL:', page.url());
  console.log(/nid\.naver\.com/.test(page.url()) ? '→ 네이버 로그인 화면입니다. 직접 로그인하세요.' : '→ 아직 이동 안 됨. 창에서 직접 "네이버 아이디로 로그인"을 눌러주세요.');
})();
