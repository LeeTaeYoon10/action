// 사용법: node sniff.js <플랫폼키> <브랜드|-> <URL> [필터키워드]
//   예) node sniff.js cafe24 basetune "https://basetune9000.cafe24.com/disp/admin/shop1/main/dashboard" 매출
//
// 페이지를 열면서 오가는 JSON(XHR/fetch) 응답을 캡처해 sniff-out/ 폴더에 저장하고,
// URL + 응답 본문 미리보기를 출력합니다. 매출/건수 데이터가 어느 API에서 오는지 찾는 용도.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platforms');

(async () => {
  const key = process.argv[2];
  const brandArg = process.argv[3];
  const url = process.argv[4];
  const filter = process.argv[5]; // 선택: 본문에 이 단어가 있는 응답만 자세히 출력
  const brand = (brandArg && brandArg !== '-') ? brandArg : null;
  const platform = PLATFORMS[key];

  if (!platform || !url) {
    console.error('사용법: node sniff.js <플랫폼키> <브랜드|-> <URL> [필터키워드]');
    process.exit(1);
  }

  const fileName = brand ? `${key}-${brand}.json` : `${key}.json`;
  const authFile = path.join(__dirname, 'auth', fileName);
  if (!fs.existsSync(authFile)) {
    console.error(`[오류] 세션 파일 없음: ${authFile}`);
    process.exit(1);
  }

  const outDir = path.join(__dirname, 'sniff-out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authFile,
    locale: 'ko-KR',
    viewport: { width: 1480, height: 1000 },
  });
  const page = await context.newPage();

  const captured = [];
  let idx = 0;
  page.on('response', async (res) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const rurl = res.url();
      const body = await res.text();
      if (!body || body.length < 2) return;
      idx++;
      const fname = `resp-${String(idx).padStart(3, '0')}.json`;
      fs.writeFileSync(path.join(outDir, fname), `// ${rurl}\n${body}`);
      const hasFilter = filter && body.includes(filter);
      captured.push({ idx, rurl, len: body.length, fname, hasFilter, preview: body.slice(0, 160).replace(/\s+/g, ' ') });
    } catch (_) {}
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.error('이동 경고:', e.message));
  await page.waitForTimeout(8000); // XHR 다 들어올 때까지 대기

  console.log(`\n=== 캡처된 JSON 응답 ${captured.length}개 (sniff-out/ 저장) ===\n`);
  for (const c of captured) {
    const mark = c.hasFilter ? ' ⭐' : '';
    console.log(`[${c.fname}]${mark} (${c.len}B)`);
    console.log(`  ${c.rurl}`);
    console.log(`  ${c.preview}`);
  }

  await browser.close();
  process.exit(0);
})();
