import './styles/tokens.css';
import './styles/app.css';
import type { ContentFile } from '../shared/schema/content';
import { startApp } from './app';
import { createMap, pickMapMode } from './map';
import { createLazyMap } from './map/lazyMap';
import { createUmamiTracker, SITE_ID, tagFor } from './analytics';
import { captureInstallPrompt, registerServiceWorker } from './pwa';

// 크롬 설치 창 신호는 앱이 다 그려지기 전에 올 수 있어 가장 먼저 듣기 시작함(F5-AC2)
const installPrompt = captureInstallPrompt(window);

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
  // 지도를 기다리지 않음(#77): 카카오 SDK는 지금 바로 받기 시작하고, 앱은 장면 데이터만 오면 그림.
  // 첫 화면과 풍경 찾기가 지도를 하나씩 씀(SDK는 한 번만 불러옴). 풍경 찾기 지도는 그 탭을 처음 열 때 만듦
  const makeMap = () =>
    createMap(mode, key).then(({ map, fallbackReason }) => {
      if (fallbackReason) console.warn('[imamttae] 지도 대체:', fallbackReason);
      return map;
    });
  const homeMap = makeMap();
  const map = createLazyMap(() => homeMap);
  const findMap = createLazyMap(makeMap);
  const content = await loadContent();
  // 사용 통계(docs/analytics.md): github.io에서만 보내고, 미리보기·알파는 꼬리표로 나눔
  const tracker = createUmamiTracker(window, { siteId: SITE_ID, tag: tagFor(location.pathname) });
  registerServiceWorker(window); // 홈 화면에 추가(F5-AC2) — github.io에서만
  await startApp({ root, map, findMap, content, tracker, installPrompt });
}

void main();
