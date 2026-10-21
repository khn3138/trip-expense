# CLAUDE.md — 출장 경비 앱

워크플로우 규칙(README / RELEASE_NOTES / claude_ideas / todo_for_user, 커밋 양식, 버전 규칙)은 전역 `~/.claude/CLAUDE.md`를 따른다.
이 파일은 프로젝트 고유 내용만 적는다.

## 기술 스택

- 순수 HTML/CSS/JS 단일 파일(`index.html`), 빌드 도구·프레임워크·외부 라이브러리 없음
- 저장: `localStorage` 키 `tripExpense.v2` (서버 없음). `tripExpense.v1`은 `migrate()`에서 자동 변환
- 환율: `https://open.er-api.com/v6/latest/USD` (무료, 키 불필요, CORS 허용) — 하루 1회 조회
- PWA: `manifest.webmanifest`, `sw.js`(같은 출처 파일만 네트워크 우선 + 캐시 폴백)
- 배포: GitHub Pages (정적 파일 그대로)

## 데이터 구조 (v2)

```js
{
  version: 2,
  settings: {
    title, start, end,          // 'YYYY-MM-DD'
    dailyUsd,                   // 하루 일비 (달러)
    defaultPayRate,             // 기본 회사 지급 환율
    payRates: { 'YYYY-MM': 1330 },  // 월별 회사 지급 환율 (일비 원화 계산에만 사용)
    autoRate,                   // 환율 자동 조회 사용 여부 (기본 true)
    manualKrw, manualKhr,       // 내 환율 (자동 OFF일 때 사용, ON일 때는 조회 실패 시 폴백)
    fetched: { krw, khr, date, updated },  // 마지막 자동 조회 결과
    categories: [{ id, icon, name }]
  },
  expenses: [{ id, createdAt, date, cat, method, cur, amount, memo, rKrw, rKhr }]
  // method: '현금' | '카드' | '입금', cur: 'USD' | 'KHR' | 'KRW'
  // rKrw/rKhr: 저장 시점 환율 스냅샷 (과거 기록은 환율이 바뀌어도 변하지 않음)
}
```

- 데이터 구조를 바꾸면 `migrate()`에 변환을 추가하고, 필요하면 키 버전을 올린다. 백업 불러오기도 `migrate()`를 거친다.

## 도메인 규칙

- 회사는 일비를 **매월 1일에 그 달 출장일수만큼 선지급**한다. 첫 달은 출장 시작일에 지급.
- 지급 시점 환율로 먼저 주고, 이후 환율 차이는 추가 지급/페이백으로 정산된다.
- 결제 방식: 카드(미리 환전, $), 현금($ / 리엘), 입금(동료 n빵, ₩). UI에서는 `PAYS`의 4개 버튼으로 결제수단+통화를 한 번에 선택.
- 리엘 거스름돈은 따로 기록하지 않는다. 물건값만 기록하고 리엘은 쓸 때 기록.
- 일비 대비 판단은 달러 기준(환율 무관). 원화 금액은 참고용.

## 개발 시 주의

- 폰 사용이 우선: 입력은 최소 탭 수로. 숫자 입력은 `inputmode` 지정, 큰 터치 영역.
- 앱 파일을 수정하면 `sw.js`의 `CACHE` 버전과 `index.html`의 `APP_VERSION`을 함께 올린다.
- 날짜는 로컬 시간 기준 문자열(`YYYY-MM-DD`)로 다룬다 (UTC 변환 금지).
- 로컬 테스트: `.claude/launch.json`의 `app` (python http.server 8765)
