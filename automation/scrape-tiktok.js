// 틱톡 일별 광고 지출 수집 (headful 필수 — 틱톡은 headless 차단)
//
// 사용법: node scrape-tiktok.js [브랜드] [시작일] [종료일]
//   예) node scrape-tiktok.js basetune                    → 어제
//       node scrape-tiktok.js basetune 2026-05-30 2026-06-02
//
// 방식: 캠페인 화면(st/et 날짜)을 열고, /statistics/op/campaign/list 응답을 가로채
//       캠페인별 row_data.stat_cost 를 합산 = 그날 총지출.
// 출력: out/tiktok-<브랜드>.json  { platform:'tiktok', brand, rows:[{date,cost}] }

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./load-config');

const ACCOUNTS = loadConfig().tiktok || {};

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function eachDate(s, e) { const o = []; let c = new Date(s + 'T00:00:00'); const l = new Date(e + 'T00:00:00'); while (c <= l) { o.push(ymd(c)); c.setDate(c.getDate() + 1); } return o; }

function sumSpend(json) {
  const table = json?.data?.table;
  if (!Array.isArray(table)) return null;
  let sum = 0;
  table.forEach((c) => { sum += parseFloat(c?.row_data?.stat_cost ?? 0) || 0; });
  const pg = json?.data?.pagination;
  const overflow = pg && pg.total_count > table.length; // 캠페인이 1페이지를 초과
  return { sum: Math.round(sum), overflow, count: table.length, total: pg?.total_count };
}

(async () => {
  const brand = process.argv[2] || 'basetune';
  const aadvid = ACCOUNTS[brand];
  if (!aadvid) { console.error(`[오류] '${brand}' 틱톡 aadvid가 config.local.json의 tiktok에 없습니다.`); process.exit(1); }

  let start = process.argv[3];
  let end = process.argv[4] || start;
  if (!start) { const y = new Date(); y.setDate(y.getDate() - 1); start = end = ymd(y); }

  const profileDir = path.join(__dirname, '.pw-profile', 'tiktok');
  if (!fs.existsSync(profileDir)) { console.error('[오류] 틱톡 프로필 없음. 먼저: node login-profile.js tiktok'); process.exit(1); }

  const dates = eachDate(start, end);
  console.log(`[틱톡/${brand}] ${start} ~ ${end} (${dates.length}일) 지출 수집 중... (창이 잠깐 열립니다)`);

  const ctx = await chromium.launchPersistentContext(profileDir, { headless: false, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = ctx.pages()[0] || (await ctx.newPage());

  let latest = null;   // 현재 날짜의 파싱 결과
  let curDate = null;  // 현재 수집 중인 날짜
  page.on('response', async (res) => {
    try {
      if (!/\/statistics\/op\/campaign\/list/.test(res.url())) return;
      // 요청 본문의 st/et 가 타겟 날짜와 일치하고, '삭제' 필터가 아닌 응답만 채택
      const pd = res.request().postData();
      if (!pd) return;
      const body = JSON.parse(pd);
      const cr = body.common_req || body;
      if (cr.st !== curDate || cr.et !== curDate) return;
      if (/"delete"/.test(JSON.stringify(cr.filters || []))) return;
      const json = JSON.parse(await res.text());
      const r = sumSpend(json);
      if (r) latest = r;
    } catch (_) {}
  });

  const result = [];
  try {
    for (const date of dates) {
      // 이전 날짜의 인플라이트/늦은 응답을 끊기 위해 완전 초기화
      await page.goto('about:blank').catch(() => {});
      await page.waitForTimeout(600);
      latest = null;
      curDate = date;
      const url = `https://ads.tiktok.com/i18n/manage/campaign?aadvid=${aadvid}&st=${date}&et=${date}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (/login|passport/i.test(page.url())) throw new Error('세션 만료 — node login-profile.js tiktok 재실행 필요');
      // 날짜가 일치하는 응답이 올 때까지 대기 (최대 22초)
      const t0 = Date.now();
      while (latest === null && Date.now() - t0 < 22000) await page.waitForTimeout(700);
      const cost = latest ? latest.sum : 0;
      result.push({ date, cost, ok: latest !== null, overflow: latest?.overflow });
      console.log(`  ${date}  ₩${cost.toLocaleString()}${latest === null ? '  ⚠️(응답없음)' : ''}${latest?.overflow ? '  ⚠️(캠페인>20, 페이지초과)' : ''}`);
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
  const outFile = path.join(outDir, `tiktok-${brand}.json`);
  let merged = {};
  if (fs.existsSync(outFile)) { try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {} }
  result.forEach((x) => { merged[x.date] = { date: x.date, cost: x.cost }; });
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'tiktok', brand, rows }, null, 2));

  const fails = result.filter((r) => !r.ok).length;
  console.log(`\n✅ 저장: ${outFile} (총 ${rows.length}일치 누적)${fails ? ` / ⚠️ 응답없음 ${fails}일` : ''}`);
  process.exit(0);
})();
