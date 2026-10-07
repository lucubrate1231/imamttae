/*
 * 이맘때 풍경 — 작은 서비스 워커(F5-AC2)
 * 크롬이 자동 설치 창을 띄우려면 fetch 처리기가 있는 서비스 워커가 아직 필요해서 둡니다.
 * 하는 일은 하나: 화면 이동(앱 열기)은 늘 인터넷에서 새로 받고, 인터넷이 끊겼을 때만 마지막에 받은 화면을 보여 줍니다.
 * 사진·데이터·스크립트는 건드리지 않습니다(배포하면 바로 새것이 보이게).
 * 같은 파일이 베타(imamttae.site/)와 미리보기(imamttae.site/next/)에서 각자 등록됩니다(D64 — 옛 주소 /imamttae/도 같은 규칙).
 */
// v2(10/8, D63): v1은 앱 화면이 아닌 페이지도 '앱 화면'으로 저장할 수 있어 지움
const CACHE = 'imamttae-shell-v2';

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
  // 베타(/)의 워커는 미리보기(/next/) 화면을 건드리지 않음
  if (url.pathname.startsWith(scope.pathname + 'next/')) return;
  // 장면 공유 페이지(s/<번호>/, D63)는 건드리지 않음 — 카톡 카드용 작은 페이지라 열면 바로 앱으로 넘어감
  if (url.pathname.startsWith(scope.pathname + 's/')) return;
  // 앱 화면(폴더 주소·index.html)만 '마지막에 받은 화면'으로 저장. 다른 페이지(확인 페이지 등)가 그 자리를 덮지 않게
  const isApp = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && isApp) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(scope.href, copy)));
        }
        return res;
      })
      .catch(() => caches.match(scope.href).then((r) => r || Response.error())),
  );
});
