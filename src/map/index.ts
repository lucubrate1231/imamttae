/** 어떤 지도를 쓸지 정합니다. 카카오 지도를 못 불러오면 안내만 보여 줍니다(F1-AC10). */
import { createFailedMap } from './failedMap';
import { createKakaoMap } from './kakaoMap';
import { createListMap } from './listMap';
import { loadKakaoSdk } from './kakaoSdk';
import type { MapAdapter } from './types';

export type MapMode = 'kakao' | 'fake';

export function pickMapMode(search: string, envMode: string | undefined): MapMode {
  const q = new URLSearchParams(search).get('map');
  if (q === 'fake' || q === 'kakao') return q;
  return envMode === 'fake' ? 'fake' : 'kakao';
}

export async function createMap(mode: MapMode, appkey: string, load = loadKakaoSdk): Promise<{ map: MapAdapter; fallbackReason?: string }> {
  if (mode === 'fake') return { map: createListMap() };
  try {
    const kakao = await load(appkey);
    return { map: createKakaoMap(kakao) };
  } catch (e) {
    return { map: createFailedMap(), fallbackReason: e instanceof Error ? e.message : String(e) };
  }
}
