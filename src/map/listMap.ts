/**
 * 목록 지도: 지도 대신 핀을 버튼 목록으로 보여 줍니다.
 * 자동 테스트에서 가짜 지도로 씁니다(카카오 사용량·등록 주소와 무관, ?map=fake).
 */
import type { MapAdapter, MapPin } from './types';

export function createListMap(): MapAdapter {
  let list: HTMLUListElement | null = null;
  let handler: ((id: string) => void) | null = null;
  let selected: string | null = null;

  function paint(): void {
    list?.querySelectorAll<HTMLButtonElement>('button[data-pin-id]').forEach((b) => {
      if (b.dataset.pinId === selected) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  return {
    kind: 'list',
    async mount(el) {
      list = document.createElement('ul');
      list.className = 'listmap';
      list.setAttribute('aria-label', '지도의 장소');
      el.append(list);
    },
    setPins(pins: readonly MapPin[]) {
      if (!list) return;
      list.replaceChildren(
        ...pins.map((p) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `listpin listpin--${p.kind}`;
          b.dataset.pinId = p.id;
          b.textContent = p.label;
          b.addEventListener('click', () => handler?.(p.id));
          const li = document.createElement('li');
          li.append(b);
          return li;
        }),
      );
      paint();
    },
    select(id) {
      selected = id;
      paint();
    },
    onPinClick(cb) {
      handler = cb;
    },
    destroy() {
      list?.remove();
      list = null;
    },
  };
}
