import './styles/tokens.css';
import './styles/app.css';
import type { ContentFile } from '../shared/schema/content';
import { startApp } from './app';
import { createMap, pickMapMode } from './map';
import { createUmamiTracker, SITE_ID, tagFor } from './analytics';
import { registerServiceWorker } from './pwa';

/** 장면 데이터 불러오기. 실패하면 null(화면이 쉬운 말로 알림) */
async function loadContent(): Promise<ContentFile | null> {
  try {
    const res = await fetch(new URL('./data/scenes.json', location.href));
    if (!res.ok) return null;
    return (await res.json()) as ContentFile;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const mode = pickMapMode(location.search, import.meta.env.VITE_MAP_MODE);
  const key = import.meta.env.VITE_KAKAO_JS_KEY ?? '';
  // 첫 화면과 풍경 찾기가 지도를 하나씩 씀(카카오 SDK는 한 번만 불러옴)
  const [content, { map, fallbackReason }, { map: findMap }] = await Promise.all([loadContent(), createMap(mode, key), createMap(mode, key)]);
  if (fallbackReason) console.warn('[imamttae] 지도 대체:', fallbackReason);
  // 사용 통계(docs/analytics.md): github.io에서만 보내고, 미리보기·알파는 꼬리표로 나눔
  const tracker = createUmamiTracker(window, { siteId: SITE_ID, tag: tagFor(location.pathname) });
  registerServiceWorker(window); // 홈 화면에 추가(F5-AC2) — github.io에서만
  await startApp({ root, map, findMap, content, tracker });
}

void main();
