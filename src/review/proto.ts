/**
 * 시안 프로토타입: A안(지도 중심) / B안(사진 + 지도). ?v=a | ?v=b
 * 실제 앱 코드가 아니라 확인용입니다. 안이 정해지면 테스트와 함께 src/ 로 옮겨 다시 만듭니다.
 */
import './review.css';
import data from './scenes.draft.json';
import { loadKakaoSdk } from '../map/kakaoSdk';
import { naviUrl } from '../domain/navi';

interface Photo { src: string; w: number; h: number; cap: string; focus: string }
interface Scene {
  id: string; brunchNo: number; brunchUrl: string; name: string; region: string; typeLabel: string;
  visited: string; best: string; oneLiner: string; excerpt: string; trip: string; photos: Photo[];
  spot: { lat: number; lng: number }; dest: { name: string; lat: number; lng: number };
}
const scenes = (data as { scenes: Scene[] }).scenes;
const variant: 'a' | 'b' = new URLSearchParams(location.search).get('v') === 'b' ? 'b' : 'a';
const THIS_MONTH = 10;

let month = THIS_MONTH;
let sel = 0;
const stamped = new Set<string>();

// ── 작은 도우미 ──
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids) if (k !== null) el.append(k);
  return el;
}
const thumb = (src: string, size = 240) => `https://img1.daumcdn.net/thumb/C${size}x${size}/?fname=${encodeURIComponent(src)}`;
function img(p: Photo, alt: string, cls = ''): HTMLImageElement {
  const i = h('img', { src: p.src, alt, loading: 'lazy', decoding: 'async', ...(cls ? { class: cls } : {}) });
  i.style.objectPosition = p.focus;
  return i;
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
let toastTimer = 0;
function toast(msg: string): void {
  const t = document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('on'), 1800);
}

// ── 화면 ──
const app = document.getElementById('app')!;
app.classList.add(variant === 'a' ? 'A' : 'B');

const months = h('nav', { class: 'months', 'aria-label': '달 고르기' });
for (let m = 1; m <= 12; m++) {
  const b = h('button', { class: 'mchip', type: 'button', 'aria-pressed': String(m === month), text: `${m}월` });
  b.addEventListener('click', () => {
    month = m;
    for (const c of months.querySelectorAll('.mchip')) c.setAttribute('aria-pressed', String(c === b));
    renderMonth();
  });
  months.append(b);
}

const mapbox = h('div', { class: 'mapbox' }, h('div', { class: 'kmap', id: 'kmap' }));
const rail = h('div', { class: 'rail', role: 'list', 'aria-label': '이달의 명장면' });
const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
const empty = h('div', { class: 'empty', role: 'status', hidden: '' });
const headline = h('div', { class: 'headline' }, h('h2', { text: '' }), h('span', { text: '' }));

const tabs = h('nav', { class: 'tabs', 'aria-label': '메뉴' });
for (const [i, t] of ['지금', '명장면 찾기', '수첩'].entries()) {
  const b = h('button', { type: 'button', text: t, ...(i === 0 ? { 'aria-current': 'page' } : {}) });
  if (i > 0) b.addEventListener('click', () => toast('시안에서는 첫 화면만 볼 수 있어요'));
  tabs.append(b);
}

const detail = h('section', { class: 'detail', 'aria-label': '장면 상세', 'aria-hidden': 'true' });

app.append(
  h('header', { class: 'top' }, h('h1', { class: 'brand', text: '이맘때 자연' }), h('p', { class: 'sub', text: '이상호 작가가 아내와 다녀온 자연 명장면' })),
  months,
);
if (variant === 'a') {
  app.append(headline, mapbox, rail, empty);
} else {
  app.append(rail, dots, empty, mapbox);
}
app.append(tabs, detail, h('div', { class: 'toast', role: 'status' }));

