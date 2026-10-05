/** 지도를 불러오지 못했을 때: 지도 자리에 안내만 보여 줍니다. 사진 카드는 그대로 씁니다(F1-AC10). */
import type { MapAdapter } from './types';

/** why: 못 불러온 까닭. 미리보기에서만 넘겨 작은 글자로 보여 줌(휴대폰에서 원인을 찾으려고, 10/5) */
export function createFailedMap(why?: string): MapAdapter {
  let note: HTMLElement | null = null;
  return {
    kind: 'failed',
    async mount(el) {
      note = document.createElement('p');
      note.className = 'mapfail';
      note.textContent = '지도를 불러오지 못했어요.';
      if (why) {
        const small = document.createElement('small');
        small.className = 'mapfail-why';
        small.textContent = why;
        note.append(small);
      }
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
