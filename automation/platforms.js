// 플랫폼별 설정 — 로그인 시작 URL과 세션(쿠키) 저장 파일명
// 새 플랫폼 추가 시 여기에 한 줄만 넣으면 login.js가 자동 인식합니다.

const PLATFORMS = {
  // successUrlIncludes: 로그인 성공 후 이동하는 URL에 포함되는 문자열(하나라도 맞으면 로그인 완료로 간주)

  // ===== 매출 =====
  cafe24: {
    label: '카페24 (자사몰)',
    loginUrl: 'https://eclogin.cafe24.com/Shop/',
    successUrlIncludes: ['/admin'],
  },
  coupang: {
    label: '쿠팡 WING',
    loginUrl: 'https://wing.coupang.com/',
    // 로그인 후 wing.coupang.com 도메인의 실제 화면에서만 감지 (xauth SSO URL 오탐 방지)
    successUrlIncludes: ['wing.coupang.com/tenants', 'wing.coupang.com/dashboard', 'wing.coupang.com/home'],
  },
  smartstore: {
    label: '스마트스토어 (네이버 커머스)',
    loginUrl: 'https://sell.smartstore.naver.com/',
    successUrlIncludes: ['/#/home', '/#/dashboard', 'sell.smartstore.naver.com/#'],
  },

  // ===== 광고비 =====
  meta: {
    label: '메타 광고 관리자',
    loginUrl: 'https://adsmanager.facebook.com/',
    successUrlIncludes: ['/adsmanager/manage', 'act='],
  },
  tiktok: {
    label: '틱톡 Ads Manager',
    loginUrl: 'https://ads.tiktok.com/',
    successUrlIncludes: ['/i18n/dashboard', '/i18n/perf', 'aadvid='],
  },
  google: {
    label: '구글 Ads',
    loginUrl: 'https://ads.google.com/',
    successUrlIncludes: ['/aw/overview', '/aw/campaigns', 'ocid='],
  },
  gfa: {
    label: 'GFA (네이버 성과형 디스플레이)',
    loginUrl: 'https://gfa.naver.com/',
    successUrlIncludes: ['/managementV2', '/dashboard', 'gfa.naver.com/ad'],
  },
};

module.exports = { PLATFORMS };
