/**
 * 시안 v2 — 실제 장면 초안 55곳으로 만든 첫 화면.
 * - 한 페이지를 위아래로 스크롤합니다(위아래가 짧던 느낌 해결).
 * - 제철 장면은 큰 사진과 계절 색으로 강조, 작가 부부가 다녀온 곳(제철 아님)은 작은 사진·회색으로 톤을 낮춥니다.
 * - 작은 지도는 손으로 움직이지 않습니다(페이지 스크롤과 다투지 않게). 전국 → 장면 확대 움직임은 그대로.
 * 실제 앱 코드가 아니라 확인용입니다. 정해지면 테스트와 함께 src/ 로 옮겨 다시 만듭니다.
 */
import './v2.css';
import type { ContentFile, StoryScene } from '../../shared/schema/content';
import { loadKakaoSdk } from '../map/kakaoSdk';
import { naviUrl } from '../domain/navi';
import { inWindow, monthInSeoul, type Month } from '../domain/month';
import { sceneTier, splitByMonth, visitedMonth } from '../domain/sceneTier';
import { SCENE_TYPES } from '../domain/sceneTypes';
import { newsLink, timingNotice, type TimingNotice } from '../domain/timingNotice';
import { kenBurnsPlan } from '../domain/kenBurns';
import { isYearRound } from '../domain/sceneTier';

type Scene = StoryScene;
type Photo = Scene['photos'][number];
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const seasonOf = (m: Month): Season => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
const typeLabel = (s: Scene) => SCENE_TYPES.find((t) => t.id === s.types[0])?.label ?? '';
const AUTHOR = '이상호';
const RECOMMENDER = '이상호 작가'; // 맨 위 작은 글씨(10/3: '현곡 선생' → '이상호 대장' → '이상호 작가')
const STORY_URL = 'https://brunch.co.kr/@caed5ea4c3d74d9/1';

const qMonth = Number(new URLSearchParams(location.search).get('m'));
/** 사진 움직임 비교안(10/3 사용자 요청): 주소에 ?motion=1 을 붙였을 때만 장면 상세 사진이 천천히 움직임 */
const MOTION = new URLSearchParams(location.search).get('motion') === '1';
if (MOTION) document.documentElement.dataset.motion = 'on';
let month: Month = qMonth >= 1 && qMonth <= 12 ? qMonth : monthInSeoul();
let scenes: Scene[] = [];
let peak: Scene[] = [];
let record: Scene[] = [];
let sel = 0;
let revealOverlay: (() => void) | null = null; // 장면 상세의 사진 위 버튼을 보이게 하는 함수(열려 있는 장면 것)
let ignoreScrollUntil = 0; // 이 시각 전의 상세 스크롤은 사람 손이 아님(상세를 열며 맨 위로 되돌린 것)
const wanted = new Set<string>(); // 가고 싶어요(시안에서는 화면을 닫으면 사라짐. 실제 앱은 휴대폰에 저장)

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
function img(p: Photo, alt: string, src = p.src): HTMLImageElement {
  const i = h('img', { src, alt, loading: 'lazy', decoding: 'async' });
  if (p.focus) i.style.objectPosition = p.focus;
  if (p.rotate) {
    const r = (Math.abs(p.rotate) * Math.PI) / 180;
    i.style.transform = `rotate(${p.rotate}deg) scale(${(Math.cos(r) + 1.5 * Math.sin(r)).toFixed(3)})`;
  }
  return i;
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return d ? `${y}년 ${m}월 ${d}일` : `${y}년 ${m}월`;
}
/** 이번 달부터 가장 좋은 때가 몇 달 남았나(적을수록 '지금 아니면 못 보는 곳') */
function monthsLeft(s: Scene, m: Month): number {
  let k = 0;
  while (k < 12 && inWindow(((m - 1 + k) % 12) + 1, s.best!)) k++;
  return k;
}
let toastTimer = 0;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 1800);
}

