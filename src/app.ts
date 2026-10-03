/**
 * 앱 뼈대. 기반 단계(10/4~10/6)에서는 달 띠와 지도까지만 있습니다.
 * 기능 ①②③은 docs/features 의 완성 기준을 확인받은 뒤 테스트부터 붙입니다.
 */
import { MONTHS, monthInSeoul, monthLabel } from './domain/month';
import { parseRoute, routeHref, type Route } from './domain/router';
import type { MapAdapter, MapPin } from './map/types';

export interface AppDeps {
  root: HTMLElement;
  map: MapAdapter;
  pins: readonly MapPin[];
  now?: Date;
  fallbackReason?: string;
  win?: Window;
}

export interface AppHandle {
  render(route: Route): void;
  destroy(): void;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { dataset, ...rest } = props;
  Object.assign(el, rest);
  if (dataset) for (const [k, v] of Object.entries(dataset)) el.dataset[k] = v;
  el.append(...kids);
  return el;
}

export async function startApp(deps: AppDeps): Promise<AppHandle> {
  const { root, map, pins } = deps;
  const win = deps.win ?? window;
  const thisMonth = monthInSeoul(deps.now);

  const months = h('nav', { className: 'months', ariaLabel: '달 고르기' });
  const chips = MONTHS.map((m) => {
    const b = h('button', { type: 'button', className: 'mchip', textContent: monthLabel(m), dataset: { month: String(m) } });
    b.addEventListener('click', () => {
      win.location.hash = routeHref({ name: 'month', month: m });
    });
    months.append(b);
    return b;
  });

  const canvas = h('div', { className: 'mapcanvas' });
  const empty = h('p', { className: 'empty', role: 'status' });
  const mapwrap = h('main', { className: 'mapwrap' }, canvas, empty);

  root.replaceChildren(
    h('header', { className: 'top' }, h('h1', { className: 'brand', textContent: '이맘때 자연' }), h('p', { className: 'sub', textContent: '이상호 작가가 아내와 다녀온 자연 명장면' })),
    months,
    ...(deps.fallbackReason ? [h('p', { className: 'notice', role: 'alert', textContent: '지도를 불러오지 못해 목록으로 보여 드려요.' })] : []),
    mapwrap,
    h('footer', { className: 'foot' }, '글·사진 © 이상호 · ', h('a', { href: 'https://brunch.co.kr/@caed5ea4c3d74d9', target: '_blank', rel: 'noopener', textContent: '브런치에서 전체 이야기' })),
  );

  await map.mount(canvas);
  map.onPinClick((id) => {
    win.location.hash = routeHref({ name: 'scene', id });
  });

  function render(route: Route): void {
    const month = route.name === 'month' ? (route.month ?? thisMonth) : thisMonth;
    for (const c of chips) {
      const on = Number(c.dataset.month) === month;
      c.setAttribute('aria-pressed', String(on));
      if (on) c.setAttribute('aria-current', 'date');
      else c.removeAttribute('aria-current');
    }
    map.setPins(pins);
    empty.textContent = pins.length ? '' : `${monthLabel(month)} 명장면을 정리하고 있어요. 곧 핀이 올라옵니다.`;
    empty.hidden = pins.length > 0;
  }

  const onHash = () => render(parseRoute(win.location.hash));
  win.addEventListener('hashchange', onHash);
  onHash();
  chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });

  return {
    render,
    destroy() {
      win.removeEventListener('hashchange', onHash);
      map.destroy();
    },
  };
}
