# CLAUDE.md — 해외지갑 앱 (저장소 이름: trip-expense)

워크플로우 규칙(README / RELEASE_NOTES / claude_ideas / todo_for_user, 커밋 양식, 버전 규칙)은 전역 `~/.claude/CLAUDE.md`를 따른다.
이 파일은 프로젝트 고유 내용만 적는다.

## 기술 스택

- 순수 HTML/CSS/JS 단일 파일(`index.html`), 빌드 도구·프레임워크·외부 라이브러리 없음
- 저장: `localStorage` 키 `tripExpense.v4` = 여러 출장 DB (서버 없음). 예전 단일 출장 키 `v3`·`v2`·`v1`은 `migrate()`(v1→v2→v3) 후 `wrapSingle()`로 첫 번째 출장이 됨
- 환율: `https://open.er-api.com/v6/latest/USD` (무료, 키 불필요, CORS 허용) — 하루 1회 조회, `CURS`에 있는 통화만 저장
- 날짜별 환율(정산용): `https://api.frankfurter.dev/v2/rates?from=&to=&base=&quotes=KRW` (무료, CORS 허용, 주말 포함, `CURS` 13개 통화 모두 지원). v1은 deprecated
- PWA: `manifest.webmanifest`, `sw.js`(같은 출처 파일만 네트워크 우선 + 캐시 폴백)
- 배포: GitHub Pages (정적 파일 그대로)

## 통화 모델 (v0.4.0~)

- `CURS`: 지원 통화 표 (기호, 앞/뒤 표기, 소수 자리, n빵 올림 단위, 자동 조회 전 임시 환율 `usd`). 통화를 추가하려면 여기에 한 줄 추가.
- `PRESETS`: 나라 프리셋 (일비 통화, 결제 버튼, 고정 환율).
- **일비 통화(`settings.base`)** 가 모든 합계·일비 비교의 기준. 모든 환율은 '일비 통화 1단위당 그 통화 금액'.
- 결제 버튼 id는 `payIdFor(method, cur)`로 결정적으로 만든다. 캄보디아 4개는 예전 키(`cash`/`riel`/`card`/`bank`)를 유지해서 기존 지갑 기록과 호환.
- 지갑 = 현금·카드 결제 버튼 (입금 제외). 지갑 키 = 결제 버튼 id.

## 데이터 구조

여러 출장·여행 DB (v4) — `DB`. 지금 보고 있는 출장은 `S` (= `DB.trips`의 한 항목). 기존 코드는 `S`만 다루고, 다른 출장 계산은 `withTrip(t, fn)`.

```js
DB = {
  version: 4,
  cur,                          // 지금 보고 있는 출장 id
  trips: [출장],                // 아래 '출장' 구조 + id
  fetched: { date, updated, rates: { 통화: 1달러당 } },  // 자동 환율 (모든 출장 공통)
  hist: { 일비통화: { 'YYYY-MM-DD': 원 } },              // 정산용 날짜별 환율 (모든 출장 공통)
  histTry: { 일비통화: '오늘|시작|끝' }                  // 같은 범위는 하루 한 번만 조회
}
```

출장 하나 (v3 구조) — `S`