// ── 뼈대 ──
const app = document.getElementById('app')!;
// 머리(10/3 2차 코멘트): 작은 글씨 '이상호 작가의 추천' → 큰 글씨 'N월에 만나는 자연' → 달 띠.
// 아래로 스크롤하면 'N월에 만나는 자연'만 위에 붙어 있음
const eyebrow = h('p', { class: 'eyebrow', text: `${RECOMMENDER}의 추천` });
const pageTitle = h('h1', { class: 'ttl' });
// 스크롤해서 큰 제목이 화면 밖으로 나가면, 작고 가는 제목 막대가 위에 서서히 나타남(큰 제목을 그대로 붙이면 투박해서)
const miniTitle = h('div', { class: 'mini-ttl', 'aria-hidden': 'true' });
const months = h('nav', { class: 'months', 'aria-label': '달 고르기' });
for (let m = 1; m <= 12; m++) {
  const b = h('button', { class: 'mchip', type: 'button', 'aria-pressed': String(m === month), text: `${m}월` });
  b.addEventListener('click', () => {
    month = m;
    for (const c of months.querySelectorAll('.mchip')) c.setAttribute('aria-pressed', String(c === b));
    render();
    window.scrollTo({ top: 0 });
  });
  months.append(b);
}

const rail = h('div', { class: 'rail', role: 'list', 'aria-label': '제철 풍경' });
const peakSec = h('section', { class: 'peak', 'aria-label': '제철 풍경' }, rail);

const mapbox = h('div', { class: 'mapbox' }, h('div', { class: 'kmap', id: 'kmap' }));
// 범례: '제철'만 쓰면 무엇의 제철인지 헷갈려서 '제철 풍경'(10/3 5차 코멘트)
const legend = h('div', { class: 'legend', 'aria-hidden': 'true' }, h('span', { text: '제철 풍경' }), h('span', { class: 'r', text: '작가 부부 방문' }));
const mapSec = h('section', { class: 'mapsec', 'aria-label': '지도' }, mapbox, legend);

const recTitle = h('h2', {});
const recList = h('ul', { class: 'reclist' });
const recSec = h(
  'section',
  { class: 'records' },
  recTitle,
  h('p', { class: 'sub', text: '제철은 아니지만 이맘때 모습을 볼 수 있어요.' }),
  recList,
);

const homeAdd = h(
  'button',
  { class: 'home-add', type: 'button' },
  h('span', { class: 'ic', 'aria-hidden': 'true' }),
  h('span', {}, h('b', { text: '홈 화면에 두기' }), h('span', { text: '앱처럼 바로 열려요. 설치는 필요 없어요.' })),
);
(homeAdd.firstChild as HTMLElement).innerHTML =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 9v6M9 12h6"/></svg>';
homeAdd.addEventListener('click', () => toast('시안에서는 안내 화면 자리만 보여요'));
const storyLink = h(
  'a',
  { class: 'story-link', href: STORY_URL, target: '_blank', rel: 'noopener' },
  h('span', { class: 'story-txt' }, h('small', { text: '이 앱 이야기' }), h('b', { text: '60대 부부의 100곳 여행 약속' })),
  h('span', { 'aria-hidden': 'true', text: '›' }),
);
/** 달력 아이콘(추천 시기 앞, 눈에 잘 띄게) */
const CAL_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const calIcon = () => {
  const i = h('span', { class: 'cal', 'aria-hidden': 'true' });
  i.innerHTML = CAL_SVG;
  return i;
};
/** 올해 소식 찾아보기: 꽃·단풍은 '누른 해 + ○○지도', 눈·억새는 '장소 + 키워드'(10/3 6차 코멘트). 해는 누르는 순간 기준 */
function newsAnchor(name: string, tn: TimingNotice): HTMLElement {
  const first = newsLink(name, tn);
  const a = h('a', { class: 'when-link', href: first.url, target: '_blank', rel: 'noopener', text: first.label });
  a.addEventListener('click', () => {
    a.setAttribute('href', newsLink(name, tn, new Date()).url);
  });
  return a;
}
/** 참고 아이콘(동그라미 안 i) — '해마다 달라져요', '눈이 와야 볼 수 있어요' 같은 참고사항 앞(10/3 4차 코멘트) */
const INFO_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/></svg>';
const infoIcon = () => {
  const i = h('span', { class: 'info', 'aria-hidden': 'true' });
  i.innerHTML = INFO_SVG;
  return i;
};
const extra = h('section', { class: 'extra' }, homeAdd, storyLink);

