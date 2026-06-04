// GFA(네이버 성과형/ads.naver.com) 일별 광고비 수집 (CDP — 포트 9232)
//
// 사전: 디버그 Chrome(포트 9232)에 네이버광고(ads.naver.com) 로그인된 상태 (닫지 말것)
// 사용법: node scrape-gfa.js [브랜드] [날짜] [포트]
//   예) node scrape-gfa.js basetune              → 어제
//       node scrape-gfa.js basetune 2026-06-03
//
// 출력: out/gfa-<브랜드>.json  { platform:'gfa', brand, rows:[{date,cost}] }

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./load-config');

const ACCOUNTS = loadConfig().gfa || {};
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

(async () => {
  const brand = process.argv[2] || 'basetune';
  const adAccountNo = ACCOUNTS[brand];
  if (!adAccountNo) { console.error(`[오류] '${brand}' GFA 계정번호가 config.local.json의 gfa에 없습니다.`); process.exit(1); }
  let date = process.argv[3];
  if (!date) { const y = new Date(); y.setDate(y.getDate() - 1); date = ymd(y); }
  const port = process.argv[4] || '9232';

  let browser;
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  catch (e) { console.error(`[오류] 포트 ${port} 연결 실패 — GFA 디버그 Chrome 확인. (${e.message})`); process.exit(1); }
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /ads\.naver\.com/.test(p.url())) || ctx.pages()[0];
  if (!page) { console.error('[오류] ads.naver.com 탭 없음'); process.exit(1); }

  // 라이브 /apis/ 요청에서 authorization 헤더 가로채기 (있으면 사용)
  let auth = null;
  page.on('request', (req) => { if (/ads\.naver\.com\/apis\//.test(req.url())) { const a = req.headers()['authorization']; if (a) auth = a; } });

  console.log(`[GFA/${brand}] ${date} 광고비 수집 중... (계정 ${adAccountNo}, 포트 ${port})`);
  const reportUrl = `https://ads.naver.com/manage/ad-accounts/${adAccountNo}/da/report/sales?dateRange=${date}%2C${date}&dateUnit=TOTAL&placeUnit=TOTAL&period=custom`;
  await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (/nid\.naver\.com|login/.test(page.url())) { console.error('[오류] 로그인 안 됨. 그 Chrome에서 네이버광고 로그인 필요.'); process.exit(1); }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let i = 0; i < 12 && !auth; i++) await page.waitForTimeout(700);

  const result = await page.evaluate(async ({ adAccountNo, date, auth }) => {
    const headers = { accept: 'application/json' };
    if (auth) headers.authorization = auth;
    const r = await fetch(`https://ads.naver.com/apis/stats/v1/adAccounts/${adAccountNo}/stats/reportSales?startDate=${date}&endDate=${date}`, { headers, credentials: 'include' });
    if (!r.ok) return { error: r.status };
    const j = await r.json();
    const list = j.reportSalesDetailResponseList || [];
    const cost = list.reduce((a, x) => a + (x.sales || 0), 0);
    return { cost, accountName: list[0]?.adAccountName, rows: list.length };
  }, { adAccountNo, date, auth }).catch((e) => ({ error: e.message }));

  if (result.error) { console.error('[수집 오류]', result.error); process.exit(1); }

  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `gfa-${brand}.json`);
  let merged = {};
  if (fs.existsSync(outFile)) { try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {} }
  merged[date] = { date, cost: result.cost };
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'gfa', brand, rows }, null, 2));

  console.log(`  계정: ${result.accountName} / 광고비 ₩${result.cost.toLocaleString()}`);
  console.log(`✅ 저장: ${outFile}`);
  process.exit(0);
})();
