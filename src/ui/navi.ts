/**
 * 길찾기 버튼(F2-AC5·AC7, 10/4 결정)
 * - 기본은 티맵: 누르면 티맵이 주차장·입구 좌표로 바로 열립니다. 버튼 글자 '길찾기(티맵)'
 * - 작게 '다른 앱으로 길찾기' → 네이버지도·카카오맵을 고르면 이 휴대폰에 기억하고 다음부터 그 앱으로
 * - 앱이 열리지 않으면(1.5초 뒤에도 화면이 그대로) '티맵 설치 / 네이버지도 / 카카오맵' 안내
 * - 컴퓨터는 카카오맵 웹(티맵·네이버지도 앱 주소는 컴퓨터에서 열리지 않음)
 * 티맵은 실제 휴대폰 확인이 알파 전 필수입니다(src/domain/navi.ts의 verified).
 */
import { naviUrl, type NaviAppId, type NaviDest } from '../domain/navi';
import type { SafeStore } from '../storage/safeStorage';
import { h } from './dom';
import type { EventData, EventName } from '../analytics';

export const NAVI_LABEL: Record<NaviAppId, string> = { tmap: '티맵', naver: '네이버지도', kakao: '카카오맵' };
const STORE: Record<Exclude<NaviAppId, 'kakao'>, { android: string; ios: string }> = {
  tmap: { android: 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku', ios: 'https://apps.apple.com/kr/app/id431589174' },
  naver: { android: 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap', ios: 'https://apps.apple.com/kr/app/id311867728' },
};
const KEY = 'navi';
const WAIT_MS = 1500; // 이 시간 안에 화면이 가려지지 않으면 앱이 없다고 봄

export const isMobileUA = (ua: string) => /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
const isIOS = (ua: string) => /iPhone|iPad|iPod/i.test(ua);

export interface NaviDeps {
  win: Window;
  ua: string;
  openUrl(url: string): void;
  store: SafeStore;
  /** 사용 통계: navi(가장 중요한 지표)·navi-no-app */
  track(name: EventName, data?: EventData): void;
}

export interface Navi {
  /** 장면 상세 아래 막대의 길찾기 버튼과 작은 '다른 앱으로 길찾기' */
  controls(dest: NaviDest, sceneId: string): { go: HTMLElement; other: HTMLElement | null };
  /** 화면에 한 번 붙여 두는 고르기 안내 */
  sheet: HTMLElement;
}

export function createNavi(d: NaviDeps): Navi {
  const { win, ua } = d;
  const mobile = isMobileUA(ua);
  const appname = win.location.origin || 'imamttae';
  const pref = (): NaviAppId => {
    const v = d.store.get<string>(KEY, 'tmap');
    return v === 'naver' || v === 'kakao' || v === 'tmap' ? v : 'tmap';
  };
  const url = (app: NaviAppId, dest: NaviDest) => naviUrl(app, dest, { appname });

  // ── 고르기 안내(아래에서 올라오는 작은 판) ──
  const sheetTitle = h('p', { class: 'navi-ttl' });
  const sheetBtns = h('div', { class: 'navi-btns' });
  const sheet = h('div', { class: 'navi-sheet', role: 'dialog', 'aria-label': '길찾기 앱 고르기' }, sheetTitle, sheetBtns);
  sheet.hidden = true;
  const closeSheet = () => (sheet.hidden = true);
  function openSheet(title: string, items: HTMLElement[]): void {
    sheetTitle.textContent = title;
    const close = h('button', { type: 'button', class: 'navi-close', text: '닫기' });
    close.addEventListener('click', closeSheet);
    sheetBtns.replaceChildren(...items, close);
    sheet.hidden = false;
  }

  /** 앱 주소를 열고, 앱이 안 열리면(화면이 그대로면) 다른 길을 안내 */
  let scene = '';
  function launch(app: NaviAppId, dest: NaviDest, how: 'main' | 'other'): void {
    d.track('navi', { app, how, scene, where: 'detail' });
    d.openUrl(url(app, dest));
    if (app === 'kakao') return; // 카카오맵은 웹 주소라 앱이 없어도 열림
    let left = false;
    const onHide = () => {
      if (win.document.visibilityState === 'hidden') left = true;
    };
    win.document.addEventListener('visibilitychange', onHide);
    win.setTimeout(() => {
      win.document.removeEventListener('visibilitychange', onHide);
      if (left || win.document.visibilityState === 'hidden') return;
      const install = h('a', { class: 'navi-opt', href: STORE[app][isIOS(ua) ? 'ios' : 'android'], target: '_blank', rel: 'noopener', text: `${NAVI_LABEL[app]} 설치` });
      install.addEventListener('click', () => d.track('navi-no-app', { app }));
      openSheet(`${NAVI_LABEL[app]} 앱이 열리지 않았어요`, [install, ...others(app, dest, false)]);
    }, WAIT_MS);
  }

  /** app을 뺀 다른 길찾기 앱 버튼. remember면 고른 앱을 기억 */
  function others(app: NaviAppId, dest: NaviDest, remember: boolean): HTMLElement[] {
    return (['tmap', 'naver', 'kakao'] as const)
      .filter((a) => a !== app && (remember || a !== 'tmap'))
      .map((a) => {
        const b = h('button', { type: 'button', class: 'navi-opt', text: NAVI_LABEL[a] });
        b.addEventListener('click', () => {
          closeSheet();
          if (remember) {
            d.store.set(KEY, a);
            paint();
          }
          launch(a, dest, 'other');
        });
        return b;
      });
  }

  let paint = () => {};
  function controls(dest: NaviDest, sceneId: string): { go: HTMLElement; other: HTMLElement | null } {
    scene = sceneId;
    const go = h('button', { type: 'button', class: 'go' });
    paint = () => {
      go.textContent = `길찾기(${NAVI_LABEL[mobile ? pref() : 'kakao']})`;
    };
    paint();
    go.addEventListener('click', () => {
      if (mobile) return launch(pref(), dest, 'main');
      d.track('navi', { app: 'kakao', how: 'main', scene, where: 'detail' });
      d.openUrl(url('kakao', dest));
    });
    if (!mobile) return { go, other: null };
    const other = h('button', { type: 'button', class: 'navi-other', text: '다른 앱으로 길찾기' });
    other.addEventListener('click', () => openSheet('어느 앱으로 길을 찾을까요?', others(pref(), dest, true)));
    return { go, other };
  }

  return { controls, sheet };
}
