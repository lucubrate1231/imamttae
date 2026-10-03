/**
 * 앱 뼈대: 주소(해시)에 따라 화면을 그립니다.
 * - #/ 또는 #/month/10 → 첫 화면 '지금 볼 만한 곳'(기능 ①)
 * - #/scene/… → 장면 상세(F2). 첫 화면 위에 올라옴
 * - 풍경 찾기·내 수첩은 아직 없음: 아래 메뉴를 누르면 '곧 열려요'(10/3 사용자 결정)
 */
import type { ContentFile } from '../shared/schema/content';
import { monthInSeoul, type Month } from './domain/month';
import { parseRoute, routeHref, type Route } from './domain/router';
import { createFailedMap } from './map/failedMap';
import type { MapAdapter } from './map/types';
import { createSafeStore, type SafeStore } from './storage/safeStorage';
import { createDetail } from './ui/detail';
import { h } from './ui/dom';
import { createHome } from './ui/home';
import { createNavi } from './ui/navi';
import { createMemoryWanted, type WantedLike } from './ui/wanted';

export interface AppDeps {
  root: HTMLElement;
  map: MapAdapter;
  /** 장면 데이터. 못 불러왔으면 null */
  content: ContentFile | null;
  now?: Date;
  win?: Window;
  /** 지도를 못 불러왔음(테스트에서 실패를 흉내 낼 때) */
  mapFailed?: boolean;
  /** 휴대폰인지 가리는 브라우저 정보(길찾기). 기본은 navigator.userAgent */
  ua?: string;
  /** 다른 앱·웹 주소 열기(길찾기). 테스트에서 가짜로 바꿈 */
  openUrl?: (url: string) => void;
  /** 휴대폰 저장소(고른 길찾기 앱 기억) */
  store?: SafeStore;
  /** 가고 싶어요 저장. Codex 일 2 전까지는 임시(화면을 닫으면 사라짐) */
  wanted?: WantedLike;
  /** 사진 움직임. 기본 켬, 주소에 ?motion=0이면 끔 */
  motion?: boolean;
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
  for (const [i, t] of ['지금 풍경', '풍경 찾기', '내 수첩'].entries()) {
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
  let openedInApp = false; // 앱 안에서 상세를 열었으면 뒤로 = 이전 화면, 주소로 바로 열었으면 뒤로 = 첫 화면
  const home = createHome({
    win,
    map,
    scenes: deps.content.scenes,
    openScene: (id) => {
      openedInApp = true;
      win.location.hash = routeHref({ name: 'scene', id });
    },
    toast,
  });
  const navi = createNavi({ win, ua: deps.ua ?? win.navigator.userAgent, openUrl: deps.openUrl ?? ((u) => win.location.assign(u)), store: deps.store ?? createSafeStore() });
  const detail = createDetail({
    win,
    scenes: deps.content.scenes,
    today: thisMonth,
    navi,
    wanted: deps.wanted ?? createMemoryWanted(),
    motion: deps.motion ?? new URLSearchParams(win.location.search).get('motion') !== '0',
    toast,
    back: () => {
      if (openedInApp) {
        openedInApp = false;
        win.history.back();
      } else win.location.hash = routeHref({ name: 'month', month: null });
    },
  });
  root.replaceChildren(...home.nodes, tabs, detail.el, navi.sheet, toastEl);
  await map.mount(home.mapHost);

  let shown: Month | null = null;
  function render(route: Route): void {
    // 장면 상세를 여는 동안에도 첫 화면은 보던 달 그대로
    const month = route.name === 'month' ? (route.month ?? thisMonth) : (shown ?? thisMonth);
    if (month !== shown) {
      shown = month;
      home.render(month);
    }
    if (route.name === 'scene' && detail.show(route.id)) return;
    detail.hide();
    navi.sheet.hidden = true;
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
