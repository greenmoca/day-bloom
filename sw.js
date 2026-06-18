/* DAY BLOOM 서비스 워커
   업데이트 전략:
   - CACHE 버전을 올리면(v1 -> v2) 활성화 때 옛 캐시를 모두 지웁니다.
   - 페이지(HTML)는 'network-first': 온라인이면 항상 최신을 받고, 오프라인이면 캐시로 폴백.
   - 아이콘·매니페스트 등 정적 파일은 'cache-first'로 빠르게.
   - 새 버전은 자동 적용하지 않고 '대기'하다가, 사용자가 안내에서 동의(SKIP_WAITING)하면 적용됩니다. */
const CACHE = 'day-bloom-v2';
const ASSETS = [
  './manifest.json',
  './day-bloom-icon-180.png',
  './day-bloom-icon-192.png',
  './day-bloom-icon-512.png'
];

self.addEventListener('install', e => {
  // skipWaiting을 자동 호출하지 않음 → 새 버전은 '대기' 상태로 머무름.
  // 사용자가 안내에서 동의하면 페이지가 SKIP_WAITING 메시지를 보내 활성화함.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

// 페이지에서 사용자가 '새로고침'을 누르면 보내는 신호
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 페이지 이동(HTML): 네트워크 우선 → 실패 시 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./')))
    );
    return;
  }

  // 정적 파일: 캐시 우선 → 없으면 네트워크 후 캐시에 저장
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
