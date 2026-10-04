/**
 * 첫 화면 '지금 볼 만한 곳'(기능 ①) — 확정 시안 v2를 실제 앱으로 옮김
 * 위에서 아래로: 이상호 작가의 추천 → N월에 만나는 풍경 → 달 띠 → N월에 좋은 풍경 카드 → 작은 지도 → 작가가 다녀온 곳 → 홈 화면에 두기·이 앱 이야기
 * 완성 기준: docs/features/F1-지금-볼-만한-곳.md, 화면 규칙: docs/design-guide.md
 */
import type { PlaceholderScene, Scene, StoryScene } from '../../shared/schema/content';
import { homeView, seasonOf, type HomeView } from '../domain/home';
import { MONTHS, type Month } from '../domain/month';
import { routeHref } from '../domain/router';
import { SCENE_TYPES } from '../domain/sceneTypes';
import { timingNotice } from '../domain/timingNotice';
import type { MapAdapter, MapPin } from '../map/types';
import { calIcon, fmtDate, h, infoIcon, phoneIcon, photoImg, thumb } from './dom';

const RECOMMENDER = '이상호 작가'; // 맨 위 작은 글씨(10/3 사용자 결정)
const STORY_URL = 'https://brunch.co.kr/@caed5ea4c3d74d9/1'; // 이 앱 이야기

export interface HomeDeps {
  win: Window;
  map: MapAdapter;
  scenes: readonly Scene[];
  /** from: 통계 scene-open의 '어디서 열었나'(photo-card / visited-row / map-pin) */
  openScene(id: string, from: string): void;
  toast(msg: string): void;
  /** 제철 알림 카드 자리(F4-AC10) — 큰 제목 아래·달 띠 위 */
  alert?: HTMLElement;
}

export interface Home {
  /** 화면에 붙일 조각들(작은 제목 막대, 본문) */
  nodes: HTMLElement[];
  /** 지도를 붙일 자리 */
  mapHost: HTMLElement;
  render(month: Month): void;
  destroy(): void;
}

const typeLabel = (s: StoryScene) => SCENE_TYPES.find((t) => t.id === s.types[0])?.label ?? '';

