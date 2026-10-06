// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import type { EventData, Tracker } from '../../src/analytics';
import { createListMap } from '../../src/map/listMap';
import { HOME_SCENES } from '../fixtures/homeScenes';

/** 출시 준비 화면(D45·D46, 디자인 #107) — design-guide 12장, 글자 10-8 */
const OCT = new Date('2026-09-30T16:00:00Z');
const FORM = 'https://docs.google.com/forms/d/e/TESTFORM/viewform';
let root: HTMLElement;
let events: [string, EventData | undefined][];
const tracker: Tracker = { load() {}, pageview() {}, track: (n, d) => void events.push([n, d]) };
let toasts: string[];

async function start(hash: string, o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({ root, map: createListMap(), content: HOME_SCENES, now: OCT, tracker, feedbackUrl: FORM, feedbackPlaceField: 'entry.1234', contactEmail: 'hello@example.com', ...o });
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const hashChange = () => window.dispatchEvent(new Event('hashchange'));
const go = (hash: string) => {
  window.location.hash = hash;
  hashChange();
};

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  events = [];
  toasts = [];
  localStorage.clear();
});

describe('의견 보내기(D46, 12-1) — 세 자리', () => {
  it('첫 화면: "이 앱 이야기" 바로 아래 카드 — 새 창으로 폼, 읽기 "의견 보내기, 새 창", 그 아래 바닥줄 "개인정보 안내"', async () => {
    await start('#/month/10');
    const extra = q('main.home .extra')!;
    const card = extra.querySelector<HTMLAnchorElement>('a.feedback')!;
    expect(card.previousElementSibling!.matches('.story-link')).toBe(true);
    expect(card.getAttribute('href')).toBe(FORM);
    expect(card.getAttribute('target')).toBe('_blank');
    expect(card.getAttribute('aria-label')).toBe('의견 보내기, 새 창');
    expect(card.querySelector('b')!.textContent).toBe('의견 보내기');
    expect(card.querySelector('.fb-sub')!.textContent).toBe('불편한 점, 틀린 정보, 바라는 점 무엇이든 좋아요.');
    const foot = card.nextElementSibling as HTMLAnchorElement;
    expect(foot.matches('a.privacy-link')).toBe(true);
    expect(foot.textContent).toBe('개인정보 안내');
    expect(foot.getAttribute('href')).toBe('#/privacy');
    card.click();
    expect(events).toContainEqual(['feedback', { where: 'home' }]);
  });

  it('저장한 곳: 맨 아래 설치 카드 아래 같은 카드, "이 휴대폰에만 저장돼요" 상자 끝 "개인정보 안내 보기 ›"', async () => {
    await start('#/saved');
    const foot = q('.saved .sv-foot')!;
    const card = foot.querySelector<HTMLAnchorElement>('a.feedback')!;
    expect(card.previousElementSibling!.matches('.home-add')).toBe(true);
    card.click();
    expect(events).toContainEqual(['feedback', { where: 'saved' }]);
    const link = foot.querySelector<HTMLAnchorElement>('.sv-note a.privacy-more')!;
    expect(link.textContent).toBe('개인정보 안내 보기 ›');
    expect(link.getAttribute('href')).toBe('#/privacy');
  });

  it('장면 상세: 본문 끝 "다른 앱으로 길찾기" 아래 줄 "이곳 정보가 달라졌나요?" — 폼의 어느 곳 칸에 장면 이름을 미리 넣음', async () => {
    await start('#/scene/s-naejang', { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' });
    const line = q<HTMLAnchorElement>('.detail.open a.fb-line')!;
    expect(line.previousElementSibling!.matches('.navi-row')).toBe(true);
    expect(line.querySelector('b')!.textContent).toBe('이곳 정보가 달라졌나요?');
    expect(line.querySelector('.fb-sub')!.textContent).toBe('주차·길·입장 등 알려 주시면 고칠게요');
    expect(line.getAttribute('aria-label')).toBe('이곳 정보가 달라졌나요? 알려 주기, 새 창');
    const u = new URL(line.href);
    expect(u.origin + u.pathname).toBe(FORM);
    expect(u.searchParams.get('usp')).toBe('pp_url');
    expect(u.searchParams.get('entry.1234')).toBe('내장산 우화정');
    line.click();
    expect(events).toContainEqual(['feedback', { where: 'detail', scene: 's-naejang' }]);
  });

  it('칸 번호를 아직 모르면 장면 이름 없이 폼만', async () => {
    await start('#/scene/s-naejang', { feedbackPlaceField: '' });
    expect(q<HTMLAnchorElement>('.detail.open a.fb-line')!.getAttribute('href')).toBe(FORM);
  });

  it('폼 주소가 아직 없으면 눌러도 어디로도 가지 않고 "곧 열려요" 안내(출시 전 미리보기)', async () => {
    await start('#/month/10', { feedbackUrl: '' });
    const card = q<HTMLAnchorElement>('main.home a.feedback')!;
    expect(card.getAttribute('target')).toBeNull();
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(q('.toast')!.textContent).toBe('의견 보내기는 곧 열려요');
  });

  it('홈 화면 아이콘으로 열어도 보임(설치 카드와 달리 숨기지 않음)', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    await start('#/month/10');
    expect(q<HTMLElement>('main.home a.feedback')!.hidden).toBe(false);
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  });
});

describe('개인정보 안내(#/privacy, 12-2)', () => {
  it('바닥줄을 누르면 화면이 열림 — ‹ 뒤로 · 제목 · 소제목 다섯 · 문의 상자(이메일 글자 · 메일 쓰기) · 적용 날짜, 아래 메뉴는 어느 칸도 고르지 않음', async () => {
    await start('#/month/10');
    go('#/privacy');
    const p = q('.privacy')!;
    expect(p.hidden).toBe(false);
    expect(q<HTMLElement>('main.home')!.hidden).toBe(true);
    expect(p.querySelector('.pv-back')!.textContent).toBe('‹ 뒤로');
    expect(p.querySelector('.pv-back')!.getAttribute('aria-label')).toBe('뒤로');
    expect(p.querySelector('h1')!.textContent).toBe('개인정보 안내');
    expect([...p.querySelectorAll('h2.pv-h')].map((h) => h.textContent)).toEqual(['받지 않는 것', '이 휴대폰에만 두는 것', '방문 통계', '함께 쓰는 서비스', '저장한 것 지우는 법']);
    expect(p.querySelector('.pv-contact h2')!.textContent).toBe('문의');
    expect(p.querySelector('.pv-mail')!.textContent).toBe('hello@example.com');
    expect(p.querySelector<HTMLAnchorElement>('.pv-contact a.btn')!.getAttribute('href')).toBe('mailto:hello@example.com');
    expect(p.querySelector('.pv-date')).not.toBeNull();
    expect(root.querySelectorAll('.tabs [aria-current]')).toHaveLength(0);
  });

  it('‹ 뒤로: 앱 안에서 열었으면 전 화면으로, 주소로 바로 열었으면 첫 화면으로', async () => {
    await start('#/privacy');
    q<HTMLButtonElement>('.privacy .pv-back')!.click();
    expect(window.location.hash).toBe('#/');
  });
});
