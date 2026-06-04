// 메타(페이스북·인스타) 일별 광고 지출 수집
//
// 사용법:
//   node scrape-meta.js [브랜드] [시작일] [종료일]
//   예) node scrape-meta.js basetune                    → 어제
//       node scrape-meta.js basetune 2026-06-01          → 그 날
//       node scrape-meta.js basetune 2026-05-26 2026-06-01  → 기간(하루씩 조회)
//
// 출력: out/meta-<브랜드>.json  { platform:'meta', brand, rows:[{date,cost}] }

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./load-config');

// 브랜드별 메타 광고계정 ID — config.local.json (gitignore)에서 로드
const ACCOUNTS = loadConfig().meta || {};

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function eachDate(start, end) {
  const out = [];
  let cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) { out.push(ymd(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

async function extractSpend(page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll('div,span,td')];
    const cand = all.filter((e) => /총\s*지출/.test(e.textContent) && /₩[\d,]{1,}/.test(e.textContent) && e.textContent.length < 50);
    cand.sort((a, b) => a.textContent.length - b.textContent.length);
    const m = (cand[0]?.textContent || '').match(/₩\s*([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  });
}

(async () => {
  const brand = process.argv[2] || 'basetune';
  const act = ACCOUNTS[brand];
  if (!act) { console.error(`[오류] '${brand}' 메타 계정ID가 config.local.json의 meta에 없습니다. (config.sample.json 참고)`); process.exit(1); }

  let start = process.argv[3];
  let end = process.argv[4] || start;
  if (!start) { const y = new Date(); y.setDate(y.getDate() - 1); start = end = ymd(y); }

  const profileDir = path.join(__dirname, '.pw-profile', 'meta');
  if (!fs.existsSync(profileDir)) { console.error(`[오류] 메타 프로필 없음. 먼저: node login-profile.js meta`); process.exit(1); }

  const dates = eachDate(start, end);
  console.log(`[메타/${brand}] ${start} ~ ${end} (${dates.length}일) 지출 수집 중...`);

  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = ctx.pages()[0] || (await ctx.newPage());

  const result = [];
  try {
    for (const date of dates) {
      const url = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&date=${date}_${date}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (/login/i.test(page.url())) throw new Error('세션 만료 — node login-profile.js meta 재실행 필요');
      await page.waitForTimeout(8000);
      let cost = await extractSpend(page);
      if (cost === null) { // 한 번 더 대기 후 재시도
        await page.waitForTimeout(4000);
        cost = await extractSpend(page);
      }
      result.push({ date, cost: cost === null ? 0 : cost, ok: cost !== null });
      console.log(`  ${date}  ₩${(cost || 0).toLocaleString()}${cost === null ? '  ⚠️(추출실패)' : ''}`);
    }
  } catch (e) {
    console.error('[수집 오류]', e.message);
    await ctx.close().catch(() => {});
    process.exit(1);
  }
  await ctx.close().catch(() => {});

  // 저장 (병합)
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `meta-${brand}.json`);
  let merged = {};
  if (fs.existsSync(outFile)) {
    try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {}
  }
  result.forEach((x) => { merged[x.date] = { date: x.date, cost: x.cost }; });
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'meta', brand, rows }, null, 2));

  const fails = result.filter((r) => !r.ok).length;
  console.log(`\n✅ 저장: ${outFile} (총 ${rows.length}일치 누적)${fails ? ` / ⚠️ 추출실패 ${fails}일` : ''}`);
  process.exit(0);
})();