const tabs = h('nav', { class: 'tabs', 'aria-label': '메뉴' });
for (const [i, t] of ['지금', '풍경 찾기', '내 수첩'].entries()) {
  const b = h('button', { type: 'button', text: t, ...(i === 0 ? { 'aria-current': 'page' } : {}) });
  if (i > 0) b.addEventListener('click', () => toast('시안에서는 첫 화면만 볼 수 있어요'));
  tabs.append(b);
}
const detail = h('section', { class: 'detail', 'aria-label': '장면 상세', 'aria-hidden': 'true' });
const toastEl = h('div', { class: 'toast', role: 'status' });
app.append(miniTitle, h('main', {}, eyebrow, pageTitle, months, peakSec, mapSec, recSec, extra), tabs, detail, toastEl);
new IntersectionObserver(([e]) => miniTitle.classList.toggle('on', !e!.isIntersecting && e!.boundingClientRect.top < 0)).observe(pageTitle);


// ── 카드 ──
// 장면 상세 꼬리표: 제철이면 '제철' + 풍경 종류. 작가 부부가 다녀온 곳(제철 아님)은 풍경 종류만 —
// '작가 부부 방문' 꼬리표는 뜻이 잘 안 와닿아 빼고, 아래 "사진은 작가 부부가 N월에 다녀온 모습이에요"로 충분(10/3 6차 코멘트)
function badges(s: Scene): HTMLElement {
  const peakB = sceneTier(s) === 'peak';
  return h('span', { class: 'badges' }, peakB ? h('span', { class: 'badge peak-b', text: '제철' }) : null, h('span', { class: 'badge', text: typeLabel(s) }));
}
/** 제철 카드는 모두 제철이라 '제철' 딱지는 빼고(10/3 코멘트), 종류만 반투명으로 약하게 */
function bigCard(s: Scene, i: number): HTMLElement {
  const tn = timingNotice(s.types);
  const b = h(
    'button',
    { class: 'big', type: 'button' },
    h(
      'div',
      { class: 'photo' },
      img(s.photos[0]!, ''),
      h('span', { class: 'badges' }, h('span', { class: 'badge on-photo', text: typeLabel(s) })),
      h('span', { class: 'cap' }, h('b', { text: s.name }), h('span', { text: s.region })),
    ),
    // 계절말은 빼고 '추천 시기' + 날짜만, 그 아래 종류별 짧은 안내(10/3 2차 코멘트)
    h('div', { class: 'best' }, calIcon(), h('span', { class: 'lbl', text: '추천 시기' }), h('strong', { text: s.best?.note ?? '' })),
    tn ? h('div', { class: 'vary' }, infoIcon(), h('span', { text: tn.short })) : null,
  );
  b.setAttribute('aria-label', `${s.name}, ${s.region}, 추천 시기 ${s.best?.note ?? ''}${tn ? `, ${tn.short}` : ''}`);
  b.addEventListener('click', () => openScene(s.id));
  return h('div', { role: 'listitem', 'data-i': String(i) }, b);
}
function recRow(s: Scene): HTMLElement {
  const b = h(
    'button',
    { class: 'rec', type: 'button' },
    img(s.photos[0]!, '', thumb(s.photos[0]!.src)),
    h('span', {}, h('b', { text: s.name }), h('span', { class: 'meta', text: s.region }), h('span', { class: 'badge rec-b', text: typeLabel(s) })),
  );
  b.addEventListener('click', () => openScene(s.id));
  return h('li', {}, b);
}

