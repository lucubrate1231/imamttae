/**
 * 시안 v2 — 실제 장면 초안 55곳으로 만든 첫 화면.
 * - 한 페이지를 위아래로 스크롤합니다(위아래가 짧던 느낌 해결).
 * - 제철 장면은 큰 사진과 계절 색으로 강조, 다녀온 기록은 작은 사진·회색으로 톤을 낮춥니다.
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
import { newsSearchUrl, timingNotice } from '../domain/timingNotice';
import { isYearRound } from '../domain/sceneTier';

type Scene = StoryScene;
type Photo = Scene['photos'][number];
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const SEASON_NAME: Record<Season, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const seasonOf = (m: Month): Season => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
const typeLabel = (s: Scene) => SCENE_TYPES.find((t) => t.id === s.types[0])?.label ?? '';
const AUTHOR = '이상호';
const STORY_URL = 'https://brunch.co.kr/@caed5ea4c3d74d9/1';

const qMonth = Number(new URLSearchParams(location.search).get('m'));
let month: Month = qMonth >= 1 && qMonth <= 12 ? qMonth : monthInSeoul();
let scenes: Scene[] = [];
let peak: Scene[] = [];
let record: Scene[] = [];
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

const seasonLabel = h('span', { class: 'season-label' });
const peakTitle = h('h2', {});
const rail = h('div', { class: 'rail', role: 'list', 'aria-label': '제철 명장면' });
const pagerText = h('span', {});
const pagerBar = h('b', {});
const pager = h('div', { class: 'pager', 'aria-hidden': 'true' }, h('i', {}, pagerBar), pagerText);
const peakSec = h('section', { class: 'peak' }, h('div', { class: 'sec-head' }, seasonLabel, peakTitle), rail, pager);

const mapbox = h('div', { class: 'mapbox' }, h('div', { class: 'kmap', id: 'kmap' }));
const legend = h('div', { class: 'legend', 'aria-hidden': 'true' }, h('span', { text: '제철' }), h('span', { class: 'r', text: '다녀온 기록' }));
const mapSec = h('section', { class: 'mapsec', 'aria-label': '지도' }, mapbox, legend);

const recTitle = h('h2', {});
const recList = h('ul', { class: 'reclist' });
const recSec = h(
  'section',
  { class: 'records' },
  recTitle,
  h('p', { class: 'sub', text: '제철은 아니어도 작가 부부가 이맘때 다녀온 곳이에요.' }),
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
const storyLink = h('a', { class: 'story-link', href: STORY_URL, target: '_blank', rel: 'noopener' }, h('span', {}, h('b', { text: '이 앱 이야기' }), ' · 60대 부부의 100곳 약속'), h('span', { 'aria-hidden': 'true', text: '›' }));
const extra = h('section', { class: 'extra' }, homeAdd, storyLink);

const tabs = h('nav', { class: 'tabs', 'aria-label': '메뉴' });
for (const [i, t] of ['지금', '명장면 찾기', '수첩'].entries()) {
  const b = h('button', { type: 'button', text: t, ...(i === 0 ? { 'aria-current': 'page' } : {}) });
  if (i > 0) b.addEventListener('click', () => toast('시안에서는 첫 화면만 볼 수 있어요'));
  tabs.append(b);
}
const detail = h('section', { class: 'detail', 'aria-label': '장면 상세', 'aria-hidden': 'true' });
const toastEl = h('div', { class: 'toast', role: 'status' });
app.append(months, h('main', {}, h('h1', { class: 'sr', text: '이맘때 자연' }), peakSec, mapSec, recSec, extra), tabs, detail, toastEl);

window.addEventListener('scroll', () => months.classList.toggle('lifted', window.scrollY > 4), { passive: true });

// ── 카드 ──
function badges(s: Scene): HTMLElement {
  const peakB = sceneTier(s) === 'peak';
  return h(
    'span',
    { class: 'badges' },
    h('span', { class: `badge ${peakB ? 'peak-b' : 'rec-b'}`, text: peakB ? '제철' : '다녀온 기록' }),
    h('span', { class: 'badge', text: typeLabel(s) }),
  );
}
function bigCard(s: Scene, i: number): HTMLElement {
  const b = h(
    'button',
    { class: 'big', type: 'button' },
    h('div', { class: 'photo' }, img(s.photos[0]!, ''), badges(s), h('span', { class: 'cap' }, h('b', { text: s.name }), h('span', { text: s.region }))),
    h(
      'div',
      { class: 'best' },
      h('span', { class: 'lbl', text: '가장 좋은 때' }),
      h('strong', { text: s.best?.season ?? '' }),
      h('span', { class: 'note', text: s.best?.note ?? '' }),
    ),
    timingNotice(s.types) ? h('div', { class: 'vary', text: '해마다 1~2주씩 달라져요' }) : null,
  );
  b.setAttribute('aria-label', `제철, ${s.name}, ${s.region}, 가장 좋은 때 ${s.best?.season ?? ''} ${s.best?.note ?? ''}${timingNotice(s.types) ? ', 해마다 달라짐' : ''}`);
  b.addEventListener('click', () => openScene(s.id));
  return h('div', { role: 'listitem', 'data-i': String(i) }, b);
}
function recRow(s: Scene): HTMLElement {
  const b = h(
    'button',
    { class: 'rec', type: 'button' },
    img(s.photos[0]!, '', thumb(s.photos[0]!.src)),
    h('span', {}, h('b', { text: s.name }), h('span', { class: 'meta', text: `${s.region} · ${fmtDate(s.visited.slice(0, 7))}에 다녀옴` }), h('span', { class: 'badge rec-b', text: typeLabel(s) })),
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

  seasonLabel.textContent = `${SEASON_NAME[season]} · ${month}월`;
  peakTitle.replaceChildren(document.createTextNode('지금이 제철인 곳'), h('small', { text: `${peak.length}곳` }));
  rail.replaceChildren(...peak.map(bigCard));
  rail.scrollLeft = 0;
  peakSec.hidden = peak.length === 0;

  recTitle.textContent = `${month}월에 다녀온 기록`;
  recList.replaceChildren(...record.map(recRow));
  recSec.hidden = record.length === 0;

  sel = 0;
  updatePager();
  drawPins();
}
function updatePager(): void {
  pagerText.textContent = peak.length ? `${sel + 1} / ${peak.length}` : '';
  pagerBar.style.width = peak.length ? `${((sel + 1) / peak.length) * 100}%` : '0';
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
  updatePager();
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
  const slides = h('div', { class: 'rail', tabindex: '0', 'aria-label': `사진 ${s.photos.length}장, 옆으로 넘겨 보세요` }, ...s.photos.map((p, i) => h('div', { class: 'slide' }, img(p, i === 0 ? `${s.name} 풍경` : ''))));
  const count = h('span', { class: 'count', text: `1 / ${s.photos.length}` });
  slides.addEventListener('scroll', () => {
    count.textContent = `${Math.round(slides.scrollLeft / slides.clientWidth) + 1} / ${s.photos.length}`;
  });
  const back = h('button', { class: 'round back', type: 'button', 'aria-label': '뒤로' });
  back.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  back.addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '')));
  const share = h('button', { class: 'round share', type: 'button', 'aria-label': '공유' });
  share.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>';
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
  const stamp = h('button', { class: 'stamp', type: 'button' });
  const paintStamp = () => {
    stamp.setAttribute('aria-pressed', String(stamped.has(s.id)));
    stamp.textContent = stamped.has(s.id) ? '✓ 봤어요' : '봤어요';
  };
  paintStamp();
  stamp.addEventListener('click', () => {
    if (stamped.has(s.id)) stamped.delete(s.id);
    else stamped.add(s.id);
    paintStamp();
    toast(stamped.has(s.id) ? `수첩에 '${typeLabel(s)}' 도장을 찍었어요` : '도장을 지웠어요');
  });

  const draft = () => h('span', { class: 'draft', text: '초안' });
  const vm = visitedMonth(s.visited);
  const recNote = isPeak
    ? null
    : h('p', { class: 'recnote', text: s.best && !isYearRound(s.best) ? `작가 부부가 ${vm}월에 다녀온 모습이에요. 가장 좋은 때는 ${s.best.season ? `${s.best.season}(${s.best.note})` : s.best.note}이에요.` : `작가 부부가 ${vm}월에 다녀온 모습이에요. 일 년 내내 볼 수 있는 풍경이에요.` });
  const tn = s.best && !isYearRound(s.best) ? timingNotice(s.types) : null;
  const vary = tn
    ? h(
        'div',
        { class: 'varybox' },
        h('p', { text: tn.text }),
        h('a', { href: newsSearchUrl(s.name, tn.keyword), target: '_blank', rel: 'noopener', text: `올해 ${tn.keyword} 소식 찾아보기 ›` }),
      )
    : null;
  const credit = h('span', { class: 'credit' }, `사진·글 ${AUTHOR}`, h('span', { class: 'sign', title: '작가 손글씨 서명 자리', text: '서명' }));
  detail.replaceChildren(
    h('div', { class: 'gallery' }, slides, back, share, credit, count),
    h(
      'div',
      { class: 'body' },
      h('div', { class: 'row' }, badges(s), stamp),
      h('h2', { class: 'title', text: s.name }),
      h('p', { class: 'region', text: s.region }),
      h('p', { class: 'one' }, s.oneLiner, s.review.oneLiner === 'draft' ? draft() : null),
      recNote,
      h(
        'dl',
        { class: 'facts' },
        s.best
          ? h(
              'div',
              {},
              h('dt', { text: '가장 좋은 때' }),
              h('dd', {}, h('b', { text: s.best.season ?? '' }), s.review.best === 'draft' ? draft() : null, h('small', { text: s.best.note })),
            )
          : null,
        h('div', {}, h('dt', { text: '다녀온 날' }), h('dd', { text: fmtDate(s.visited) })),
        h('div', {}, h('dt', { text: '가는 곳' }), h('dd', {}, s.dest.name, s.review.dest === 'draft' ? draft() : null)),
      ),
      vary,
      h('blockquote', { class: 'quote' }, h('p', { text: s.excerpt }), h('cite', { text: `— ${AUTHOR}${s.trip ? `, ${s.trip}` : ''}` })),
      h(
        'div',
        { class: 'actions' },
        h('a', { class: 'btn primary', href: naviUrl('kakao', s.dest), target: '_blank', rel: 'noopener', text: '길찾기 (카카오맵)' }),
        h('a', { class: 'btn line', href: s.brunchUrl, target: '_blank', rel: 'noopener', text: '브런치에서 전체 이야기 읽기' }),
      ),
    ),
  );
  detail.scrollTop = 0;
  detail.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => detail.classList.add('open'));
}
window.addEventListener('hashchange', renderDetail);

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
