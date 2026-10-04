/**
 * 저장한 곳(F4, D24~D26) — 디자인 캔버스 ④줄 '저장한 곳 탭', design-guide 9장, 글자는 10-5
 * 위에서부터: 저장한 곳(제목) → [알림 카드: 다음 PR] → 가고 싶은 곳(지금 가기 좋은 순) → 다녀온 곳 = 도장 모음 → 이 휴대폰에만 저장 안내 → 홈 화면에 두기
 * 저장은 src/storage/saved.ts, 순서 계산은 src/domain/saved.ts(Codex 일 4)를 씁니다.
 */
import type { Scene, StoryScene } from '../../shared/schema/content';
import type { Month } from '../domain/month';
import { routeHref } from '../domain/router';
import type { EventData, EventName } from '../analytics';
import { h, phoneIcon, photoImg, thumb } from './dom';
import type { Navi } from './navi';
import { savedOrder, type SavedRow } from '../domain/saved';
import type { SavedStore, Visit } from '../storage/saved';

export interface SavedDeps {
  win: Window;
  scenes: readonly Scene[];
  today: Month;
  /** 올해(한국 날짜) */
  year: number;
  store: SavedStore;
  navi: Navi;
  openScene(id: string, from: string): void;
  toast(msg: string): void;
  track(name: EventName, data?: EventData): void;
}

export interface Saved {
  el: HTMLElement;
  render(): void;
}