function render(): void {
  const season = seasonOf(month);
  app.dataset.season = season;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(app).getPropertyValue('--season-soft').trim() || '#ffffff');
  const r = splitByMonth(scenes, month);
  // 순서: ① 사진이 바로 이달에 찍힌 곳(지금 가면 사진 그대로) ② 사진 찍은 달이 가까운 곳 ③ 가장 좋은 때가 곧 끝나는 곳
  const gap = (s: Scene) => {
    const d = Math.abs(visitedMonth(s.visited) - month);
    return Math.min(d, 12 - d);
  };
  peak = [...r.peak].sort((a, b) => gap(a) - gap(b) || monthsLeft(a, month) - monthsLeft(b, month) || b.visited.localeCompare(a.visited));
  record = r.record;

  pageTitle.textContent = `${month}월에 만나는 자연`;
  miniTitle.textContent = pageTitle.textContent;
  rail.replaceChildren(...peak.map(bigCard));
  rail.scrollLeft = 0;
  peakSec.hidden = peak.length === 0;

  recTitle.textContent = `${month}월, 작가 부부가 다녀온 곳`;
  recList.replaceChildren(...record.map(recRow));
  recSec.hidden = record.length === 0;

  sel = 0;
  drawPins();
}

// ── 지도 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type K = any;
let kakao: K = null;
let map: K = null;
let pins: { s: Scene; o: K; el: HTMLElement }[] = [];
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let flyTimers: number[] = [];
let national: { level: number; center: K } | null = null;
let ready = false;

