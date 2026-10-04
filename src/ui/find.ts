/**
 * 풍경 찾기(F3) — A안 '사진 타일'(10/3 밤 사용자 선택, 디자인 세션)
 * - 고르기(#/find): 머리 → N월에 좋은 풍경(첫째 큰 타일) → 지역으로 고르기 → 언제나 볼 수 있는 풍경 → 다른 때 풍경
 * - 고른 뒤(#/find/<풍경>[/<권역>]): ‹ 풍경 찾기 → 제목 → 볼 수 있는 때 한 줄 → 권역 칩 → 지도 → 가까운 때부터 → 작가 부부가 다녀온 곳
 * - 제철 장면이 없는 풍경: 안내 + 지금 함께 보기 좋은 풍경(F3-AC9)
 * 완성 기준: docs/features/F3-풍경-찾기.md · 모양: docs/design-guide.md 8장
 */
import type { Scene, StoryScene } from '../../shared/schema/content';
import { REGIONS, findScenes, regionCounts, regionOf, typeGroups, typeWhen, whenStatus, type RegionId, type TypeWhen } from '../domain/find';
import { inWindow, type Month } from '../domain/month';
import { routeHref } from '../domain/router';
import { isYearRound, sceneTier, visitedMonth } from '../domain/sceneTier';
import { SCENE_TYPES, type SceneTypeId } from '../domain/sceneTypes';
import type { MapAdapter, MapPin } from '../map/types';
import { h, photoImg, thumb } from './dom';

export interface FindDeps {
  win: Window;
  map: MapAdapter;
  scenes: readonly Scene[];
  /** 오늘(한국 날짜)의 달 — 풍경 찾기는 늘 오늘 기준 */
  today: Month;
  /** from: 통계 scene-open의 '어디서 열었나'(find-list / map-pin) */
  openScene(id: string, from: string): void;
}

export interface Find {
  el: HTMLElement;
  /** 지도를 붙일 자리(앱이 한 번 mount) */
  mapHost: HTMLElement;
  render(type: SceneTypeId | null, region: RegionId | null): void;
  destroy(): void;
}

const label = (t: SceneTypeId) => SCENE_TYPES.find((x) => x.id === t)!.label;
const regionLabel = (r: RegionId) => REGIONS.find((x) => x.id === r)!.label;
const next = (m: Month, k = 1): Month => ((m - 1 + k) % 12) + 1;
const ahead = (from: Month, to: Month) => (to - from + 12) % 12;

function whenText(w: TypeWhen): string {
  if (w.kind === 'always') return '언제나';
  if (w.kind === 'range') return w.from === w.to ? `${w.from}월` : `${w.from}~${w.to}월`;
  return '';
}
/** 받침이 있으면 '이', 없으면 '가' */
function iga(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 !== 0 ? '이' : '가';
}

const BACK_SVG =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