const svg = (body: string, size = 20, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
const ICON = {
  go: svg('<path d="M4 11l16-7-7 16-2-7z"/>', 18),
  mark: svg('<path d="M6 3h12v18l-6-4.5L6 21z"/>', 32, ' stroke-width="2"'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>', 15, ' stroke-width="2.2"'),
  hidden: svg('<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2.1-2.6 3.3M6.3 7.6C4.4 9 3 11 2.5 12c1 1.8 4.5 6 9.5 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 004.2 4.2"/>', 28, ' stroke-width="2"'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
};
/** 도장 색 = 그 풍경이 가장 좋은 계절의 색(design-guide 9-2 표) */
const STAMP_COLOR: Record<string, string> = {
  maehwa: '#b0466b', beotkkot: '#b0466b', jindallae: '#b0466b',
  sinrok: '#2e6b4a', yeoreumkkot: '#2e6b4a', gyegok: '#2e6b4a',
  kkotmureut: '#b0502a', danpung: '#b0502a', eoksae: '#b0502a', ilchul: '#b0502a',
  seolgyeong: '#466a86', unhae: '#466a86', bada: '#466a86',
};
/** 도장마다 조금씩 다르게 기울임(-7°~+4°), 같은 장소는 늘 같게 */
const tilt = (id: string) => ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 12) - 7;
const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function createSaved(d: SavedDeps): Saved {
  const el = h('section', { class: 'saved', 'aria-label': '저장한 곳' });
  const openFolds = new Set<number>(); // 펼친 지난해(다시 그려도 그대로)

  function statusLine(r: SavedRow): HTMLElement | null {
    const s = r.status;
    const dot = (k: string) => h('span', { class: `dot ${k}`, 'aria-hidden': 'true' });
    const pair = (b: string, rest: string) => h('span', {}, h('span', { class: 'nowrap' }, h('b', { text: b }), ' ·'), ' ', h('span', { class: 'nowrap', text: rest }));
    switch (s.kind) {
      case 'now':
        return h('span', { class: 'sv-stat' }, dot('now'), pair('지금 좋아요', `${s.until}월까지`));
      case 'soon':
        return h('span', { class: 'sv-stat' }, dot('soon'), pair('곧', `${s.from}월부터`));
      case 'always':
        return h('span', { class: 'sv-stat', text: '언제나 좋아요' });
      case 'later':
        return h('span', { class: 'sv-stat', text: `${s.from}월부터` });
      default:
        return null; // 추천 시기 없음 — 상태 한 줄을 비움
    }
  }

  function wishRow(r: SavedRow): HTMLElement {
    const del = h('button', { type: 'button', class: 'sv-del', text: '빼기' });
    del.addEventListener('click', () => {
      d.store.toggleWanted(r.sceneId);
      d.track('save', { scene: r.sceneId, on: false });
      d.toast('저장한 곳에서 뺐어요');
      render();
    });
    if (!r.scene) {
      // F4-AC12: 숨겨지거나 없어진 곳
      const ph = h('span', { class: 'sv-ph' });
      ph.innerHTML = ICON.hidden;
      return h('div', { class: 'sv-wish gone' }, h('div', { class: 'sv-wtop' }, ph, h('span', {}, h('b', { class: 'sv-name' }), h('span', { class: 'sv-region', text: '지금은 볼 수 없는 곳이에요' }))), h('div', { class: 'sv-wact' }, del));
    }
    const s = r.scene;
    const top = h(
      'button',
      { type: 'button', class: 'sv-wtop' },
      photoImg(s.photos[0]!, '', { src: thumb(s.photos[0]!.src, 240) }),
      h('span', { class: 'sv-text' }, h('b', { class: 'sv-name', text: s.name }), h('span', { class: 'sv-region', text: s.region }), statusLine(r)),
    );
    top.addEventListener('click', () => d.openScene(s.id, 'saved'));
    const go = h('button', { type: 'button', class: 'sv-go' });
    go.innerHTML = `${ICON.go}<span>길찾기</span>`;
    go.addEventListener('click', () => d.navi.openFor(s.dest, s.id, 'saved'));
    return h('div', { class: 'sv-wish' }, top, h('div', { class: 'sv-wact' }, go, del));
  }

  function stamp(v: Visit): HTMLElement {
    const b = h(
      'button',
      { type: 'button', class: 'sv-stamp', 'aria-label': `${v.name}, ${md(v.date)}에 다녀옴` },
      h('img', { src: `./stamps/${v.type}.webp`, alt: '', loading: 'lazy', style: `transform: rotate(${tilt(v.sceneId)}deg)` }),
      h('b', { text: v.name }),
      h('span', { class: 'sv-date', text: md(v.date), style: `color: ${STAMP_COLOR[v.type] ?? 'var(--season)'}` }),
    );
    b.addEventListener('click', () => {
      const s = d.scenes.find((x) => x.id === v.sceneId);
      if (!s || (s.kind === 'story' && s.hidden)) return d.toast('지금은 볼 수 없는 곳이에요');
      d.openScene(v.sceneId, 'stamp');
    });
    return b;
  }

  function render(): void {
    const rows = savedOrder(d.scenes, d.store.wanted(), d.today);
    const years = d.store.visitsByYear();
    const thisYear = years.find((y) => y.year === d.year)?.visits ?? [];
    const past = years.filter((y) => y.year !== d.year);

    // 가고 싶은 곳
    const wishSec = h('section', { class: 'sv-sec' }, h('h2', { class: 'sv-h2', text: '가고 싶은 곳' }));
    if (rows.length) {
      wishSec.append(h('p', { class: 'sv-sub', text: '지금 가기 좋은 순서예요.' }), h('div', { class: 'sv-wishes' }, ...rows.map(wishRow)));
    } else {
      const goHome = h('button', { type: 'button', class: 'btn fill', text: '지금 풍경 보러 가기' });
      goHome.addEventListener('click', () => (d.win.location.hash = routeHref({ name: 'month', month: null })));
      const mark = h('span', { class: 'sv-mark' });
      mark.innerHTML = ICON.mark;
      wishSec.append(h('div', { class: 'sv-empty sv-wish-empty' }, mark, h('p', {}, "장면에서 '저장'을 누르면", h('br'), '여기 모여요.'), goHome));
    }

    // 다녀온 곳 = 도장 모음
    const visitSec = h('section', { class: 'sv-sec sv-visits' }, h('h2', { class: 'sv-h2', text: '다녀온 곳' }));
    if (!years.length) {
      visitSec.append(h('div', { class: 'sv-empty sv-visit-empty' }, h('span', { class: 'sv-ghost', 'aria-hidden': 'true' }), h('p', {}, '다녀오신 뒤 장면에서 [다녀왔어요]를', h('br'), '누르면 도장이 찍혀요.')));
    } else {
      visitSec.append(
        h('p', { class: 'sv-sub sv-visit-sub', text: thisYear.length ? `올해 다녀온 곳 ${thisYear.length}곳 · 도장을 누르면 그곳 이야기를 다시 볼 수 있어요.` : '올해는 아직 다녀온 곳이 없어요.' }),
      );
      if (thisYear.length) visitSec.append(h('div', { class: 'sv-stamps' }, ...thisYear.map(stamp)));
      for (const y of past) {
        const grid = h('div', { class: 'sv-stamps' }, ...y.visits.map(stamp));
        grid.hidden = !openFolds.has(y.year);
        const fold = h('button', { type: 'button', class: 'sv-fold', 'aria-expanded': String(!grid.hidden) });
        fold.innerHTML = `<span><b>${y.year}년</b> · ${y.visits.length}곳</span>${ICON.down}`;
        fold.addEventListener('click', () => {
          grid.hidden = !grid.hidden;
          fold.setAttribute('aria-expanded', String(!grid.hidden));
          if (grid.hidden) openFolds.delete(y.year);
          else openFolds.add(y.year);
        });
        visitSec.append(fold, grid);
      }
    }

    // 맨 아래: 이 휴대폰에만 저장(F4-AC15) · 홈 화면에 두기(F5 — 곧 열려요)
    const note = h('p', { class: 'sv-note' }, h('span', { class: 'info', 'aria-hidden': 'true' }), '저장한 곳은 이 휴대폰에만 저장돼요. 로그인은 필요 없지만, 휴대폰을 바꾸거나 인터넷 사용 기록을 지우면 함께 지워져요.');
    (note.firstChild as HTMLElement).innerHTML = ICON.info;
    const homeAdd = h('button', { class: 'home-add', type: 'button' }, phoneIcon(), h('span', {}, h('b', { text: '홈 화면에 두기' }), h('span', { text: '앱처럼 바로 열려요. 설치는 필요 없어요.' })));
    homeAdd.addEventListener('click', () => d.toast('곧 열려요'));

    el.replaceChildren(
      h('header', { class: 'sv-head' }, h('h1', { class: 'sv-ttl', text: '저장한 곳' })),
      ...(d.store.saved ? [] : [h('p', { class: 'sv-warn', role: 'status', text: '이 브라우저에서는 저장되지 않아요.' })]),
      wishSec,
      visitSec,
      h('section', { class: 'sv-sec sv-foot' }, note, homeAdd),
    );
  }

  return { el, render };
}
