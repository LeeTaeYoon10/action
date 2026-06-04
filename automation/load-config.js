// 계정 식별자(몰 도메인, 광고계정 ID 등)를 config.local.json에서 로드.
// config.local.json은 .gitignore로 보호되어 공개 repo에 올라가지 않는다.
const fs = require('fs');
const path = require('path');

function loadConfig() {
  const f = path.join(__dirname, 'config.local.json');
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }
}

module.exports = { loadConfig };
