/**
 * 기다리지 않는 지도(#77): 카카오 SDK가 오기 전에도 화면은 바로 그립니다.
 * - 그동안 화면이 부른 핀 올리기·고르기·누르기·맞추기를 기억했다가, 지도가 준비되면 그대로 옮깁니다.
 * - 지도는 mount를 부를 때 처음 만듭니다(풍경 찾기 지도는 그 탭을 처음 열 때).
 * - 만들기가 실패하면 '지도를 불러오지 못했어요'(F1-AC10). 그동안 지도 칸은 바다색 바탕만(글자 없음).
 */
import { createFailedMap } from './failedMap';
import type { MapAdapter, MapPin } from './types';

export function createLazyMap(make: () => Promise<MapAdapter>): MapAdapter {
  let inner: MapAdapter | null = null; // 붙은 뒤에만 채움
  let started: Promise<void> | null = null;
  let destroyed = false;
  let pins: readonly MapPin[] | null = null;
  let selected: string | null = null;
  let wantFit = false;
  let handler: ((id: string) => void) | null = null;

  async function attach(el: HTMLElement): Promise<void> {
    let m: MapAdapter;
    try {
      m = await make();
    } catch {
      m = createFailedMap();
    }
    if (destroyed) return m.destroy();
    await m.mount(el);
    if (destroyed) return m.destroy();
    if (handler) m.onPinClick(handler);
    if (pins) m.setPins(pins);
    if (selected !== null) m.select(selected);
    if (wantFit) m.fit();
    inner = m;
  }

  return {
    get kind() {
      return inner?.kind ?? 'loading';
    },
    mount(el) {
      started ??= attach(el);
      return started;
    },
    setPins(list) {
      pins = list;
      wantFit = false; // 새 핀이면 맞추기도 새로
      inner?.setPins(list);
    },
    select(id) {
      selected = id;
      inner?.select(id);
    },
    fit() {
      wantFit = true;
      inner?.fit();
    },
    onPinClick(cb) {
      handler = cb;
      inner?.onPinClick(cb);
    },
    destroy() {
      destroyed = true;
      inner?.destroy();
      inner = null;
    },
  };
}
