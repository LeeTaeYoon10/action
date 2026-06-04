// 구글 광고 '어제' 일일 지출 수집 (실제 Chrome + stealth + headful 필수)
//
// 사용법: node scrape-google.js [브랜드]
//   예) node scrape-google.js basetune     → 어제 하루 (구글은 '어제' 프리셋만 지원)
//
// 출력: out/google-<브랜드>.json  { platform:'google', brand, rows:[{date,cost}] }
//   (date = 실제 어제 날짜)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./load-config');

const CFG = loadConfig().google || {};
const EMAIL = loadConfig().googleEmail || ''; // 계정선택 클릭용 (config.local.json)

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dashed(cid) { const s = String(cid); return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`; }

(async () => {
  const brand = process.argv[2] || 'basetune';
  const cid = CFG[brand];
  if (!cid) { console.error(`[오류] '${brand}' 구글 고객ID가 config.local.json의 google에 없습니다.`); process.exit(1); }
  const cidDashed = dashed(cid);

  const profileDir = path.join(__dirname, '.pw-profile', 'google');
  if (!fs.existsSync(profileDir)) { console.error('[오류] 구글 프로필 없음. 먼저: node login-profile.js google'); process.exit(1); }

  const yday = new Date(); yday.setDate(yday.getDate() - 1);
  const dateStr = ymd(yday);
  console.log(`[구글/${brand}] 어제(${dateStr}) 지출 수집 중... (실제 Chrome 창이 열립니다)`);

  const opts = { headless: false, locale: 'ko-KR', viewport: { width: 1480, height: 1000 }, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'], ignoreDefaultArgs: ['--enable-automation'] };
  let ctx; try { ctx = await chromium.launchPersistentContext(profileDir, opts); } catch { delete opts.channel; ctx = await chromium.launchPersistentContext(profileDir, opts); }
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = ctx.pages()[0] || (await ctx.newPage());
  async function clickFirst(sels) { for (const s of sels) { try { await page.locator(s).last().click({ timeout: 3500 }); return s; } catch (_) {} } return null; }

  let cost = null;
  try {
    await page.goto(`https://ads.google.com/aw/campaigns?__c=${cid}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    // 인터스티셜 통과
    for (let i = 0; i < 10; i++) {
      const u = page.url();
      if (/\/aw\//.test(u) && !/selectaccount|nav\/login/.test(u)) break;
      if (/accountchooser|signin/i.test(u)) await clickFirst([`li:has-text("${EMAIL}")`, `text=${EMAIL}`]);
      else if (/selectaccount/i.test(u)) await clickFirst([`*:has-text("${cidDashed}")`, `text=${cidDashed}`]);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(4000);
    }
    await page.waitForTimeout(3000);

    // 날짜 '어제' 설정
    await clickFirst(['material-date-range-picker', '[aria-label*="날짜"]']);
    await page.waitForTimeout(2500);
    await page.locator('material-select-item').filter({ hasText: '어제' }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await clickFirst(['material-button:has-text("적용")', 'button:has-text("적용")', '[aria-label="적용"]', 'text="적용"']);
    await page.waitForTimeout(7000); // 데이터 갱신

    // 날짜 적용 확인
    const label = await page.evaluate(() => (document.querySelector('material-date-range-picker') || {}).textContent || '');
    const applied = /어제/.test(label) || label.includes(`${new Date().getFullYear()}`);

    // 비용 카드 값 읽기
    cost = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('*')].filter((e) => /^비용$/.test((e.textContent || '').trim()) && e.children.length === 0);
      for (const lbl of labels) {
        let p = lbl;
        for (let i = 0; i < 5 && p; i++) {
          p = p.parentElement; if (!p) break;
          const m = (p.textContent || '').match(/₩\s?([\d,]+)/);
          if (m) return parseInt(m[1].replace(/,/g, ''), 10);
        }
      }
      return null;
    });
    console.log('날짜라벨:', label.replace(/\s+/g, ' ').slice(0, 50));
  } catch (e) {
    console.error('[수집 오류]', e.message);
  }
  await ctx.close().catch(() => {});

  if (cost === null) { console.error('[경고] 비용을 추출하지 못했습니다. (화면 구조/날짜적용 확인 필요)'); process.exit(1); }

  // 저장
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `google-${brand}.json`);
  let merged = {};
  if (fs.existsSync(outFile)) { try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {} }
  merged[dateStr] = { date: dateStr, cost };
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'google', brand, rows }, null, 2));

  console.log(`\n  ${dateStr}  ₩${cost.toLocaleString()}`);
  console.log(`✅ 저장: ${outFile} (총 ${rows.length}일치 누적)`);
  process.exit(0);
})();