```js
{
  id, version: 3,
  settings: {
    kind,                       // '출장'(회사 일비·선지급) | '여행'(하루 예산, 선지급·지급 환율 없음)
    title, start, end,          // 'YYYY-MM-DD'
    preset,                     // 마지막으로 고른 나라 프리셋 키 (kh/jp/vn/th)
    base, daily,                // 일비 통화와 하루 일비
    defaultPayRate,             // 기본 회사 지급 환율 (원 / 일비 통화 1단위)
    payRates: { 'YYYY-MM': 1330 },  // 월별 회사 지급 환율 (일비 원화 계산에만 사용)
    pays: [{ id, method, cur }],    // 결제 버튼 (입력 화면 순서: 현금 → 카드 → 입금)
    rateCfg: { KHR: { fixed: true, value: 4000 } },  // 통화별 📌 고정 환율 (일비 통화 1단위당)
    categories: [{ id, icon, name }],
    catVer,                     // 기본 카테고리 버전 (upgradeCats()에서 새 기본 카테고리를 한 번만 추가)
    lastSplitN,                 // 마지막 n빵 인원
    settle: { mode, monthRates }  // 환율 정산: mode 'daily'(날짜별 기준환율) | 'month'(월별 직접 입력, { 'YYYY-MM': 원 })
  },
  expenses: [{ id, createdAt, date, cat, method, cur, amount, memo, r, chg, split }],
  // method: '현금' | '카드' | '입금', cur: CURS 키
  // r: 저장 시점 환율 스냅샷 { 통화: 일비 통화 1단위당 } (과거 기록은 환율이 바뀌어도 변하지 않음)
  // chg: { cur, amount } — 현금으로 내고 다른 통화 현금으로 받은 거스름 (사용액에서 빼고 그 통화 현금 지갑에 더함)
  // split: { total, n } — n빵 계산기로 계산한 금액 그대로 저장했을 때만 (수정에서 금액·통화가 바뀌면 삭제)
  moves: [{ id, createdAt, date, type, from, amount, to, amount2, set, memo }]
  // 지갑 이동. type 'in'(넣기: to, amount) | 'xfer'(바꾸기: from, amount → to, amount2) | 'adjust'(보정: to, amount=차이, set=센 금액)
  // from/to = 결제 버튼 id
}
```

- 데이터 구조를 바꾸면 `migrate()`에 변환을 추가하고, 필요하면 키 버전을 올린다. 백업 불러오기도 `migrate()`를 거친다.
- 일비 통화는 기록이 있으면 바꿀 수 없다 (스냅샷 `r`이 일비 통화 기준이라). 바꾸면 고정 환율·지급 환율을 초기화한다.

## 도메인 규칙

- 회사는 일비를 **매월 1일에 그 달 출장일수만큼 선지급**한다. 첫 달은 출장 시작일에 지급.
- 지급 시점 환율로 먼저 주고, 이후 환율 차이는 추가 지급/페이백으로 정산된다.
- 캄보디아: 카드(미리 환전, $), 현금($ / 리엘), 입금(동료 n빵, ₩). 가게는 1$ = 4,000៛로 계산 → 리엘 📌 고정이 기본.
- 거스름은 '다른 통화 현금'으로 받을 때만 `chg`로 기록 (선택 입력). 같은 통화 거스름은 실제 쓴 금액만 적는다.
- 넣기·바꾸기·맞추기는 지출이 아니다.
- 일비 대비 판단은 일비 통화 기준. 원화 금액은 참고용.
- 여행(`kind: '여행'`)은 '일비' 대신 '예산'(`W()`)으로 표시하고, 예산의 원화 환산은 오늘 환율을 쓴다.
- 화면 문구에서 '출장'은 `KIND()`, '일비/예산'은 `W()`로 쓴다 (하드코딩 금지).

## 개발 시 주의

- 폰 사용이 우선: 입력은 최소 탭 수로. 숫자 입력은 `inputmode` 지정, 큰 터치 영역.
- 앱 파일을 수정하면 `sw.js`의 `CACHE` 버전과 `index.html`의 `APP_VERSION`을 함께 올린다.
- 앱 이름은 `APP_NAME` 한 곳에서 관리 (manifest, `<title>`도 같이 바꿀 것).
- 날짜는 로컬 시간 기준 문자열(`YYYY-MM-DD`)로 다룬다 (UTC 변환 금지).
- 로컬 테스트: `python -m http.server 8766 --directory C:/sources/trip-expense` 후 `http://localhost:8766`
  (Browser pane의 preview_start는 예전 폴더 설정을 쓰는 문제가 있었음. 로컬 포트에서는 서비스 워커 등록이 실패할 수 있으니 SW는 배포 사이트에서 확인)
