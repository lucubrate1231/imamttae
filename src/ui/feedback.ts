/**
 * 의견 보내기(D46 — D32를 바꿈, design-guide 12-1·10-8)
 * - 카드: 첫 화면 '이 앱 이야기' 아래 · 저장한 곳 맨 아래 설치 카드 아래. 흰 바탕 + 테두리, 계절 색 말풍선
 * - 줄: 장면 상세 본문 끝 '이곳 정보가 달라졌나요?' — 폼의 '어느 곳' 칸에 장면 이름을 미리 넣음(구글 폼 미리 채운 링크)
 * - 누르면 구글 폼이 새 창. 폼 주소는 src/config.ts 한 곳. 비어 있으면 감춤(기획 10/6 — 주소를 받기 전)
 * - 통계 feedback: where(home·saved·detail), 장면 상세는 scene도
 */
import type { EventData, EventName } from '../analytics';
import { h } from './dom';

export interface FeedbackDeps {
  /** 폼 주소 — 카드용(비어 있으면 아직 없음) */
  url: string;
  /** 미리 채운 링크의 바탕 주소(…/viewform) — 장면 상세에서 장면 이름을 넣을 때. 비면 url */
  prefillUrl: string;
  /** '어느 곳' 칸 번호(entry.…) — 비어 있으면 미리 넣지 않음 */
  placeField: string;
  toast(msg: string): void;
  track(name: EventName, data?: EventData): void;
}

const BUBBLE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4.5 3.5V17H5a2 2 0 01-2-2V7a2 2 0 012-2z"/><path d="M8 10h8M8 13h5"/></svg>`;

/** 장면 이름을 미리 넣은 폼 주소(칸 번호를 모르면 폼만) */
export function feedbackHref(url: string, placeField: string, place?: string): string {
  if (!url) return '#';
  if (!place || !placeField) return url;
  const u = new URL(url);
  u.searchParams.set('usp', 'pp_url');
  u.searchParams.set(placeField, place);
  return u.toString();
}

function wire(a: HTMLAnchorElement, d: FeedbackDeps, data: EventData): void {
  a.hidden = !d.url; // 폼 주소가 없으면 감춤
  a.target = '_blank';
  a.rel = 'noopener';
  a.addEventListener('click', () => d.track('feedback', data));
}

function bubble(cls: string): HTMLElement {
  const s = h('span', { class: cls, 'aria-hidden': 'true' });
  s.innerHTML = BUBBLE;
  return s;
}

/** 카드(첫 화면·저장한 곳) */
export function feedbackCard(d: FeedbackDeps, where: 'home' | 'saved'): HTMLAnchorElement {
  const a = h(
    'a',
    { class: 'feedback', href: feedbackHref(d.url, d.placeField), 'aria-label': '의견 보내기, 새 창' },
    bubble('fb-ic'),
    h('span', {}, h('b', { text: '의견 보내기' }), h('span', { class: 'fb-sub', text: '불편한 점, 틀린 정보, 바라는 점 무엇이든 좋아요.' })),
  );
  wire(a, d, { where });
  return a;
}

/** 줄(장면 상세 본문 끝) */
export function feedbackLine(d: FeedbackDeps, scene: { id: string; name: string }): HTMLAnchorElement {
  const a = h(
    'a',
    { class: 'fb-line', href: d.prefillUrl && d.placeField ? feedbackHref(d.prefillUrl, d.placeField, scene.name) : feedbackHref(d.url, '', scene.name), 'aria-label': '이곳 정보가 달라졌나요? 알려 주기, 새 창' },
    bubble('fb-ic sm'),
    h('span', { class: 'fb-txt' }, h('b', { text: '이곳 정보가 달라졌나요?' }), h('span', { class: 'fb-sub', text: '주차·길·입장 등 알려 주시면 고칠게요' })),
    h('span', { class: 'fb-go', 'aria-hidden': 'true', text: '›' }),
  );
  wire(a, d, { where: 'detail', scene: scene.id });
  return a;
}