// ── 카드 ──
function card(s: Scene, i: number): HTMLElement {
  const p = s.photos[0]!;
  if (variant === 'a') {
    const b = h('button', { class: 'mini', type: 'button', role: 'listitem' },
      img(p, '', ''),
      h('span', {}, h('b', { text: s.name }), h('span', { class: 'meta', text: `${s.region} · ${s.best}` }), h('span', { class: 'more', text: '자세히 보기 ›' })),
    );
    b.addEventListener('click', () => openScene(s.id));
    b.dataset.i = String(i);
    return b;
  }
  const b = h('button', { class: 'big', type: 'button', role: 'listitem' },
    h('div', { class: 'photo' }, img(p, ''), h('span', { class: 'tag', text: s.typeLabel }),
      h('span', { class: 'cap' }, h('b', { text: s.name }), h('span', { text: s.region }))),
    h('div', { class: 'best' }, h('span', { text: '가장 좋은 때' }), h('strong', { text: s.best })),
  );
  b.setAttribute('aria-label', `${s.name}, ${s.region}, 가장 좋은 때 ${s.best}`);
  b.addEventListener('click', () => openScene(s.id));
  b.dataset.i = String(i);
  return b;
}

function visibleScenes(): Scene[] {
  return month === 10 ? scenes : [];
}

function renderMonth(): void {
  const list = visibleScenes();
  rail.replaceChildren(...list.map(card));
  dots.replaceChildren(...list.map((_, i) => h('i', { class: i === 0 ? 'on' : '' })));
  rail.hidden = list.length === 0;
  dots.hidden = list.length === 0;
  empty.hidden = list.length > 0;
  empty.replaceChildren(h('b', { text: `${month}월 명장면은 준비 중이에요` }), document.createTextNode('시안에는 10월만 채워 두었어요. 10월을 눌러 보세요.'));
  (headline.firstChild as HTMLElement).textContent = `${month}월, 지금 가면 좋은 곳`;
  (headline.lastChild as HTMLElement).textContent = list.length ? `${list.length}곳` : '';
  sel = 0;
  rail.scrollLeft = 0;
  drawPins(list);
}

// ── 지도 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type K = any;
let kakao: K = null;
let map: K = null;
let overlays: { o: K; el: HTMLElement }[] = [];

function drawPins(list: Scene[]): void {
  for (const { o } of overlays) o.setMap(null);
  overlays = [];
  if (!map) return;
  const bounds = new kakao.maps.LatLngBounds();
  list.forEach((s, i) => {
    const pos = new kakao.maps.LatLng(s.spot.lat, s.spot.lng);
    bounds.extend(pos);
    let el: HTMLElement;
    if (variant === 'a') {
      el = h('div', { class: 'pin', role: 'button', 'aria-label': s.name },
        h('div', { class: 'ph' }, h('img', { class: 'pinimg', src: thumb(s.photos[0]!.src), alt: '' })), h('div', { class: 'nm', text: s.name }));
    } else {
      el = h('div', { class: 'dotwrap', role: 'button', 'aria-label': s.name }, h('div', { class: 'nm', text: s.name }), h('div', { class: 'dot' }));
    }
    el.addEventListener('click', () => select(i, true));
    const o = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, clickable: true, zIndex: 1 });
    o.setMap(map);
    overlays.push({ o, el });
  });
  if (list.length) map.setBounds(bounds, 70, 40, 40, 40);
  highlight();
}

function highlight(): void {
  overlays.forEach(({ o, el }, i) => {
    el.classList.toggle('on', i === sel);
    o.setZIndex(i === sel ? 10 : 1);
  });
  dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === sel));
  const s = visibleScenes()[sel];
  if (variant === 'b' && map && s) {
    map.setLevel(10);
    map.panTo(new kakao.maps.LatLng(s.spot.lat, s.spot.lng));
  }
}

function select(i: number, scrollRail: boolean): void {
  sel = i;
  highlight();
  if (scrollRail) {
    const c = rail.children[i] as HTMLElement | undefined;
    if (c) rail.scrollTo({ left: c.offsetLeft - 16, behavior: 'smooth' });
  }
}

let scrollTimer = 0;
rail.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    const first = rail.children[0] as HTMLElement | undefined;
    if (!first) return;
    const step = first.offsetWidth + 12;
    const i = Math.max(0, Math.min(rail.children.length - 1, Math.round(rail.scrollLeft / step)));
    if (i !== sel) select(i, false);
  }, 90);
});

// ── 장면 상세 ──
function openScene(id: string): void {
  if (location.hash !== `#scene=${id}`) location.hash = `scene=${id}`;
  else renderDetail();
}

