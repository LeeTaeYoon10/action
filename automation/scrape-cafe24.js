// 카페24 일별 매출(순매출, 주문수) 수집
//
// 사용법:
//   node scrape-cafe24.js [브랜드] [시작일] [종료일]
//   예) node scrape-cafe24.js basetune                  → 어제 하루
//       node scrape-cafe24.js basetune 2026-05-20        → 그 날 하루
//       node scrape-cafe24.js basetune 2026-05-18 2026-05-28  → 기간(여러 날)
//
// 출력: out/cafe24-<브랜드>.json  (날짜별 { date, orders, netSales })
//       + 콘솔에 표로 출력

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 브랜드별 카페24 몰 도메인 — config.local.json (gitignore)에서 로드
const { loadConfig } = require('./load-config');
const MALLS = loadConfig().cafe24 || {};

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toNum(s) { return parseInt(String(s).replace(/[^\d-]/g, ''), 10) || 0; }

(async () => {
  const brand = process.argv[2] || 'basetune';
  const mall = MALLS[brand];
  if (!mall) {
    console.error(`[오류] '${brand}' 몰 도메인이 config.local.json의 cafe24에 없습니다. (config.sample.json 참고)`);
    process.exit(1);
  }

  // 날짜 결정: 인자 없으면 어제
  let start = process.argv[3];
  let end = process.argv[4] || start;
  if (!start) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    start = end = ymd(y);
  }

  const authFile = path.join(__dirname, 'auth', `cafe24-${brand}.json`);
  if (!fs.existsSync(authFile)) {
    console.error(`[오류] 세션 없음: ${authFile}\n먼저 로그인: node login.js cafe24 ${brand}`);
    process.exit(1);
  }

  const url = `https://${mall}/disp/admin/shop1/report/DailyList`;
  console.log(`[카페24/${brand}] ${start} ~ ${end} 수집 중...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authFile, locale: 'ko-KR', viewport: { width: 1480, height: 1000 } });
  const page = await context.newPage();

  // 기간을 10일 단위 청크로 분할 (리포트가 한 화면에 ~10행만 보여주므로)
  function chunkRanges(s, e) {
    const out = [];
    let cur = new Date(s + 'T00:00:00');
    const last = new Date(e + 'T00:00:00');
    while (cur <= last) {
      const cs = new Date(cur);
      const ce = new Date(cur);
      ce.setDate(ce.getDate() + 9);
      if (ce > last) ce.setTime(last.getTime());
      out.push([ymd(cs), ymd(ce)]);
      cur.setDate(cur.getDate() + 10);
    }
    return out;
  }

  let rows = [];
  try {
    const chunks = chunkRanges(start, end);
    let first = true;
    for (const [cs, ce] of chunks) {
      // 청크마다 페이지를 새로 로드해 상태를 초기화 (안 그러면 이전 검색 결과가 남음)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(first ? 4000 : 2500);
      first = false;

      // 로그인 만료 체크
      if (/login/i.test(page.url())) {
        throw new Error(`세션 만료됨 — 재로그인 필요: node login.js cafe24 ${brand}`);
      }

      // 날짜 범위 설정 후 검색
      await page.fill('#pr_start_date', cs);
      await page.fill('#pr_end_date', ce);
      await page.click('#search_button', { timeout: 8000 });
      await page.waitForTimeout(4000);

      // 일별매출 표 파싱 (끝에서부터: 순매출=last, 환불합계=last-1, 결제합계=last-2)
      //   col0=일자, col1=주문수
      const chunkRows = await page.evaluate(() => {
        const tables = [...document.querySelectorAll('table')];
        const t = tables.find((tb) => /순매출/.test(tb.textContent) && /일자/.test(tb.textContent) && tb.querySelector('tbody tr td'));
        if (!t) return [];
        return [...t.querySelectorAll('tbody tr')].map((tr) => {
          const cells = [...tr.querySelectorAll('td,th')].map((c) => c.textContent.trim().replace(/\s+/g, ' '));
          if (cells.length < 4) return null;
          const n = cells.length;
          return { dateRaw: cells[0], ordersRaw: cells[1], payRaw: cells[n - 3], refundRaw: cells[n - 2], netRaw: cells[n - 1] };
        }).filter(Boolean);
      });
      rows.push(...chunkRows);
    }
  } catch (e) {
    console.error('[수집 오류]', e.message);
    await browser.close().catch(() => {});
    process.exit(1);
  }
  await browser.close().catch(() => {});

  // 정리: "2026-05-20(수)" → "2026-05-20", 날짜 기준 중복 제거
  //   대시보드 매핑: sales=결제합계, refund=환불합계, count=주문수 → (sales-refund)=순매출
  const byDate = {};
  rows.forEach((r) => {
    const m = r.dateRaw.match(/(\d{4}-\d{2}-\d{2})/);
    if (!m) return; // 합계행 등 제외
    byDate[m[1]] = { date: m[1], count: toNum(r.ordersRaw), sales: toNum(r.payRaw), refund: toNum(r.refundRaw), netSales: toNum(r.netRaw) };
  });
  const result = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  if (result.length === 0) {
    console.error('[경고] 추출된 데이터가 없습니다. (날짜/화면 구조 확인 필요)');
    process.exit(1);
  }

  // 저장: 대시보드 import 형식 { platform, brand, rows:[{date,sales,refund,count}] }
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `cafe24-${brand}.json`);
  // 기존 데이터와 병합 (날짜 기준 덮어쓰기)
  let merged = {};
  if (fs.existsSync(outFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      (prev.rows || prev || []).forEach((x) => { if (x && x.date) merged[x.date] = x; });
    } catch (_) {}
  }
  result.forEach((x) => { merged[x.date] = { date: x.date, sales: x.sales, refund: x.refund, count: x.count }; });
  const mergedRows = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  const outObj = { platform: 'cafe24', brand, rows: mergedRows };
  fs.writeFileSync(outFile, JSON.stringify(outObj, null, 2));

  // 콘솔 출력
  console.log('\n날짜          주문수    결제합계        환불합계       순매출');
  console.log('─'.repeat(64));
  result.forEach((r) => {
    console.log(`${r.date}   ${String(r.count).padStart(5)}   ${r.sales.toLocaleString().padStart(12)}   ${r.refund.toLocaleString().padStart(11)}   ${r.netSales.toLocaleString().padStart(12)}`);
  });
  console.log(`\n✅ 저장: ${outFile} (총 ${mergedRows.length}일치 누적)`);
  process.exit(0);
})();
