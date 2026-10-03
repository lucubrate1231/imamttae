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
/** 휴대폰에 + 표시(홈 화면에 두기) */
export const phoneIcon = () =>
  svgIcon(
    'ic',
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 9v6M9 12h6"/></svg>',
  );

type Photo = StoryScene['photos'][number];

/** 브런치(카카오) 사진의 작은 썸네일 주소 */
export const thumb = (src: string, size = 240) => `https://img1.daumcdn.net/thumb/C${size}x${size}/?fname=${encodeURIComponent(src)}`;

/** 사진: 초점(focus)과 수평 보정(rotate)을 반영 */
export function photoImg(p: Photo, alt: string, opts: { src?: string; eager?: boolean } = {}): HTMLImageElement {
  const i = h('img', { src: opts.src ?? p.src, alt, loading: opts.eager ? 'eager' : 'lazy', decoding: 'async' });
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
