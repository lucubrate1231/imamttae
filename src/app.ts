/**
 * 앱 뼈대: 주소(해시)에 따라 화면을 그립니다.
 * - #/ 또는 #/month/10 → 첫 화면 '지금 볼 만한 곳'(기능 ①)
 * - #/scene/… → 장면 상세(F2). 첫 화면 위에 올라옴
 * - #/find, #/find/danpung, #/find/all/gangwon → 풍경 찾기(F3)
 * - #/saved → 저장한 곳(F4)
 * - 홈 화면에 두기(F5): 카톡 안 띠·처음 저장 판·[홈 화면에 두기] 카드(src/ui/a2hs.ts)
 */
import type { ContentFile } from '../shared/schema/content';
import { monthInSeoul, type Month } from './domain/month';
import { parseRoute, routeHref, type Route } from './domain/router';
import { createFailedMap } from './map/failedMap';
import type { MapAdapter } from './map/types';
import { createSafeStore, type SafeStore } from './storage/safeStorage';
import { dateInSeoul, seasonOf } from './domain/home';
import { createDetail } from './ui/detail';
import { createFind } from './ui/find';
import type { TypeCovers } from './domain/covers';
import { h, paintBrowserBar } from './ui/dom';
import { createHome } from './ui/home';
import { createNavi } from './ui/navi';
import { applyCohortParam, applyMeParam, firstMonth, launchMode, type EventData, type Tracker } from './analytics';
import { createSaved } from './ui/saved';
import { createAlertCard, type AlertCard } from './ui/alertCard';
import { createSavedStore, type SavedStore } from './storage/saved';
import { createA2hs } from './ui/a2hs';
import { a2hsEnv, type InstallEvent } from './pwa';

