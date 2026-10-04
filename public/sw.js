/*
 * 이맘때 풍경 — 작은 서비스 워커(F5-AC2)
 * 크롬이 자동 설치 창을 띄우려면 fetch 처리기가 있는 서비스 워커가 아직 필요해서 둡니다.
 * 하는 일은 하나: 화면 이동(앱 열기)은 늘 인터넷에서 새로 받고, 인터넷이 끊겼을 때만 마지막에 받은 화면을 보여 줍니다.
 * 사진·데이터·스크립트는 건드리지 않습니다(배포하면 바로 새것이 보이게).
 * 같은 파일이 /imamttae/(알파)와 /imamttae/next/(미리보기)에서 각자 등록됩니다.
 */
const CACHE = 'imamttae-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  const scope = new URL(self.registration.scope);
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // 알파(/imamttae/)의 워커는 미리보기(/imamttae/next/) 화면을 건드리지 않음
  if (url.pathname.startsWith(scope.pathname + 'next/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(scope.href, copy)));
        }
        return res;
      })
      .catch(() => caches.match(scope.href).then((r) => r || Response.error())),
  );
});
