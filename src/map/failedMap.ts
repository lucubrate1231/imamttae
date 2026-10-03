/** 지도를 불러오지 못했을 때: 지도 자리에 안내만 보여 줍니다. 사진 카드는 그대로 씁니다(F1-AC10). */
import type { MapAdapter } from './types';

export function createFailedMap(): MapAdapter {
  let note: HTMLElement | null = null;
  return {
    kind: 'failed',
    async mount(el) {
      note = document.createElement('p');
      note.className = 'mapfail';
      note.textContent = '지도를 불러오지 못했어요.';
      el.append(note);
    },
    setPins() {},
    select() {},
    fit() {},
    onPinClick() {},
    destroy() {
      note?.remove();
      note = null;
    },
  };
}
