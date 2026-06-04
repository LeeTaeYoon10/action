// 스마트스토어 베이스튠 일별 매출/건수/환불 수집 (CDP — 포트 9231)
//
// 사전: 디버그 Chrome(포트 9231)에 스마트스토어센터 로그인된 상태 (cdp-launch 류로 띄움, 닫지 말것)
// 사용법: node scrape-smartstore.js [날짜] [포트]
//   예) node scrape-smartstore.js              → 어제
//       node scrape-smartstore.js 2026-06-03
//
// 출력: out/smartstore-basetune.json  { platform:'smartstore', brand:'basetune', rows:[{date,sales,count,refund}] }

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

(async () => {
  let date = process.argv[2];
  if (!date) { const y = new Date(); y.setDate(y.getDate() - 1); date = ymd(y); }
  const port = process.argv[3] || '9231';

  let browser;
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  catch (e) { console.error(`[오류] 포트 ${port} 연결 실패 — 스마트스토어 디버그 Chrome 확인. (${e.message})`); process.exit(1); }
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /smartstore\.naver\.com/.test(p.url())) || ctx.pages()[0];
  if (!page) { console.error('[오류] 스마트스토어 탭 없음'); process.exit(1); }

  // 라이브 report 요청에서 Bearer 토큰 + siteId 가로채기
  let auth = null, siteId = null;
  page.on('request', (req) => {
    const m = req.url().match(/\/biz_iframe\/api\/v3\/sites\/(s_[a-z0-9]+)\/report/i);
    if (m) { siteId = m[1]; const a = req.headers()['authorization']; if (a) auth = a; }
  });

  console.log(`[스마트스토어] ${date} 베이스튠 매출 수집 중... (포트 ${port})`);
  await page.goto('https://sell.smartstore.naver.com/#/bizadvisor/sales/product', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (/nid\.naver\.com|login/.test(page.url())) { console.error('[오류] 로그인 안 됨. 그 Chrome에서 스마트스토어 로그인 필요.'); process.exit(1); }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let i = 0; i < 22 && !auth; i++) await page.waitForTimeout(800);
  if (!auth || !siteId) { console.error('[오류] 인증 토큰을 못 잡았습니다 (페이지 로딩/로그인 확인).'); process.exit(1); }

  const result = await page.evaluate(async ({ date, siteId, auth }) => {
    const metrics = ['pay_amount', 'num_purchase', 'refund_pay_amount'];
    const qs = `useIndex=sales-product-unit&startDate=${date}&endDate=${date}&dimensions=product_name&` + metrics.map((m) => 'metrics=' + m).join('&') + '&service=biz_advisor';
    const r = await fetch(`https://sell.smartstore.naver.com/biz_iframe/api/v3/sites/${siteId}/report?${qs}`, { headers: { accept: 'application/json', authorization: auth }, credentials: 'include' });
    if (!r.ok) return { error: r.status };
    const arr = await r.json();
    const base = arr.filter((x) => /베이스튠|basetune/i.test(x.product_name || ''));
    let sales = 0, count = 0, refund = 0;
    base.forEach((x) => { sales += x.pay_amount || 0; count += x.num_purchase || 0; refund += x.refund_pay_amount || 0; });
    return { baseCount: base.length, names: base.map((b) => b.product_name), sales, count, refund };
  }, { date, siteId, auth }).catch((e) => ({ error: e.message }));

  if (result.error) { console.error('[수집 오류] HTTP/JS', result.error); process.exit(1); }

  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'smartstore-basetune.json');
  let merged = {};
  if (fs.existsSync(outFile)) { try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {} }
  merged[date] = { date, sales: result.sales, count: result.count, refund: result.refund };
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'smartstore', brand: 'basetune', rows }, null, 2));

  console.log(`  베이스튠 상품 ${result.baseCount}개: ${result.names.join(', ')}`);
  console.log(`  매출 ₩${result.sales.toLocaleString()} / 건수 ${result.count} / 환불 ₩${result.refund.toLocaleString()}`);
  console.log(`✅ 저장: ${outFile}`);
  process.exit(0);
})();
