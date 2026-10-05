/** 화면 조각을 만드는 작은 도우미와 아이콘(확정 시안 v2와 같은 모양) */
import type { StoryScene } from '../../shared/schema/content';

type Kid = Node | string | null | undefined | false;

/** h('div', { class: 'a', text: '글' }, 자식...) — class·text 말고는 속성으로 붙임 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el;
}

/** 그림(아이콘): 화면 읽기 프로그램에는 들리지 않게 */
function svgIcon(cls: string, svg: string): HTMLElement {
  const i = h('span', { class: cls, 'aria-hidden': 'true' });
  i.innerHTML = svg;
  return i;
}
/** 달력 아이콘(카드의 추천 시기 앞) */
export const calIcon = () =>
  svgIcon(
    'cal',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  );
/** 참고 아이콘(동그라미 안 i) — '해마다 달라져요' 같은 참고사항 앞 */
export const infoIcon = () =>
  svgIcon(
    'info',
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/></svg>',
  );
type Photo = StoryScene['photos'][number];

/** 브런치(카카오) 사진의 작은 썸네일 주소 */
export const thumb = (src: string, size = 240) => `https://img1.daumcdn.net/thumb/C${size}x${size}/?fname=${encodeURIComponent(src)}`;

/**
 * 화면 폭에 맞춘 사진 주소(카카오 썸네일, 비율 그대로, 화질 q). 브런치 원본은 1MB 안팎이라 휴대폰 인터넷에서 느림(#83).
 * 카드 720(약 100KB), 상세 1080. 브런치 사진이 아니면 그대로.
 */
export const sized = (src: string, width: number, q = 70) =>
  /^https:\/\/t1\.(kakaocdn|daumcdn)\.net\/brunch\//.test(src) ? `https://img1.daumcdn.net/thumb/R${width}x0.q${q}/?fname=${encodeURIComponent(src)}` : src;

/** 사진: 초점(focus)과 수평 보정(rotate)을 반영. eager = 맨 처음 보이는 사진(먼저 받음) */
export function photoImg(p: Photo, alt: string, opts: { src?: string; eager?: boolean } = {}): HTMLImageElement {
  const i = h('img', { src: opts.src ?? p.src, alt, loading: opts.eager ? 'eager' : 'lazy', decoding: 'async' });
  if (opts.eager) i.setAttribute('fetchpriority', 'high');
  if (p.focus) i.style.objectPosition = p.focus;
  if (p.rotate) {
    const r = (Math.abs(p.rotate) * Math.PI) / 180;
    i.style.transform = `rotate(${p.rotate}deg) scale(${(Math.cos(r) + 1.5 * Math.sin(r)).toFixed(3)})`;
  }
  return i;
}

/** '2023-10-26' → '2023년 10월 26일', '2023-10' → '2023년 10월' */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return d ? `${y}년 ${m}월 ${d}일` : `${y}년 ${m}월`;
}

/**
 * 브라우저 주소창·상태 막대 뒤 색을 그 화면 머리의 계절 색(--season-soft)으로.
 * - 안드로이드 크롬·옛 사파리: <meta name="theme-color">
 * - iOS 26 사파리: theme-color를 쓰지 않고 **body 배경색**(없으면 html)을 씀. 맨 위에 붙은 고정 요소가 있으면 그 색을 먼저 씀(10/5 사용자 아이폰 확인).
 *   본문은 #app의 흰 바탕이라 그대로. 닫힌 장면 상세는 투명도 0이라 사파리가 보지 않음(app.css .detail)
 */
export function paintBrowserBar(win: Window, root: HTMLElement | null): void {
  const soft = (root ? getComputedStyle(root).getPropertyValue('--season-soft').trim() : '') || '#ffffff';
  win.document.querySelector('meta[name=theme-color]')?.setAttribute('content', soft);
  win.document.documentElement.style.backgroundColor = soft;
  win.document.body.style.backgroundColor = soft;
}
