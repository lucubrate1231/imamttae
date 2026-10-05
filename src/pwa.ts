/**
 * 홈 화면에 추가(F5) 준비 — 서비스 워커 등록과 D33 '카카오톡 → 크롬' 주소 만들기
 * 화면(띠·설치 안내)은 디자인 세션의 F5 PR이 오면 만듭니다. 실기기 확인은 /_review/a2hs-lab.html
 */
const HOST = 'lucubrate1231.github.io';

/** 내 컴퓨터·화면 테스트에서는 등록하지 않음(저장해 둔 화면이 테스트를 흐리지 않게) */
export function shouldRegisterSw(hostname: string): boolean {
  return hostname === HOST;
}

/** F5-AC2: 작은 서비스 워커(./sw.js). 같은 빌드가 /imamttae/와 /imamttae/next/에서 각자 등록 */
export function registerServiceWorker(win: Window, url = './sw.js'): void {
  const nav = win.navigator;
  if (!shouldRegisterSw(win.location.hostname) || !('serviceWorker' in nav)) return;
  const go = () => void nav.serviceWorker.register(url).catch(() => {});
  if (win.document.readyState === 'complete') go();
  else win.addEventListener('load', go, { once: true });
}

/** 카카오톡 안에서 바깥 기본 브라우저로 열기(널리 쓰이지만 카카오 공식 문서는 없음 — 실기기 확인) */
export function kakaoExternalUrl(target: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
}

/**
 * 안드로이드 intent 주소: 크롬을 콕 집어 엶. 크롬이 없으면 browser_fallback_url(같은 주소)로.
 * '#' 뒤(화면 주소)는 intent 형식상 넘어가지 않음 → 화면은 주소 꼬리표로 넘겨야 함(실기기 확인 뒤 정함)
 */
export function chromeIntentUrl(target: string): string {
  const u = new URL(target);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`;
}

const CARRY = 'carry';
const ID = /^[a-z]-[a-z0-9-]{1,80}$/;
const CARRY_MAX = 100;

/** D33 ②: 저장한 장면 번호를 주소 꼬리표 carry에 붙임(장면 번호뿐) */
/** 장면이 없으면 carry를 지움(주소에 있던 것도) */
export function withCarry(url: string, ids: readonly string[]): string {
  const u = new URL(url);
  if (!ids.length) {
    if (!u.searchParams.has(CARRY)) return url;
    u.searchParams.delete(CARRY);
    return u.toString();
  }
  u.searchParams.set(CARRY, ids.join(','));
  return u.toString();
}

/** D33 ②: 받은 장면 번호. 번호 모양만, 겹치지 않게, 앞에서 100개까지 */
export function readCarry(search: string): string[] {
  const raw = new URLSearchParams(search).get(CARRY);
  if (!raw) return [];
  return [...new Set(raw.split(',').filter((x) => ID.test(x)))].slice(0, CARRY_MAX);
}

/** 크롬의 설치 창 신호(beforeinstallprompt) */
export type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

let captured: InstallEvent | null = null;
/** 앱보다 먼저 듣기 시작해야 신호를 놓치지 않음(main.ts 맨 앞에서 부름). 돌려주는 함수로 지금 신호를 꺼냄 */
export function captureInstallPrompt(win: Window): () => InstallEvent | null {
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 우리 버튼으로 띄움
    captured = e as InstallEvent;
  });
  win.addEventListener('appinstalled', () => (captured = null));
  return () => captured;
}

/** 어디서 열었나(design-guide 11-1). 홈 화면 아이콘으로 열면 standalone */
export type A2hsEnv = 'standalone' | 'kakao-android' | 'kakao-ios' | 'samsung' | 'ios-safari' | 'chrome';
export function a2hsEnv(ua: string, standalone: boolean): A2hsEnv {
  if (standalone) return 'standalone';
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (/KAKAOTALK/i.test(ua)) return ios ? 'kakao-ios' : 'kakao-android';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (ios) return 'ios-safari';
  return 'chrome'; // 안드로이드 크롬과 그 밖(PC 등)
}
