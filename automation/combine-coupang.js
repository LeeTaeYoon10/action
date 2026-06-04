// 쿠팡 계정별 파일(coupang-acc*.json)을 날짜별로 합산 → 대시보드 import용 파일
// 출력: out/coupang-basetune.json  { platform:'coupang', brand:'basetune', rows:[{date,sales,count}] }
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'out');
const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => /^coupang-acc\d+\.json$/.test(f)) : [];
if (!files.length) { console.error('계정 파일(coupang-acc*.json)이 없습니다. 먼저 scrape-coupang.js 실행.'); process.exit(1); }

const byDate = {};
const accounts = [];
for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
    accounts.push(j.account || f);
    (j.rows || []).forEach((r) => {
      if (!r || !r.date) return;
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, sales: 0, count: 0 };
      byDate[r.date].sales += r.sales || 0;
      byDate[r.date].count += r.count || 0;
    });
  } catch (e) { console.error('읽기 오류', f, e.message); }
}
const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
const outFile = path.join(outDir, 'coupang-basetune.json');
fs.writeFileSync(outFile, JSON.stringify({ platform: 'coupang', brand: 'basetune', rows }, null, 2));

console.log(`합산 계정: ${accounts.join(', ')} (${files.length}개 파일)`);
rows.forEach((r) => console.log(`  ${r.date}  매출 ₩${r.sales.toLocaleString()} / 주문 ${r.count}건`));
console.log(`✅ 저장: ${outFile}`);