export interface AppDeps {
  root: HTMLElement;
  map: MapAdapter;
  /** 장면 데이터. 못 불러왔으면 null */
  content: ContentFile | null;
  now?: Date;
  win?: Window;
  /** 풍경 찾기의 지도(첫 화면 지도와 따로). 풍경 찾기를 처음 열 때 붙임(#77). 없으면 '지도를 불러오지 못했어요' */
  findMap?: MapAdapter;
  /** 지도를 못 불러왔음(테스트에서 실패를 흉내 낼 때) */
  mapFailed?: boolean;
  /** 휴대폰인지 가리는 브라우저 정보(길찾기). 기본은 navigator.userAgent */
  ua?: string;
  /** 다른 앱·웹 주소 열기(길찾기). 테스트에서 가짜로 바꿈 */
  openUrl?: (url: string) => void;
  /** 휴대폰 저장소(고른 길찾기 앱 기억) */
  store?: SafeStore;
  /** 저장한 곳(F4). 없으면 휴대폰 저장소(Codex 일 4, src/storage/saved.ts) */
  saved?: SavedStore;
  /** 사용 통계(Umami). 없으면 아무것도 보내지 않음 */
  tracker?: Tracker;
  /** 사진 움직임. 기본 켬, 주소에 ?motion=0이면 끔 */
  motion?: boolean;
  /** 크롬 설치 창 신호(F5). main.ts가 앱보다 먼저 듣기 시작함(src/pwa.ts captureInstallPrompt) */
  installPrompt?: () => InstallEvent | null;
  /** 카톡 띠를 누른 뒤 이만큼 지나도 이 화면이면 그림 안내(기본 2초, 테스트는 0) */
  kakaoWaitMs?: number;
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
  /** action: 알림 오른쪽 버튼(예: 저장 뒤 [보기 ›], F4-AC3). 있으면 몇 초 더 오래 보임 */
  const toast = (msg: string, action?: { label: string; run(): void }) => {
    toastEl.replaceChildren(h('span', { text: msg }));
    toastEl.classList.toggle('act', !!action);
    if (action) {
      const b = h('button', { type: 'button', class: 'toast-go', text: action.label });
      b.addEventListener('click', () => {
        toastEl.classList.remove('on');
        action.run();
      });
      toastEl.append(b);
    }
    toastEl.classList.add('on');
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => toastEl.classList.remove('on'), action ? 3500 : 1800);
  };

  // ── 사용 통계(docs/analytics.md) ──
  const tracker: Tracker = deps.tracker ?? { load() {}, pageview() {}, track() {} };
  const store = deps.store ?? createSafeStore();
  applyMeParam(win, toast); // ?me=off / ?me=on: 우리 식구 빼기
  {
    const fm = firstMonth(store, deps.now ?? new Date());
    const open: EventData = { mode: launchMode(win) };
    if (new URLSearchParams(win.location.search).get('from') === 'share') open.from = 'share';
    const cohort = applyCohortParam(win, store); // D45: 초대 묶음(1차 지인·2차 밴드 등)
    if (cohort) open.cohort = cohort;
    open.first_month = fm.first_month;
    open.returning = fm.returning;
    tracker.track('app-open', open);
    if (fm.blocked) tracker.track('error', { kind: 'storage-blocked' });
  }
  let lastPage = ''; // 같은 주소를 연달아 두 번 세지 않음
  const pageview = () => {
    const url = `${win.location.pathname}${win.location.search}${win.location.hash}`;
    if (url === lastPage) return;
    lastPage = url;
    tracker.pageview(url);
  };

  // 아래 메뉴: 지금 풍경 · 풍경 찾기 · 저장한 곳(10/4 결정 D24)
  const tabs = h('nav', { class: 'tabs', 'aria-label': '메뉴' });
  for (const [i, t] of ['지금 풍경', '풍경 찾기', '저장한 곳'].entries()) {
    const b = h('button', { type: 'button', text: t, ...(i === 0 ? { 'aria-current': 'page' } : {}) });
    b.addEventListener('click', () => {
      if (i === 0) win.location.hash = routeHref({ name: 'month', month: null });
      else if (i === 1) win.location.hash = routeHref({ name: 'find', type: null, region: null });
      else win.location.hash = routeHref({ name: 'saved' });
    });
    tabs.append(b);
  }

  // C-4: 데이터를 못 불러오면 쉬운 말로 알리고 멈추지 않음
  if (!deps.content) {
    tracker.track('error', { kind: 'data-fail' });
    pageview();
    tracker.load();
    root.replaceChildren(h('main', {}, h('p', { class: 'empty-month', role: 'alert', text: '장면을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' })), tabs, toastEl);
    return { render() {}, destroy() {} };
  }

  const savedStore = deps.saved ?? createSavedStore(store, () => deps.now ?? new Date());
  const openUrl = deps.openUrl ?? ((u: string) => win.location.assign(u));
  // 홈 화면에 두기(F5). 넘겨받은 장면 번호를 저장한 곳에 합치므로 화면들보다 먼저 만듦
  const a2hs = createA2hs({
    win,
    env: a2hsEnv(deps.ua ?? win.navigator.userAgent, launchMode(win) === 'home-screen'),
    android: /Android/i.test(deps.ua ?? win.navigator.userAgent),
    scenes: deps.content.scenes,
    store,
    saved: savedStore,
    host: root,
    installPrompt: deps.installPrompt ?? (() => null),
    openUrl,
    waitMs: deps.kakaoWaitMs ?? 2000,
    toast,
    track: tracker.track,
  });
  const map = deps.mapFailed ? createFailedMap() : deps.map;
  let sceneFrom: string | null = null; // 통계 scene-open: 앱 안에서 연 곳(없으면 주소로 바로 = link)
  let openedInApp = false; // 앱 안에서 상세를 열었으면 뒤로 = 이전 화면, 주소로 바로 열었으면 뒤로 = 첫 화면
  const openSceneFrom = (id: string, from: string) => {
    openedInApp = true;
    sceneFrom = from;
    win.location.hash = routeHref({ name: 'scene', id });
  };
  // 제철 알림 카드(F4-AC10): 첫 화면과 저장한 곳 두 자리. 한쪽에서 닫으면 둘 다 다시 그림
  const alerts: AlertCard[] = [];
  const allScenes = deps.content.scenes;
  const alertFor = (where: 'home' | 'saved') => {
    const a = createAlertCard({
      scenes: allScenes,
      store: savedStore,
      today: thisMonth,
      monthKey: dateInSeoul(deps.now ?? new Date()).slice(0, 7),
      where,
      openScene: (id) => openSceneFrom(id, 'alert-card'),
      openSaved: () => (win.location.hash = routeHref({ name: 'saved' })),
      onClose: () => alerts.forEach((x) => x.render()),
      track: tracker.track,
    });
    alerts.push(a);
    return a;
  };
  const homeAlert = alertFor('home');
  const savedAlert = alertFor('saved');
  const home = createHome({
    win,
    map,
    scenes: deps.content.scenes,
    openScene: openSceneFrom,
    toast,
    alert: homeAlert.el,
    band: a2hs.band,
    homeAdd: () => a2hs.card(),
  });
  const navi = createNavi({ win, ua: deps.ua ?? win.navigator.userAgent, openUrl, store, track: tracker.track });
  const detail = createDetail({
    win,
    scenes: deps.content.scenes,
    today: thisMonth,
    navi,
    saved: savedStore,
    todayDate: () => dateInSeoul(deps.now ?? new Date()),
    track: tracker.track,
    motion: deps.motion ?? new URLSearchParams(win.location.search).get('motion') !== '0',
    toast,
    afterSave: (on) => a2hs.afterSave(on),
    back: () => {
      if (openedInApp) {
        openedInApp = false;
        win.history.back();
      } else win.location.hash = routeHref({ name: 'month', month: null });
    },
  });
  const findMap = deps.mapFailed ? createFailedMap() : (deps.findMap ?? createFailedMap());
  const find = createFind({
    win,
    map: findMap,
    scenes: deps.content.scenes,
    today: thisMonth,
    typeCovers: deps.content.typeCovers as TypeCovers | undefined,
    openScene: (id, from) => {
      openedInApp = true;
      sceneFrom = from;
      win.location.hash = routeHref({ name: 'scene', id });
    },
  });
  find.el.hidden = true;
  const saved = createSaved({
    win,
    scenes: deps.content.scenes,
    today: thisMonth,
    year: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(deps.now ?? new Date())),
    store: savedStore,
    navi,
    openScene: (id, from) => {
      openedInApp = true;
      sceneFrom = from;
      win.location.hash = routeHref({ name: 'scene', id });
    },
    toast,
    track: tracker.track,
    alert: savedAlert,
    homeAdd: () => a2hs.card(),
  });
  saved.el.hidden = true;
  root.replaceChildren(...home.nodes, find.el, saved.el, tabs, detail.el, navi.sheet, toastEl);
  // 지도를 기다리지 않고 화면부터 그림(#77). 카카오 SDK가 늦거나 막혀도 사진 카드는 바로 나옴
  const mapFail = () => tracker.track('error', { kind: 'map-fail' });
  const isFailed = (): boolean => map.kind === 'failed'; // 기다리는 지도(lazyMap)는 붙은 뒤에 바뀜
  const failedAtStart = isFailed();
  if (failedAtStart) mapFail();
  void map.mount(home.mapHost).then(() => {
    if (!failedAtStart && isFailed()) mapFail(); // 카카오가 늦게 실패함
  });
  let findMounted = false;

  const tabButtons = [...tabs.querySelectorAll('button')];
  let screen: 'home' | 'find' | 'saved' = 'home';
  /** 탭 바꾸기(첫 화면·풍경 찾기·저장한 곳). 색은 세 탭 모두 첫 화면에서 고른 달(design-guide 3장, PR #48) */
  function showScreen(next: 'home' | 'find' | 'saved'): void {
    if (next !== screen) win.scrollTo?.({ top: 0 });
    screen = next;
    for (const n of home.nodes) n.hidden = next !== 'home';
    if (next === 'home') home.alignMonths(); // D43: 다른 탭·장면 상세에서 돌아와도 고른 달이 보이게
    find.el.hidden = next !== 'find';
    saved.el.hidden = next !== 'saved';
    const tab = { home: 0, find: 1, saved: 2 }[next];
    tabButtons.forEach((b, i) => (i === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    const m = shown ?? thisMonth; // 세 탭 모두 첫 화면에서 고른 달의 색(PR #48). 글자·상태는 오늘 기준 그대로
    root.dataset.season = seasonOf(m);
    paintBrowserBar(win, root);
  }

  let shown: Month | null = null;
  let findKey = '';
  function render(route: Route): void {
    if (route.name === 'find') {
      if (!findMounted) {
        findMounted = true; // 풍경 찾기 지도는 그 탭을 처음 열 때 붙임(#77)
        void findMap.mount(find.mapHost);
      }
      const key = `${route.type}/${route.region}`;
      if (key !== findKey) {
        findKey = key;
        find.render(route.type, route.region);
        win.scrollTo?.({ top: 0 }); // 풍경 찾기 안에서 화면이 바뀌면 맨 위부터(상세에서 돌아올 때는 그대로)
      }
      showScreen('find');
    } else if (route.name === 'saved') {
      saved.render(); // 상세에서 저장·빼기를 했을 수 있어 들어올 때마다 새로 그림
      showScreen('saved');
    } else if (route.name !== 'scene') {
      // 장면 상세를 여는 동안에도 아래 화면은 보던 그대로
      const month = route.name === 'month' ? (route.month ?? thisMonth) : (shown ?? thisMonth);
      if (month !== shown) {
        shown = month;
        home.render(month);
      }
      homeAlert.render(); // 상세에서 저장·빼기를 했을 수 있어 첫 화면에 올 때마다
      showScreen('home');
    } else if (shown === null) {
      shown = thisMonth;
      home.render(thisMonth);
    }
    if (route.name === 'scene' && detail.show(route.id)) {
      tracker.track('scene-open', { scene: route.id, from: sceneFrom ?? 'link' });
      sceneFrom = null;
      return;
    }
    detail.hide();
    navi.sheet.hidden = true;
  }

  const onHash = () => {
    render(parseRoute(win.location.hash));
    pageview();
  };
  win.addEventListener('hashchange', onHash);
  onHash();
  tracker.load(); // 첫 화면을 다 그린 뒤 통계 스크립트를 늦게 부름

  return {
    render,
    destroy() {
      win.removeEventListener('hashchange', onHash);
      a2hs.destroy();
      home.destroy();
      find.destroy();
      map.destroy();
      findMap.destroy();
    },
  };
}
