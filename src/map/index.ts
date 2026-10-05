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

/**
 * focusLevel: 첫 화면 지도의 단계(카카오 지도 단계, 작을수록 가까이). 풍경 찾기 지도는 넘기지 않음
 * showReason: 못 불러오면 그 까닭도 지도 칸에(미리보기만)
 */
export async function createMap(mode: MapMode, appkey: string, load = loadKakaoSdk, opts: { focusLevel?: number; showReason?: boolean } = {}): Promise<{ map: MapAdapter; fallbackReason?: string }> {
  if (mode === 'fake') return { map: createListMap() };
  try {
    const kakao = await load(appkey);
    return { map: createKakaoMap(kakao, { focusLevel: opts.focusLevel }) };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { map: createFailedMap(opts.showReason ? reason : undefined), fallbackReason: reason };
  }
}
