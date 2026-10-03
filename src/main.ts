import './styles/tokens.css';
import './styles/base.css';
import { startApp } from './app';
import { createMap, pickMapMode } from './map';

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const mode = pickMapMode(location.search, import.meta.env.VITE_MAP_MODE);
  const { map, fallbackReason } = await createMap(mode, import.meta.env.VITE_KAKAO_JS_KEY ?? '');
  if (fallbackReason) console.warn('[imamttae] 지도 대체:', fallbackReason);
  await startApp({ root, map, pins: [], fallbackReason });
}

void main();
