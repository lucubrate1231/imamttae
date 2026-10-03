/**
 * 사용 통계(Umami) — 설계: docs/analytics.md, 기준: 기획 측정 계획 7장
 * - 화면 코드는 track(사건, 값)·pageview(주소)만 부르고 Umami를 직접 모릅니다.
 * - 웹사이트 ID가 없으면 스크립트를 부르지 않고 아무것도 보내지 않습니다(사용자가 ID를 주기 전).
 * - Umami 기본 설정은 '#' 화면 이동을 세지 못해(pushState만 봄), 화면을 옮길 때마다 앱이 직접 화면 조회를 보냅니다.
 * - 보내지 않는 것: 이름·연락처·위치·좌표·적은 글·저장 목록 전체·개인 번호(umami.identify를 쓰지 않음).
 */
import type { SafeStore } from './storage/safeStorage';

export type EventName =
  | 'app-open'
  | 'scene-open'
  | 'navi'
  | 'navi-no-app'
  | 'share'
  | 'save'
  | 'brunch'
  | 'news'
  | 'feedback'
  | 'error'
  | 'alert-card'
  | 'visited'
  | 'a2hs';
export type EventData = Record<string, string | number | boolean>;

export interface Tracker {
  /** Umami 스크립트를 늦게 붙임(첫 화면을 다 그린 뒤) */
  load(): void;
  /** 화면 조회: '#' 뒤까지 포함한 주소 */
  pageview(url: string): void;
  track(name: EventName, data?: EventData): void;
}

/** 웹사이트 ID(비밀 키 아님). 사용자가 Umami에 가입한 뒤 줌(7-4). 비어 있으면 아무것도 보내지 않음 */
export const SITE_IDS = { alpha: '', preview: '' };
const SCRIPT_SRC = 'https://cloud.umami.is/script.js';
const DOMAINS = 'lucubrate1231.github.io'; // 이 주소에서만 보냄 → 내 컴퓨터·화면 테스트는 저절로 빠짐
const QUEUE_MAX = 50;

/** 주소가 /imamttae/next/ 로 시작하면 미리보기 ID, 아니면 알파 ID */
export function siteIdFor(pathname: string, ids: { alpha: string; preview: string } = SITE_IDS): string {
  return /^\/imamttae\/next(\/|$)/.test(pathname) ? ids.preview : ids.alpha;
}

/** 열린 방식: 홈 화면 앱 / 카카오톡 안 브라우저 / 그 밖 */
export function launchMode(win: Window): 'home-screen' | 'kakao-inapp' | 'browser' {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || win.matchMedia?.('(display-mode: standalone)').matches) return 'home-screen';
  if (/KAKAOTALK/i.test(nav.userAgent)) return 'kakao-inapp';
  return 'browser';
}

const seoulMonth = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
};

/**
 * 처음 연 달(D27): 휴대폰에 'YYYY-MM' 한 칸만 저장해 달을 넘는 재방문을 셈(Umami는 매달 1일 '같은 사람'을 초기화).
 * 저장이 막히면 none.
 */
export function firstMonth(store: SafeStore, now: Date): { first_month: string; returning: boolean; blocked: boolean } {
  const KEY = 'first-month';
  const thisMonth = seoulMonth(now);
  const saved = store.get<unknown>(KEY, null);
  if (typeof saved === 'string' && /^\d{4}-\d{2}$/.test(saved)) return { first_month: saved, returning: saved < thisMonth, blocked: false };
  if (!store.set(KEY, thisMonth)) return { first_month: 'none', returning: false, blocked: true };
  return { first_month: thisMonth, returning: false, blocked: false };
}

/** 공유 주소: 장면 주소에 ?from=share 만. utm_*·me 같은 꼬리표는 받은 사람에게 의미가 없어 뺌 */
export function shareUrl(loc: URL | Location, sceneId: string): string {
  return `${loc.origin}${loc.pathname}?from=share#/scene/${sceneId}`;
}

/** 우리 식구 빼기: ?me=off 면 이 브라우저는 통계에서 빠지고, ?me=on 이면 다시 들어감(브라우저마다 따로) */
export function applyMeParam(win: Window, say: (msg: string) => void): void {
  const url = new URL(win.location.href);
  const me = url.searchParams.get('me');
  if (me !== 'off' && me !== 'on') return;
  try {
    if (me === 'off') win.localStorage.setItem('umami.disabled', '1');
    else win.localStorage.removeItem('umami.disabled');
    say(me === 'off' ? '이 브라우저는 통계에서 빠졌어요' : '이 브라우저는 다시 통계에 들어가요');
  } catch {
    say('이 브라우저는 저장이 막혀 통계 설정을 바꾸지 못했어요');
  }
  url.searchParams.delete('me'); // 다시 열거나 공유돼도 반복되지 않게
  win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

type Umami = { track: (...args: unknown[]) => void };

/** attach: 스크립트를 문서에 붙이는 방법(테스트에서 가짜로 바꿈) */
export function createUmamiTracker(win: Window, opts: { siteId: string; attach?: (s: HTMLScriptElement) => void }): Tracker {
  let attached = false;
  type Item = { kind: 'page'; url: string } | { kind: 'event'; name: EventName; data?: EventData };
  let queue: Item[] = [];
  let state: 'off' | 'waiting' | 'ready' | 'failed' = opts.siteId ? 'waiting' : 'off';
  let referrer = '';

  const umami = () => (win as unknown as { umami?: Umami }).umami;
  function send(it: Item): void {
    const u = umami();
    if (!u) return;
    try {
      if (it.kind === 'page') {
        const ref = referrer;
        u.track((props: object) => ({ ...props, url: it.url, referrer: ref }));
        referrer = it.url;
      } else u.track(it.name, it.data ?? {});
    } catch {
      /* 통계가 앱을 멈추게 하지 않음 */
    }
  }
  function push(it: Item): void {
    if (state === 'ready') send(it);
    else if (state === 'waiting' && queue.length < QUEUE_MAX) queue.push(it);
  }

  return {
    load() {
      if (state !== 'waiting' || attached) return;
      attached = true;
      const s = win.document.createElement('script');
      s.src = SCRIPT_SRC;
      s.defer = true;
      s.setAttribute('data-website-id', opts.siteId);
      s.setAttribute('data-domains', DOMAINS);
      s.setAttribute('data-auto-track', 'false');
      s.addEventListener('load', () => {
        state = umami() ? 'ready' : 'failed';
        const q = queue;
        queue = [];
        if (state === 'ready') q.forEach(send);
      });
      s.addEventListener('error', () => {
        state = 'failed';
        queue = [];
      });
      (opts.attach ?? ((x) => win.document.head.append(x)))(s);
    },
    pageview(url) {
      push({ kind: 'page', url });
    },
    track(name, data) {
      push({ kind: 'event', name, data });
    },
  };
}
