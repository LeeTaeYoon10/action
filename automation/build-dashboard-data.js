// out/*.json 수집파일들을 대시보드 자동로드용 data/auto-basetune.json 으로 합침
const fs = require('fs');
const path = require('path');
const outDir = path.join(__dirname, 'out');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const files = ['cafe24-basetune.json', 'coupang-basetune.json', 'smartstore-basetune.json', 'meta-basetune.json', 'tiktok-basetune.json', 'google-basetune.json', 'gfa-basetune.json'];
const collected = [];
for (const f of files) {
  const p = path.join(outDir, f);
  if (!fs.existsSync(p)) continue;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j.platform && Array.isArray(j.rows)) collected.push({ platform: j.platform, brand: j.brand || 'basetune', rows: j.rows });
  } catch (_) {}
}
const out = { updatedAt: new Date().toISOString(), files: collected };
fs.writeFileSync(path.join(dataDir, 'auto-basetune.json'), JSON.stringify(out, null, 2));
console.log(`data/auto-basetune.json 생성 (${collected.length}개 채널)`);
collected.forEach((c) => console.log(`  ${c.platform}: ${c.rows.length}일치`));
