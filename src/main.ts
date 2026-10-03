import './styles/tokens.css';
import './styles/app.css';
import type { ContentFile } from '../shared/schema/content';
import { startApp } from './app';
import { createMap, pickMapMode } from './map';

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
  const [content, { map, fallbackReason }] = await Promise.all([loadContent(), createMap(mode, import.meta.env.VITE_KAKAO_JS_KEY ?? '')]);
  if (fallbackReason) console.warn('[imamttae] 지도 대체:', fallbackReason);
  await startApp({ root, map, content });
}

void main();
