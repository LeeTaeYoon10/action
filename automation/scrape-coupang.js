// 쿠팡 베이스튠 일별 매출/주문 수집 (CDP로 실제 Chrome 연결 — Akamai 우회)
//
// 사전: 디버그 Chrome 실행 + 해당 계정 로그인 (cdp-coupang.ps1 또는 수동)
// 사용법: node scrape-coupang.js <계정번호> [날짜] [포트]
//   예) node scrape-coupang.js 1                 → 계정1, 어제, 포트9222
//       node scrape-coupang.js 2 2026-06-03 9223
//
// 출력: out/coupang-acc<계정번호>.json  { account, rows:[{date,sales,count}] }
//   (combine-coupang.js 가 모든 계정을 합산해 대시보드용 파일 생성)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

(async () => {
  const acc = process.argv[2] || '1';
  let date = process.argv[3];
  if (!date) { const y = new Date(); y.setDate(y.getDate() - 1); date = ymd(y); }
  const port = process.argv[4] || '9222';

  let browser;
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  catch (e) { console.error(`[오류] 포트 ${port} 연결 실패 — 디버그 Chrome이 떠 있는지 확인. (${e.message})`); process.exit(1); }
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /wing\.coupang\.com/.test(p.url())) || ctx.pages()[0];
  if (!page || !/wing\.coupang\.com/.test(page.url())) {
    // wing 탭이 없으면 이동
    const pg = page || (await ctx.newPage());
    await pg.goto('https://wing.coupang.com/tenants/business-insight/sales-analysis', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await pg.waitForTimeout(8000);
  }
  const target = ctx.pages().find((p) => /wing\.coupang\.com/.test(p.url()));
  if (!target || /xauth|login/.test(target.url())) {
    console.error(`[오류] 계정${acc} 로그인 안 됨 (포트 ${port}). 그 Chrome에서 쿠팡 로그인 필요.`);
    process.exit(1);
  }

  console.log(`[쿠팡 계정${acc}] ${date} 베이스튠 매출 수집 중... (포트 ${port})`);
  // sales-analysis 페이지를 먼저 로드해 Akamai 센서/세션을 활성화 (로그인 직후 fetch 차단 방지)
  await target.goto('https://wing.coupang.com/tenants/business-insight/sales-analysis', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await target.waitForTimeout(7000);

  const result = await target.evaluate(async (date) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '');
    async function fetchPage(pageNumber) {
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch('https://wing.coupang.com/tenants/rfm-ss/api/business-insight/vi-detail-search', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'accept': 'application/json, text/plain, */*', 'x-xsrf-token': xsrf },
            credentials: 'include',
            body: JSON.stringify({ startDate: date, endDate: date, registrationTypes: ['NORMAL', 'RFM'], pageNumber, pageSize: 20, sortBy: 'GMV', sortOrder: 'DESC', vendorItemIds: [], includeSoldVICount: true }),
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return await r.json();
        } catch (e) { lastErr = e; await sleep(2500); }
      }
      throw lastErr;
    }
    const first = await fetchPage(0);
    const totalPages = first.paginationDetails?.totalPages || 1;
    let items = [...(first.vendorItems || [])];
    for (let p = 1; p < totalPages; p++) items = items.concat((await fetchPage(p)).vendorItems || []);
    const base = items.filter((it) => /베이스튠|basetune/i.test((it.vendorItemDetails?.productName || '') + ' ' + (it.vendorItemDetails?.itemName || '')));
    let sales = 0, count = 0;
    base.forEach((it) => { const m = it.businessInsightsMetricsResponse || {}; sales += m.totalGmv || 0; count += m.totalOrders || 0; });
    return { baseCount: base.length, sales, count, names: base.map((b) => b.vendorItemDetails?.productName) };
  }, date).catch((e) => ({ error: e.message }));

  if (result.error) { console.error('[수집 오류]', result.error); process.exit(1); }

  // 저장 (계정별 파일, 날짜 병합)
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `coupang-acc${acc}.json`);
  let merged = {};
  if (fs.existsSync(outFile)) { try { (JSON.parse(fs.readFileSync(outFile, 'utf8')).rows || []).forEach((x) => { if (x && x.date) merged[x.date] = x; }); } catch (_) {} }
  merged[date] = { date, sales: result.sales, count: result.count };
  const rows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outFile, JSON.stringify({ platform: 'coupang', brand: 'basetune', account: acc, rows }, null, 2));

  console.log(`  베이스튠 상품 ${result.baseCount}개: ${result.names.join(', ')}`);
  console.log(`  매출 ₩${result.sales.toLocaleString()} / 주문 ${result.count}건`);
  console.log(`✅ 저장: ${outFile}`);
  process.exit(0);
})();