export function createHome(d: HomeDeps): Home {
  const { win, map } = d;
  const reduceMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let view: HomeView | null = null;
  let cards: StoryScene[] = []; // 카드 띠에 놓인 제철 장면(순서대로)
  let sel = 0;

  // ── 머리: 작은 글씨 → 큰 제목 → 달 띠. 스크롤하면 작은 제목 막대(F1-AC13) ──
  const eyebrow = h('p', { class: 'eyebrow', text: `${RECOMMENDER}의 추천` });
  const title = h('h1', { class: 'ttl' });
  const mini = h('div', { class: 'mini-ttl', 'aria-hidden': 'true' });
  const months = h('nav', { class: 'months', 'aria-label': '달 고르기' });
  const chips = MONTHS.map((m) => {
    const b = h('button', { class: 'mchip', type: 'button', text: `${m}월` });
    b.addEventListener('click', () => {
      win.location.hash = routeHref({ name: 'month', month: m });
      win.scrollTo?.({ top: 0 });
    });
    months.append(b);
    return b;
  });

  // ── 제철 카드 띠 ──
  const emptyNote = h('p', { class: 'empty-month', role: 'status' });
  // 읽기 이름은 달마다 'N월에 좋은 풍경'(D29, render에서 정함)
  const rail = h('div', { class: 'rail', role: 'list' });
  const peakSec = h('section', { class: 'peak' }, emptyNote, rail);

  // ── 작은 지도 ──
  const mapHost = h('div', { class: 'kmap' });
  // 범례: 그 화면 두 구역의 이름과 같게 — 'N월에 좋은 풍경 · 작가가 다녀온 곳'(D29·D30, 달은 render에서)
  const legend = h('div', { class: 'legend', 'aria-hidden': 'true' }, h('span', {}), h('span', { class: 'r', text: '작가가 다녀온 곳' }));
  const mapSec = h('section', { class: 'mapsec', 'aria-label': '지도' }, h('div', { class: 'mapbox' }, mapHost), legend);

  // ── 작가가 다녀온 곳(F1-AC11, D30) ──
  const recTitle = h('h2', {});
  const recList = h('ul', { class: 'reclist' });
  const recSec = h('section', { class: 'records' }, recTitle, h('p', { class: 'sub' }, h('span', { class: 'nowrap', text: '가장 좋은 때는 아니지만' }), ' ', h('span', { class: 'nowrap', text: '이맘때 모습을 볼 수 있어요.' })), recList);

  // ── 아래: 홈 화면에 두기(F5, 곧 열림) · 이 앱 이야기 ──
  const homeAdd = h(
    'button',
    { class: 'home-add', type: 'button' },
    phoneIcon(),
    h('span', {}, h('b', { text: '홈 화면에 두기' }), h('span', { text: '앱처럼 바로 열려요. 설치는 필요 없어요.' })),
  );
  homeAdd.addEventListener('click', () => d.toast('곧 열려요'));
  const storyLink = h(
    'a',
    { class: 'story-link', href: STORY_URL, target: '_blank', rel: 'noopener' },
    h('span', { class: 'story-txt' }, h('small', { text: '이 앱 이야기' }), h('b', { text: '60대 부부의 100곳 여행 약속' })),
    h('span', { 'aria-hidden': 'true', text: '›' }),
  );
  const extra = h('section', { class: 'extra' }, homeAdd, storyLink);

  const main = h('main', { class: 'home' }, eyebrow, title, d.alert ?? null, months, peakSec, mapSec, recSec, extra);

  // 큰 제목이 화면 위로 나가면 작은 제목 막대를 보임
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => mini.classList.toggle('on', !e!.isIntersecting && e!.boundingClientRect.top < 0)) : null;
  io?.observe(title);

  // ── 카드 ──
  function bigCard(s: StoryScene, i: number): HTMLElement {
    const tn = timingNotice(s.types);
    const note = s.best?.note ?? '';
    const b = h(
      'button',
      { class: 'big', type: 'button', 'aria-label': `${s.name}, ${s.region}, 추천 시기 ${note}${tn ? `, ${tn.short}` : ''}` },
      h(
        'div',
        { class: 'photo' },
        photoImg(s.photos[0]!, '', { eager: i === 0 }),
        h('span', { class: 'badges' }, h('span', { class: 'badge on-photo', text: typeLabel(s) })),
        h('span', { class: 'cap' }, h('b', { text: s.name }), h('span', { text: s.region })),
      ),
      h('div', { class: 'best' }, calIcon(), h('span', { class: 'lbl', text: '추천 시기' }), h('strong', { text: note })),
      tn && h('div', { class: 'vary' }, infoIcon(), h('span', { text: tn.short })),
    );
    b.addEventListener('click', () => d.openScene(s.id, 'photo-card'));
    return h('div', { role: 'listitem' }, b);
  }
  /** 준비 중 카드(F1-AC4): 사진 없이 점선, 이름과 다녀온 날 */
  function phCard(p: PlaceholderScene): HTMLElement {
    const b = h(
      'button',
      { class: 'big ph', type: 'button', 'aria-label': `${p.name}, 준비 중, ${fmtDate(p.visited)}에 다녀옴` },
      h(
        'div',
        { class: 'photo' },
        h('span', { class: 'ph-note', text: '준비 중' }),
        h('span', { class: 'ph-name', text: p.name }),
        h('span', { class: 'ph-date', text: `${fmtDate(p.visited)}에 다녀옴` }),
      ),
    );
    b.addEventListener('click', () => d.openScene(p.id, 'photo-card'));
    return h('div', { role: 'listitem' }, b);
  }
  function recRow(s: StoryScene): HTMLElement {
    const b = h(
      'button',
      { class: 'rec', type: 'button' },
      photoImg(s.photos[0]!, '', { src: thumb(s.photos[0]!.src) }),
      h('span', {}, h('b', { text: s.name }), h('span', { class: 'meta', text: s.region }), h('span', { class: 'badge rec-b', text: typeLabel(s) })),
    );
    b.addEventListener('click', () => d.openScene(s.id, 'visited-row'));
    return h('li', {}, b);
  }

  // ── 카드와 지도 맞추기(F1-AC5·AC6) ──
  function select(i: number, scrollRail: boolean): void {
    sel = i;
    map.select(cards[i]?.id ?? null);
    if (scrollRail) {
      const c = rail.children[i] as HTMLElement | undefined;
      if (c) rail.scrollTo?.({ left: c.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  let scrollTimer = 0;
  rail.addEventListener('scroll', () => {
    win.clearTimeout(scrollTimer);
    scrollTimer = win.setTimeout(() => {
      const first = rail.children[0] as HTMLElement | undefined;
      if (!first) return;
      const step = first.offsetWidth + 12;
      const i = Math.max(0, Math.min(cards.length - 1, Math.round(rail.scrollLeft / step)));
      if (i !== sel) select(i, false);
    }, 90);
  });
  map.onPinClick((id) => {
    const i = cards.findIndex((s) => s.id === id);
    if (i >= 0) select(i, true);
    else d.openScene(id, 'map-pin'); // 작가가 다녀온 곳·준비 중은 바로 상세로
  });

  function render(month: Month): void {
    view = homeView(d.scenes, month);
    const root = main.parentElement;
    if (root) root.dataset.season = seasonOf(month);
    const soft = root ? getComputedStyle(root).getPropertyValue('--season-soft').trim() : '';
    win.document.querySelector('meta[name=theme-color]')?.setAttribute('content', soft || '#ffffff');

    for (const c of chips) c.setAttribute('aria-pressed', String(c.textContent === `${month}월`));
    title.textContent = `${month}월에 만나는 풍경`;
    mini.textContent = title.textContent;

    // 빈 달이면 안내와 가까운 달의 제철 풍경(F1-AC8)
    cards = view.empty ? view.nearby.peak : view.peak;
    emptyNote.hidden = !view.empty;
    emptyNote.replaceChildren(
      ...(view.empty ? [h('b', { text: `${month}월은 아직 이야기가 없어요.` }), ` 가까운 ${view.nearby.months.map((m) => `${m}월`).join('·')} 풍경을 보여 드려요.`] : []),
    );
    rail.replaceChildren(...cards.map(bigCard), ...view.placeholders.map(phCard));
    rail.scrollLeft = 0;
    peakSec.hidden = rail.children.length === 0 && !view.empty;

    recTitle.textContent = `${month}월, 작가가 다녀온 곳`;
    const good = `${month}월에 좋은 풍경`;
    rail.setAttribute('aria-label', good);
    peakSec.setAttribute('aria-label', good);
    (legend.firstElementChild as HTMLElement).textContent = good;
    recList.replaceChildren(...view.record.map(recRow));
    recSec.hidden = view.record.length === 0;

    const pin = (s: { id: string; name: string; spot: { lat: number; lng: number } }, kind: MapPin['kind']): MapPin => ({ id: s.id, lat: s.spot.lat, lng: s.spot.lng, label: s.name, kind });
    // 제철 점이 위에 오도록 다녀온 곳 → 준비 중 → 제철 순서로 올림
    map.setPins([...view.record.map((s) => pin(s, 'record')), ...view.placeholders.map((p) => pin(p, 'placeholder')), ...cards.map((s) => pin(s, 'peak'))]);
    select(0, false);
  }

  return {
    nodes: [mini, main],
    mapHost,
    render,
    destroy() {
      io?.disconnect();
      win.clearTimeout(scrollTimer);
    },
  };
}
