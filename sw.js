// 오프라인에서도 열리도록 앱 파일을 캐시한다. 앱을 수정하면 CACHE 이름의 버전을 올릴 것.
const CACHE = 'trip-expense-v0.5.1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  // 브라우저 HTTP 캐시(GitHub Pages는 10분)를 거치지 않고 서버에서 새로 받음
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// 앱 파일만: 네트워크 우선, 실패하면 캐시 (수정 사항이 바로 반영되도록). 환율 API 등 외부 요청은 건드리지 않음.
// cache: 'no-cache' = 브라우저 HTTP 캐시가 있어도 서버에 바뀌었는지 확인 (안 바뀌었으면 304로 가볍게 끝남)
// navigate 요청은 옵션을 붙여 다시 만들 수 없어서 URL로 요청
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
