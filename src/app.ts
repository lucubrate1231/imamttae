/**
 * 앱 뼈대: 주소(해시)에 따라 화면을 그립니다.
 * - #/ 또는 #/month/10 → 첫 화면 '지금 볼 만한 곳'(기능 ①)
 * - #/scene/… → 장면 상세(F2, 다음 PR)
 * - 풍경 찾기·내 수첩은 아직 없음: 아래 메뉴를 누르면 '곧 열려요'(10/3 사용자 결정)
 */
import type { ContentFile } from '../shared/schema/content';
import { monthInSeoul, type Month } from './domain/month';
import { parseRoute, routeHref, type Route } from './domain/router';
import { createFailedMap } from './map/failedMap';
import type { MapAdapter } from './map/types';
import { h } from './ui/dom';
import { createHome } from './ui/home';

export interface AppDeps {
  root: HTMLElement;
  map: MapAdapter;
  /** 장면 데이터. 못 불러왔으면 null */
  content: ContentFile | null;
  now?: Date;
  win?: Window;
  /** 지도를 못 불러왔음(테스트에서 실패를 흉내 낼 때) */
  mapFailed?: boolean;
}

export interface AppHandle {
  render(route: Route): void;
  destroy(): void;
}

export async function startApp(deps: AppDeps): Promise<AppHandle> {
  const { root } = deps;
  const win = deps.win ?? window;
  const thisMonth = monthInSeoul(deps.now);

  // 잠깐 뜨는 알림
  const toastEl = h('div', { class: 'toast', role: 'status' });
  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => toastEl.classList.remove('on'), 1800);
  };

  // 아래 메뉴: 지금 · 풍경 찾기 · 내 수첩
  const tabs = h('nav', { class: 'tabs', 'aria-label': '메뉴' });
  for (const [i, t] of ['지금', '풍경 찾기', '내 수첩'].entries()) {
    const b = h('button', { type: 'button', text: t, ...(i === 0 ? { 'aria-current': 'page' } : {}) });
    b.addEventListener('click', () => (i === 0 ? (win.location.hash = routeHref({ name: 'month', month: null })) : toast('곧 열려요')));
    tabs.append(b);
  }

  // C-4: 데이터를 못 불러오면 쉬운 말로 알리고 멈추지 않음
  if (!deps.content) {
    root.replaceChildren(h('main', {}, h('p', { class: 'empty-month', role: 'alert', text: '장면을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' })), tabs, toastEl);
    return { render() {}, destroy() {} };
  }

  const map = deps.mapFailed ? createFailedMap() : deps.map;
  const home = createHome({
    win,
    map,
    scenes: deps.content.scenes,
    openScene: (id) => (win.location.hash = routeHref({ name: 'scene', id })),
    toast,
  });
  root.replaceChildren(...home.nodes, tabs, toastEl);
  await map.mount(home.mapHost);

  let shown: Month | null = null;
  function render(route: Route): void {
    // 장면 상세(다음 PR)를 여는 동안에도 첫 화면은 보던 달 그대로
    const month = route.name === 'month' ? (route.month ?? thisMonth) : (shown ?? thisMonth);
    if (month !== shown) {
      shown = month;
      home.render(month);
    }
  }

  const onHash = () => render(parseRoute(win.location.hash));
  win.addEventListener('hashchange', onHash);
  onHash();
  // F1-AC1: 달 띠의 이번 달을 화면 가운데로
  root.querySelector<HTMLElement>('.mchip[aria-pressed="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });

  return {
    render,
    destroy() {
      win.removeEventListener('hashchange', onHash);
      home.destroy();
      map.destroy();
    },
  };
}