function drawPins(): void {
  for (const { o } of pins) o.setMap(null);
  pins = [];
  if (!map) return;
  const add = (s: Scene, isPeak: boolean, i: number) => {
    const el = h('div', { class: `pin ${isPeak ? 'p' : 'r'}` }, h('div', { class: 'nm', text: s.name }), h('div', { class: 'dot' }));
    el.addEventListener('click', () => (isPeak ? select(i, true) : openScene(s.id)));
    const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(s.spot.lat, s.spot.lng), content: el, yAnchor: 1, clickable: true, zIndex: isPeak ? 2 : 1 });
    o.setMap(map);
    pins.push({ s, o, el });
  };
  record.forEach((s, i) => add(s, false, i));
  peak.forEach((s, i) => add(s, true, i));
  highlight();
}
function highlight(): void {
  const cur = peak[sel];
  for (const { s, o, el } of pins) {
    const on = s === cur;
    el.classList.toggle('on', on);
    o.setZIndex(on ? 10 : el.classList.contains('p') ? 2 : 1);
  }
  if (map && cur) flyTo(cur);
}
/** 우리나라 전체 → (잠깐 머묾) → 장면으로 확대. 어디쯤인지 먼저 보여 줍니다. */
function flyTo(s: Scene): void {
  for (const t of flyTimers) clearTimeout(t);
  flyTimers = [];
  if (!ready || !national) return;
  const spot = new kakao.maps.LatLng(s.spot.lat, s.spot.lng);
  const CLOSE = 10;
  if (reduceMotion) {
    map.setLevel(CLOSE);
    map.setCenter(spot);
    return;
  }
  const { level, center } = national;
  if (map.getLevel() !== level) map.setLevel(level, { animate: { duration: 350 } });
  flyTimers.push(
    window.setTimeout(() => map.setCenter(center), 380),
    window.setTimeout(() => map.setLevel(CLOSE, { animate: { duration: 700 }, anchor: spot }), 1600),
    window.setTimeout(() => map.panTo(spot), 2350),
  );
}
function select(i: number, scrollRail: boolean): void {
  sel = i;
  highlight();
  if (scrollRail) {
    const c = rail.children[i] as HTMLElement | undefined;
    if (c) rail.scrollTo({ left: c.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
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
  const id = location.hash.startsWith('#scene=') ? decodeURIComponent(location.hash.slice(7)) : '';
  const s = scenes.find((x) => x.id === id);
  if (!s) {
    detail.classList.remove('open');
    detail.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    return;
  }
  const isPeak = sceneTier(s) === 'peak';
  const icon = (d: string, size = 22, fill = 'none') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  // ── 사진: 위에 얹는 것은 작고 검정 반투명하게(10/3 2차 코멘트). 뒤로 + 넘김 화살표 + 작은 크레딧만 ──
  const n = s.photos.length;
  // 사진 움직임(비교안): 사진을 틀(.kb)로 감싸 틀째 움직임. 옆으로 긴 사진은 좌우 밀기, 그 밖은 살짝 확대(src/domain/kenBurns.ts)
  const photoEl = (p: Photo, i: number): HTMLElement => {
    const pic = img(p, i === 0 ? `${s.name} 풍경` : '');
    if (!MOTION) return pic;
    const k = kenBurnsPlan(p);
    const box = h('div', { class: `kb ${k.mode}` }, pic);
    if (k.mode === 'pan') {
      box.style.setProperty('--ar', String(k.ar));
      box.style.setProperty('--kb-from', `${k.from}%`);
      box.style.setProperty('--kb-to', `${k.to}%`);
    } else box.style.setProperty('--kb-origin', k.origin);
    return box;
  };
  const slides = h('div', { class: 'rail', tabindex: '0', 'aria-label': `사진 ${n}장, 옆으로 넘겨 보세요` }, ...s.photos.map((p, i) => h('div', { class: 'slide' }, photoEl(p, i))));
  /** 지금 사진(i)만 처음부터 움직이고, 나머지는 멈춰 출발 자세로 */
  const playKb = (i: number): void => {
    if (!MOTION || reduceMotion) return;
    slides.querySelectorAll<HTMLElement>('.kb').forEach((el, k) => {
      el.classList.remove('kb-on');
      if (k === i) {
        void el.offsetWidth; // 움직임을 처음부터 다시 시작
        el.classList.add('kb-on');
      }
    });
  };
  const back = h('button', { class: 'ov back', type: 'button', 'aria-label': '뒤로' });
  back.innerHTML = icon('M15 18l-6-6 6-6', 22);
  back.addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '')));
  const prev = h('button', { class: 'ov nav prev', type: 'button', 'aria-label': '이전 사진' });
  prev.innerHTML = icon('M15 18l-6-6 6-6', 18);
  const next = h('button', { class: 'ov nav next', type: 'button', 'aria-label': '다음 사진' });
  next.innerHTML = icon('M9 18l6-6-6-6', 18);
  const gdots = h('div', { class: 'gdots', 'aria-hidden': 'true' }, ...s.photos.map((_, i) => h('i', { class: i === 0 ? 'on' : '' })));
  const cur = () => Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
  const go = (i: number) => slides.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * slides.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  const paintNav = () => {
    const i = cur();
    prev.hidden = i <= 0;
    next.hidden = i >= n - 1;
    gdots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
  };
  prev.addEventListener('click', () => go(cur() - 1));
  next.addEventListener('click', () => go(cur() + 1));
  slides.addEventListener('scroll', paintNav, { passive: true });
  paintNav();
  const credit = h('span', { class: 'credit' }, `사진·글 ${AUTHOR}`, h('span', { class: 'sign', title: '작가 손글씨 서명 자리', text: '서명' }));

  // ── 아래 붙박이 막대: 가고 싶어요 · 공유 · 길찾기 (사진과 제목 영역에서 버튼을 덜어 냄) ──
  const want = h('button', { class: 'dact', type: 'button' });
  const paintWant = () => {
    const on = wanted.has(s.id);
    want.setAttribute('aria-pressed', String(on));
    want.innerHTML = `${icon('M6 3h12v18l-6-4.5L6 21z', 24, on ? 'currentColor' : 'none')}<span>${on ? '담았어요' : '가고 싶어요'}</span>`;
  };
  paintWant();
  want.addEventListener('click', () => {
    if (wanted.has(s.id)) wanted.delete(s.id);
    else wanted.add(s.id);
    paintWant();
    toast(wanted.has(s.id) ? '가고 싶은 곳에 담았어요' : '가고 싶은 곳에서 뺐어요');
  });
  const share = h('button', { class: 'dact', type: 'button' });
  share.innerHTML = `${icon('M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6', 24)}<span>공유</span>`;
  share.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${s.name} · 이맘때 자연`, text: s.oneLiner, url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        toast('주소를 복사했어요');
      }
    } catch {
      /* 사용자가 취소 */
    }
  });
  const bar = h(
    'div',
    { class: 'dbar' },
    want,
    share,
    h('a', { class: 'go', href: naviUrl('kakao', s.dest), target: '_blank', rel: 'noopener', text: '길찾기 (카카오맵)' }),
  );

  // ── 본문: 꼬리표 → 제목 → 지역 → 한 줄 소개 → 추천 시기 → 작가 글 ──
  const draft = () => h('span', { class: 'draft', text: '초안' });
  const vm = visitedMonth(s.visited);
  const recNote = isPeak
    ? null
    : h('p', { class: 'recnote', text: `사진은 작가 부부가 ${vm}월에 다녀온 모습이에요.` }); // 일 년 내내인 곳은 아래 추천 시기 칸이 알려 줌
  const tn = s.best && !isYearRound(s.best) ? timingNotice(s.types) : null;
  // '가는 곳'은 칸에서 뺌(제목과 겹침, 10/3 2차 코멘트). 길찾기는 여전히 주차장·입구 좌표로 엶
  const when = s.best
    ? h(
        'div',
        { class: 'when-box' },
        h('p', { class: 'when-row' }, h('span', { class: 'lbl', text: '추천 시기' }), h('b', { text: s.best.note }), s.review.best === 'draft' ? draft() : null),
        // 날씨·때 조건은 카드에서 빼고 여기에만(10/3 3차 결정)
        s.best.tip ? h('p', { class: 'when-tip' }, h('span', { class: 'lbl', text: '이럴 때 더 좋아요' }), h('span', { text: s.best.tip })) : null,
        tn ? h('p', { class: 'when-vary' }, infoIcon(), h('span', { text: tn.text })) : null,
        tn ? newsAnchor(s.name, tn) : null,
      )
    : null;
  // 사진 위 버튼(뒤로·넘김)이 나타나는 규칙 — docs/design-guide.md 6장
  // - 상세에 들어오면 숨겨 두었다가 사진이 뜨고 1초 뒤 서서히(4차 코멘트). 사진이 늦게 떠도 3.5초 안에는 보임
  // - 사진을 넘기면(화살표를 누르거나 밀어서) 숨겼다가, 사진이 멈추면 다시 빠르게 서서히(5차 코멘트, 6차: 2배쯤 빠르게 — 0.3초 뒤 0.25초 동안)
  // - 사람이 화면을 위아래로 스크롤하거나 사진을 톡 누르면 바로 서서히. 상세를 열 때 스크롤을 되돌리는 것은 사람 손이 아니므로 무시
  const gallery = h('div', { class: 'gallery ov-wait' }, slides, back, ...(n > 1 ? [prev, next] : []), credit);
  let showTimer = 0;
  let settleTimer = 0;
  const show = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(fallback);
    gallery.classList.remove('ov-wait');
  };
  const showLater = (ms: number) => {
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(show, ms);
  };
  const hide = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(fallback);
    gallery.classList.add('ov-wait');
  };
  const fallback = window.setTimeout(show, 3500);
  revealOverlay = show;
  const first = slides.querySelector('img');
  const arm = () => {
    showLater(1000);
    playKb(0);
  };
  if (!first || first.complete) arm();
  else {
    first.addEventListener('load', arm, { once: true });
    first.addEventListener('error', arm, { once: true });
  }
  // 사진이 움직이는 동안은 숨기고, 멈추면 0.3초 뒤 빠르게 다시 보이게(ov-quick: 0.25초 동안 서서히)
  let playing = 0; // 지금 움직이는 사진 번호
  const settled = () => {
    window.clearTimeout(settleTimer);
    gallery.classList.add('ov-quick');
    showLater(300);
    if (cur() !== playing) playKb((playing = cur())); // 다른 사진으로 넘어갔을 때만 새로 시작
  };
  slides.addEventListener(
    'scroll',
    () => {
      hide();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settled, 120); // 'scrollend'를 모르는 브라우저(아이폰 사파리 등)용
    },
    { passive: true },
  );
  slides.addEventListener('scrollend', settled);
  prev.addEventListener('click', hide);
  next.addEventListener('click', hide);
  slides.addEventListener('click', show); // 밀지 않고 톡 누르면 바로
  gallery.addEventListener('focusin', (e) => e.target === slides && show()); // 키보드로 사진 칸에 오면 보이게
  detail.replaceChildren(
    gallery,
    ...(n > 1 ? [gdots] : []),
    h(
      'div',
      { class: 'body' },
      // 구역으로 나눔(선 없이 여백으로, 10/3 3차 결정): ① 제목 ② 작가의 한마디 ③ 추천 시기 ④ 전체 이야기
      h('section', { class: 'dsec' }, badges(s), h('h2', { class: 'title', text: s.name }), h('p', { class: 'region', text: s.region }), h('p', { class: 'one' }, s.oneLiner, s.review.oneLiner === 'draft' ? draft() : null)),
      // 작가의 한마디: 명조로('장면 확인표'처럼). 작가 이름·몇 번째 여행 없이 다녀온 날짜만
      h('section', { class: 'dsec', 'aria-label': '작가의 한마디' }, h('h3', { class: 'dlbl', text: '작가의 한마디' }), h('blockquote', { class: 'quote' }, h('p', { text: s.excerpt }), h('cite', { text: fmtDate(s.visited) }))),
      recNote || when ? h('section', { class: 'dsec when-sec', 'aria-label': '추천 시기' }, recNote, when) : null,
      h('section', { class: 'dsec' }, h('a', { class: 'btn line', href: s.brunchUrl, target: '_blank', rel: 'noopener', text: '브런치에서 전체 이야기 읽기' })),
    ),
    bar,
  );
  ignoreScrollUntil = performance.now() + 700; // 아래 scrollTop 되돌리기와 여는 움직임 동안 생기는 스크롤은 무시
  detail.scrollTop = 0;
  detail.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => detail.classList.add('open'));
}
window.addEventListener('hashchange', renderDetail);
detail.addEventListener('scroll', () => performance.now() > ignoreScrollUntil && revealOverlay?.(), { passive: true });

// ── 시작 ──
async function start(): Promise<void> {
  try {
    const res = await fetch(new URL('../data/scenes.json', location.href));
    const data = (await res.json()) as ContentFile;
    scenes = data.scenes.filter((s): s is Scene => s.kind === 'story');
  } catch {
    peakSec.replaceChildren(h('p', { class: 'sec-head', text: '장면을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' }));
    return;
  }
  render();
  (months.children[month - 1] as HTMLElement).scrollIntoView({ inline: 'center', block: 'nearest' });
  renderDetail();
  try {
    kakao = await loadKakaoSdk(import.meta.env.VITE_KAKAO_JS_KEY ?? '');
  } catch {
    mapbox.append(h('p', { class: 'mapfail', text: '지도를 불러오지 못했어요.' }));
    return;
  }
  map = new kakao.maps.Map(document.getElementById('kmap'), {
    center: new kakao.maps.LatLng(36.4, 127.9),
    level: 13,
    draggable: false,
    scrollwheel: false,
    disableDoubleClickZoom: true,
    keyboardShortcuts: false,
  });
  map.setZoomable(false);
  const kr = new kakao.maps.LatLngBounds(new kakao.maps.LatLng(33.15, 125.6), new kakao.maps.LatLng(38.45, 129.6));
  map.setBounds(kr, 4, 4, 4, 4);
  national = { level: map.getLevel(), center: map.getCenter() };
  const go = () => {
    if (ready) return;
    ready = true;
    window.setTimeout(() => peak[sel] && flyTo(peak[sel]!), 500);
  };
  kakao.maps.event.addListener(map, 'tilesloaded', function onFirst() {
    kakao.maps.event.removeListener(map, 'tilesloaded', onFirst);
    go();
  });
  window.setTimeout(go, 2500);
  drawPins();
}
void start();