function renderDetail(): void {
  const id = location.hash.startsWith('#scene=') ? location.hash.slice(7) : '';
  const s = scenes.find((x) => x.id === id);
  if (!s) {
    detail.classList.remove('open');
    detail.setAttribute('aria-hidden', 'true');
    return;
  }
  const slides = h('div', { class: 'rail' }, ...s.photos.map((p, i) => h('div', { class: 'slide' }, img(p, i === 0 ? `${s.name} 풍경` : ''))));
  const count = h('span', { class: 'count', text: `1 / ${s.photos.length}` });
  slides.addEventListener('scroll', () => {
    const i = Math.round(slides.scrollLeft / slides.clientWidth);
    count.textContent = `${i + 1} / ${s.photos.length}`;
  });
  const back = h('button', { class: 'round back', type: 'button', 'aria-label': '뒤로' });
  back.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  back.addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '')));
  const share = h('button', { class: 'round share', type: 'button', 'aria-label': '공유' });
  share.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>';
  share.addEventListener('click', async () => {
    const data = { title: `${s.name} · 이맘때 자연`, text: s.oneLiner, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('주소를 복사했어요'); }
    } catch { /* 사용자가 취소 */ }
  });

  const stamp = h('button', { class: 'stamp', type: 'button', 'aria-pressed': String(stamped.has(s.id)), text: stamped.has(s.id) ? '✓ 봤어요' : '봤어요' });
  stamp.addEventListener('click', () => {
    if (stamped.has(s.id)) stamped.delete(s.id); else stamped.add(s.id);
    stamp.setAttribute('aria-pressed', String(stamped.has(s.id)));
    stamp.textContent = stamped.has(s.id) ? '✓ 봤어요' : '봤어요';
    toast(stamped.has(s.id) ? `수첩에 '${s.typeLabel}' 도장을 찍었어요` : '도장을 지웠어요');
  });

  const draft = () => h('span', { class: 'draft', text: '초안' });
  detail.replaceChildren(
    h('div', { class: 'gallery' }, slides, back, share, h('span', { class: 'credit', text: '사진 이상호' }), count),
    h('div', { class: 'body' },
      h('div', { class: 'row' }, h('span', { class: 'chip', text: s.typeLabel }), stamp),
      h('h2', { class: 'title', text: s.name }),
      h('p', { class: 'region', text: s.region }),
      h('p', { class: 'one' }, s.oneLiner, draft()),
      h('dl', { class: 'facts' },
        h('div', {}, h('dt', { text: '가장 좋은 때' }), h('dd', {}, s.best, draft())),
        h('div', {}, h('dt', { text: '다녀온 날' }), h('dd', { text: fmtDate(s.visited) })),
        h('div', {}, h('dt', { text: '가는 곳' }), h('dd', {}, s.dest.name, draft())),
      ),
      h('blockquote', { class: 'quote' }, h('p', { text: s.excerpt }), h('cite', { text: `— 이상호, ${s.trip}` })),
      h('div', { class: 'actions' },
        h('a', { class: 'btn primary', href: naviUrl('kakao', s.dest), target: '_blank', rel: 'noopener', text: '길찾기 (카카오맵)' }),
        h('a', { class: 'btn line', href: s.brunchUrl, target: '_blank', rel: 'noopener', text: '브런치에서 전체 이야기 읽기' }),
      ),
    ),
  );
  detail.scrollTop = 0;
  detail.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => detail.classList.add('open'));
}
window.addEventListener('hashchange', renderDetail);

// ── 시작 ──
renderMonth();
(months.children[THIS_MONTH - 1] as HTMLElement).scrollIntoView({ inline: 'center', block: 'nearest' });
renderDetail();
loadKakaoSdk(import.meta.env.VITE_KAKAO_JS_KEY ?? '')
  .then((k) => {
    kakao = k;
    map = new kakao.maps.Map(document.getElementById('kmap'), { center: new kakao.maps.LatLng(36.4, 127.9), level: 13 });
    drawPins(visibleScenes());
    new ResizeObserver(() => map.relayout()).observe(mapbox);
  })
  .catch(() => {
    mapbox.append(h('p', { class: 'empty', text: '지도를 불러오지 못했어요.' }));
  });