export function createFind(d: FindDeps): Find {
  const { win, map, today } = d;
  const stories = d.scenes.filter((s): s is StoryScene => s.kind === 'story' && !s.hidden);
  const el = h('section', { class: 'find', 'aria-label': '풍경 찾기' });
  const mapHost = h('div', { class: 'kmap' });
  const mapbox = h('div', { class: 'mapbox' }, mapHost);
  const go = (hash: string) => (win.location.hash = hash);
  map.onPinClick((id) => d.openScene(id, 'map-pin'));

  const ofType = (t: SceneTypeId | null) => (t ? stories.filter((s) => s.types.includes(t)) : stories);
  const yearRound = (s: StoryScene) => !!s.best && isYearRound(s.best);
  /** '지금 좋아요' 묶음 순서(D23): 추천 시기가 먼저 끝나는 곳, 같으면 이름순 — Codex 일 3 findScenes */
  const sortNow = (xs: StoryScene[]) => findScenes(xs, { month: today }).peak;

  /**
   * 풍경의 대표 사진 = 그 풍경 화면 목록의 맨 위 장면(지금 제철 묶음은 D23 순서 → 일 년 내내 → 곧·그 뒤 → 다녀온 곳).
   * 타일을 누르면 같은 사진이 목록 맨 위에 다시 보입니다. 장면마다 대표 사진을 직접 고르는 것은 콘텐츠 세션 제안.
   */
  function coverOf(t: SceneTypeId): StoryScene | undefined {
    const list = ofType(t);
    const timed = list.filter((s) => s.best && !yearRound(s) && sceneTier(s) === 'peak');
    const now = sortNow(timed.filter((s) => inWindow(today, s.best!)));
    const yr = list.filter(yearRound).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const rest = timed.filter((s) => !now.includes(s)).sort((a, b) => ahead(next(today), a.best!.from) - ahead(next(today), b.best!.from) || a.name.localeCompare(b.name, 'ko'));
    return now[0] ?? yr[0] ?? rest[0] ?? list[0];
  }

  function tile(t: SceneTypeId, opts: { big?: boolean; nameOnly?: boolean } = {}): HTMLElement {
    const cover = coverOf(t);
    const w = typeWhen(stories, t);
    const count = ofType(t).length;
    const line = [whenText(w), `${count}곳`].filter(Boolean).join(' · ');
    const cls = `tile${opts.big ? ' big-tile' : ''}`;
    const b = h('button', { type: 'button', class: cls });
    const pic = cover ? photoImg(cover.photos[0]!, '', opts.big ? {} : { src: thumb(cover.photos[0]!.src, 480) }) : null;
    if (opts.big) {
      // 상태는 이름 위 한 줄(8-1, 10/4 — 이름 오른쪽에 두면 320px에서 '단풍·은행'이 두 줄로 깨짐)
      const status = whenStatus(w, today) === 'now' ? h('span', { class: 'on-photo-status' }, h('span', { class: 'dot photo', 'aria-hidden': 'true' }), '지금 좋아요') : null;
      b.append(h('span', { class: 'tile-photo' }, pic), h('span', { class: 'tile-cap' }, status, h('b', { class: 'tile-name', text: label(t) }), h('span', { class: 'tile-line', text: line })));
    } else {
      b.append(h('span', { class: 'tile-photo' }, pic), h('span', { class: 'tile-text' }, h('b', { class: 'tile-name', text: label(t) }), !opts.nameOnly && h('span', { class: 'tile-line', text: line })));
    }
    b.addEventListener('click', () => go(routeHref({ name: 'find', type: t, region: null })));
    return b;
  }
  /** 작은 타일 2열. 홀수여도 2열 그대로, 마지막 칸은 비움(8-1, 10/4 사용자) */
  function grid(types: SceneTypeId[], nameOnly = false): HTMLElement {
    return h('div', { class: 'tiles' }, ...types.map((t) => tile(t, { nameOnly })));
  }

  function chips(counts: { id: RegionId | null; label: string; count?: number }[], selected: RegionId | null, href: (r: RegionId | null) => string, cls: string): HTMLElement {
    return h(
      'div',
      { class: cls },
      ...counts.map((c) => {
        const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(c.id === selected) }, c.label, c.count !== undefined && h('span', { class: 'chip-n', text: ` ${c.count}` }));
        b.addEventListener('click', () => go(href(c.id)));
        return b;
      }),
    );
  }

  function renderPick(): void {
    const g = typeGroups(stories, today);
    const good = g.good.map((x) => x.type);
    const sec = (cls: string, title: string, ...kids: (HTMLElement | null)[]) => h('section', { class: `find-sec ${cls}` }, h('h2', { text: title }), ...kids);
    el.replaceChildren(
      h(
        'header',
        { class: 'find-head' },
        h('p', { class: 'eyebrow', text: '풍경 찾기' }),
        h('h1', { class: 'find-ttl', text: '어떤 풍경이 보고 싶으세요?' }),
        h('p', { class: 'find-sub', text: '고르면 언제, 어디서 볼 수 있는지 알려 드려요.' }),
      ),
      ...(good.length ? [sec('sec-good', `${today}월에 좋은 풍경`, tile(good[0]!, { big: true }), good.length > 1 ? grid(good.slice(1)) : null)] : []),
      sec('sec-region', '지역으로 고르기', chips([{ id: null, label: '전국' }, ...regionCounts(stories)], null, (r) => routeHref({ name: 'find', type: null, region: r }), 'chips')),
      ...(g.always.length ? [sec('sec-always', '언제나 볼 수 있는 풍경', grid(g.always))] : []),
      ...(g.other.length || g.empty.length
        ? [
            sec(
              'sec-other',
              '다른 때 풍경',
              g.other.length ? grid(g.other) : null,
              ...g.empty.map((t) => h('div', { class: 'tile dim' }, h('span', { class: 'tile-text' }, h('b', { class: 'tile-name', text: label(t) }), h('span', { class: 'tile-line', text: '아직 이야기가 없어요' })))),
            ),
          ]
        : []),
    );
  }

  function row(s: StoryScene, record: boolean): HTMLElement {
    const meta = record ? `${visitedMonth(s.visited)}월에 다녀온 모습` : (s.best?.note ?? '');
    const b = h(
      'button',
      { type: 'button', class: `row${record ? ' rec-row' : ''}` },
      photoImg(s.photos[0]!, '', { src: thumb(s.photos[0]!.src, 240) }),
      h('span', { class: 'row-text' }, h('b', { class: 'row-name', text: s.name }), h('span', { class: 'row-meta' }, h('span', { class: 'nowrap', text: `${s.region} ·` }), ' ', h('span', { class: 'nowrap', text: meta }))),
    );
    b.addEventListener('click', () => d.openScene(s.id, 'find-list'));
    return b;
  }

  function renderResult(type: SceneTypeId | null, region: RegionId | null): void {
    const base = ofType(type);
    const inRegion = (s: StoryScene) => !region || regionOf(s.region) === region;
    const list = base.filter(inRegion);
    const w = type ? typeWhen(stories, type) : null;
    const status = w ? whenStatus(w, today) : null;

    // 머리: ‹ 풍경 찾기 → 제목 → 볼 수 있는 때 한 줄
    const back = h('button', { type: 'button', class: 'find-back' });
    back.innerHTML = `${BACK_SVG}<span>풍경 찾기</span>`;
    back.addEventListener('click', () => go(routeHref({ name: 'find', type: null, region: null })));
    let when: HTMLElement | null = null;
    if (w && status && status !== 'none') {
      const range = whenText(w);
      when =
        status === 'now' || status === 'soon'
          ? h('p', { class: 'when-line' }, h('span', { class: `dot ${status}`, 'aria-hidden': 'true' }), h('span', {}, h('span', { class: 'nowrap' }, h('b', { text: status === 'now' ? '지금 좋아요' : '곧' }), ' ·'), ' ', h('span', { class: 'nowrap', text: status === 'now' && w.kind === 'range' ? `${w.to}월까지` : `${range}에 가장 좋아요` })))
          : h('p', { class: 'when-line', text: status === 'always' ? '언제나 좋아요' : `${range}에 가장 좋아요` });
    }
    const head = h('header', { class: 'find-head result' }, back, h('h1', { class: 'find-ttl', text: type ? label(type) : regionLabel(region!) }), when);

    // 권역 칩: 전국 N + 그 풍경이 있는 권역
    const counts = regionCounts(base);
    const chipRow = chips(
      [{ id: null, label: '전국', count: base.length }, ...counts],
      region,
      (r) => routeHref({ name: 'find', type, region: r }),
      'find-chips',
    );

    // 나누기: 일 년 내내(낮추지 않음, D8) · 좋은 때 다녀온 장면은 때에 따라 묶음 · 다른 때 다녀온 곳
    const yr = list.filter(yearRound).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const timed = list.filter((s) => s.best && !yearRound(s) && sceneTier(s) === 'peak');
    const records = list.filter((s) => !yearRound(s) && !timed.includes(s)).sort((a, b) => visitedMonth(a.visited) - visitedMonth(b.visited) || a.name.localeCompare(b.name, 'ko'));
    type Group = { head: HTMLElement; more: string; rows: StoryScene[] };
    const groups: Group[] = [];
    const now = timed.filter((s) => inWindow(today, s.best!));
    const soon = timed.filter((s) => !inWindow(today, s.best!) && s.best!.from === next(today));
    const later = timed.filter((s) => !now.includes(s) && !soon.includes(s));
    const byName = (a: StoryScene, b: StoryScene) => a.name.localeCompare(b.name, 'ko');
    const dotHead = (cls: string, text: string) => h('p', { class: 'group-head' }, h('span', { class: `dot ${cls}`, 'aria-hidden': 'true' }), h('b', { text }));
    const yrGroup: Group | null = yr.length ? { head: h('p', { class: 'group-head', text: '언제나 좋아요' }), more: '<b>언제나</b> 좋은 곳 더 보기', rows: yr } : null;
    if (yrGroup && w?.kind === 'always') groups.push(yrGroup);
    if (now.length) groups.push({ head: dotHead('now', '지금 좋아요'), more: `<b>${today}월</b>에 좋은 곳 더 보기`, rows: sortNow(now) });
    if (soon.length) groups.push({ head: dotHead('soon', '곧'), more: `<b>${next(today)}월</b>에 좋은 곳 더 보기`, rows: [...soon].sort(byName) });
    const starts = [...new Set(later.map((s) => s.best!.from))].sort((a, b) => ahead(next(today), a) - ahead(next(today), b));
    for (const m of starts) groups.push({ head: h('p', { class: 'group-head', text: `${m}월부터` }), more: `<b>${m}월</b>에 좋은 곳 더 보기`, rows: later.filter((s) => s.best!.from === m).sort(byName) });
    if (yrGroup && w?.kind !== 'always') groups.push(yrGroup);

    const few = groups.length === 0 && records.length > 0; // F3-AC9: 제철 장면이 없는 풍경

    // 지도: 제철·일 년 내내는 계절 색 점, 다녀온 곳은 회색 점. 모두 보이게 맞춤
    const pin = (s: StoryScene, kind: MapPin['kind']): MapPin => ({ id: s.id, lat: s.spot.lat, lng: s.spot.lng, label: s.name, kind });
    map.setPins([...records.map((s) => pin(s, 'record')), ...groups.flatMap((g) => g.rows).map((s) => pin(s, 'peak'))]);
    map.select(null);
    const mapSec = h(
      'section',
      { class: 'find-map', 'aria-label': '지도' },
      mapbox, // 범례는 두지 않고 색 구분만(D31) — 회색 점의 뜻은 아래 '작가가 다녀온 곳' 구역이 알려 줌
    );

    // 목록: 첫 묶음만 펼치고 나머지는 'N월에 좋은 곳 더 보기'
    const listSec = h('section', { class: 'find-list' });
    if (few) {
      const word = (type ? label(type) : '').split(/[·\s]/)[0] ?? '';
      listSec.append(h('p', { class: 'few-note', text: `${word}${iga(word)} 가장 좋을 때 다녀온 이야기는 아직 없어요. 다른 계절에 다녀온 모습이에요.` }), ...records.map((s) => row(s, true)));
    } else if (groups.length) {
      listSec.append(h('h2', { text: '가까운 때부터' }));
      groups.forEach((g, i) => {
        const box = h('div', { class: 'group' }, g.head, ...g.rows.map((s) => row(s, false)));
        box.hidden = i > 0;
        listSec.append(box);
        if (i > 0) {
          const more = h('button', { type: 'button', class: 'more' });
          more.innerHTML = `<span>${g.more}</span><span aria-hidden="true">›</span>`;
          more.addEventListener('click', () => {
            box.hidden = false;
            more.remove();
          });
          listSec.append(more);
        }
      });
    }
    const recSec =
      !few && records.length
        ? h(
            'section',
            { class: 'find-records' },
            h('h2', {}, h('span', { class: 'dot rec', 'aria-hidden': 'true' }), '작가가 다녀온 곳'),
            h('p', { class: 'sub' }, h('span', { class: 'nowrap', text: '가장 좋은 때는 아니지만' }), ' ', h('span', { class: 'nowrap', text: '다녀온 모습을 볼 수 있어요.' })),
            ...records.map((s) => row(s, true)),
          )
        : null;
    const together =
      few && type
        ? (() => {
            const pick = typeGroups(stories, today).good.map((x) => x.type).filter((t) => t !== type).slice(0, 2);
            return pick.length ? h('section', { class: 'find-sec together' }, h('h2', { text: '지금 함께 보기 좋은 풍경' }), grid(pick, true)) : null;
          })()
        : null;

    el.replaceChildren(head, chipRow, mapSec, listSec, ...(recSec ? [recSec] : []), ...(together ? [together] : []));
    map.fit();
  }

  return {
    el,
    mapHost,
    render(type, region) {
      if (!type && !region) renderPick();
      else renderResult(type, region);
    },
    destroy() {},
  };
}
