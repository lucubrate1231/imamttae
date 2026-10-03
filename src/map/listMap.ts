/**
 * 목록 지도: 지도 대신 장면을 목록으로 보여 줍니다.
 * - 자동 테스트에서 가짜 지도로 씁니다(카카오 사용량·도메인과 무관).
 * - 카카오 지도를 불러오지 못했을 때 사용자에게 보여 주는 대체 화면이기도 합니다.
 */
import type { MapAdapter, MapPin } from './types';

export function createListMap(): MapAdapter {
  let root: HTMLElement | null = null;
  let list: HTMLUListElement | null = null;
  let handler: ((id: string) => void) | null = null;

  function render(pins: readonly MapPin[]): void {
    if (!list) return;
    list.replaceChildren();
    for (const p of pins) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `listpin listpin--${p.kind}`;
      b.dataset.pinId = p.id;
      b.textContent = p.label;
      b.addEventListener('click', () => handler?.(p.id));
      li.append(b);
      list.append(li);
    }
  }

  return {
    kind: 'list',
    async mount(el) {
      root = el;
      list = document.createElement('ul');
      list.className = 'listmap';
      list.setAttribute('aria-label', '장면 목록');
      el.append(list);
    },
    setPins: render,
    onPinClick(cb) {
      handler = cb;
    },
    focus() {},
    destroy() {
      list?.remove();
      root = null;
      list = null;
    },
  };
}
