/**
 * 장면 상세(F2) — 확정 시안 v2를 실제 앱으로 옮기고 10/4 기획 결정을 반영
 * - 구역 순서: 제목 → 추천 시기 → 작가의 한마디 → 브런치 전체 이야기
 * - 꼬리표는 오늘(한국 날짜) 기준: [지금 좋아요] · [일 년 내내] · 그 밖은 풍경 종류만
 * - 추천 시기 밖이면 추천 시기 칸 맨 위에 "N월부터 가기 좋아요"
 * - 사진 안내 "사진은 작가가 N월에 다녀온 모습이에요."는 모든 장면에
 * - 글자는 design-guide 10장 '화면 글자 표'가 기준(D28~D30)
 * - 저장한 장면은 제목 구역 아래 [다녀왔어요] 상자(F4, src/ui/visited.ts)
 * - 색은 사진 찍은 달(visited)의 계절 — 어디서 열어도 같음. 상세 밖의 길찾기 판과 휴대폰 위쪽 띠도(design-guide 3장, PR #46)
 * 화면 규칙: docs/design-guide.md 6장 · 완성 기준: docs/features/F2-장면-카드와-길찾기.md
 */
import type { PlaceholderScene, Scene, StoryScene } from '../../shared/schema/content';
import { seasonNow, seasonOf } from '../domain/home';
import { kenBurnsPlan } from '../domain/kenBurns';
import { isYearRound, visitedMonth } from '../domain/sceneTier';
import { SCENE_TYPES } from '../domain/sceneTypes';
import { newsLink, timingNotice, type TimingNotice } from '../domain/timingNotice';
import type { Month } from '../domain/month';
import { fmtDate, h, infoIcon, paintBrowserBar, photoImg } from './dom';
import type { Navi } from './navi';
import { shareUrl, type EventData, type EventName } from '../analytics';
import type { SavedStore } from '../storage/saved';
import { createVisitBox, type VisitBox } from './visited';

const AUTHOR = '이상호';
const APP_NAME = '이맘때 풍경';

type Photo = StoryScene['photos'][number];

export interface DetailDeps {
  win: Window;
  scenes: readonly Scene[];
  /** 오늘(한국 날짜)의 달 — 꼬리표 기준 */
  today: Month;
  navi: Navi;
  /** 저장·다녀온 곳(F4, src/storage/saved.ts) */
  saved: SavedStore;
  /** 오늘(한국 날짜) 'YYYY-MM-DD' — 다녀온 날 기준 */
  todayDate(): string;
  /** 사용 통계(docs/analytics.md) */
  track(name: EventName, data?: EventData): void;
  /** 사진 움직임(기본 켬, ?motion=0이면 끔) */
  motion: boolean;
  toast(msg: string, action?: { label: string; run(): void }): void;
  /** [저장]·빼기 뒤(F5): 처음 저장 판을 띄웠으면 true — 그때는 안내 줄을 띄우지 않음 */
  afterSave?(on: boolean): boolean;
  /** 뒤로: 앱 안에서 열었으면 이전 화면으로, 주소로 바로 열었으면 첫 화면으로 */
  back(): void;
}

export interface Detail {
  el: HTMLElement;
  /** 장면을 열면 true, 없는 장면이면 false */
  show(id: string): boolean;
  hide(): void;
}

const svg = (d: string, size = 22, fill = 'none') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const BACK = 'M15 18l-6-6 6-6';
const NEXT = 'M9 18l6-6-6-6';

export function createDetail(d: DetailDeps): Detail {
  const { win } = d;
  const doc = win.document;
  const reduceMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const el = h('section', { class: 'detail', 'aria-label': '장면 상세', 'aria-hidden': 'true' });
  let revealOverlay: (() => void) | null = null;
  let visitBox: VisitBox | null = null; // 지금 연 장면의 [다녀왔어요] 상자
  let ignoreScrollUntil = 0; // 이 시각 전의 스크롤은 사람 손이 아님(열며 맨 위로 되돌린 것)
  let timers: number[] = [];
  const later = (fn: () => void, ms: number) => {
    const t = win.setTimeout(fn, ms);
    timers.push(t);
    return t;
  };
  el.addEventListener('scroll', () => performance.now() > ignoreScrollUntil && revealOverlay?.(), { passive: true });

  const backBtn = (cls: string) => {
    const b = h('button', { class: cls, type: 'button', 'aria-label': '뒤로' });
    b.innerHTML = svg(BACK, 22);
    b.addEventListener('click', () => d.back());
    return b;
  };
  const draft = () => h('span', { class: 'draft', text: '초안' });
  const typeLabel = (s: StoryScene) => SCENE_TYPES.find((t) => t.id === s.types[0])?.label ?? '';

  // ── 사진 칸: 뒤로 + 넘김 화살표 + 작은 크레딧만(사진 위 버튼은 1초 뒤 서서히) ──
  function gallery(s: StoryScene): { node: HTMLElement; dots: HTMLElement | null } {
    const n = s.photos.length;
    const photoEl = (p: Photo, i: number): HTMLElement => {
      const pic = photoImg(p, i === 0 ? `${s.name} 풍경` : '', { eager: i === 0 });
      pic.addEventListener('error', () => {
        // F2-AC10: 사진을 못 불러오면 회색 자리와 안내
        const slide = pic.closest('.slide');
        slide?.classList.add('fail');
        slide?.append(h('p', { class: 'slide-fail', text: '사진은 브런치에서 볼 수 있어요' }));
        pic.remove();
      });
      if (!d.motion) return pic;
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
    const playKb = (i: number) => {
      if (!d.motion || reduceMotion) return;
      slides.querySelectorAll<HTMLElement>('.kb').forEach((k, j) => {
        k.classList.remove('kb-on');
        if (j === i) {
          void k.offsetWidth;
          k.classList.add('kb-on');
        }
      });
    };
    const prev = h('button', { class: 'ov nav prev', type: 'button', 'aria-label': '이전 사진' });
    prev.innerHTML = svg(BACK, 18);
    const next = h('button', { class: 'ov nav next', type: 'button', 'aria-label': '다음 사진' });
    next.innerHTML = svg(NEXT, 18);
    const dots = n > 1 ? h('div', { class: 'gdots', 'aria-hidden': 'true' }, ...s.photos.map((_, i) => h('i', { class: i === 0 ? 'on' : '' }))) : null;
    const cur = () => Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
    const go = (i: number) => slides.scrollTo?.({ left: Math.max(0, Math.min(n - 1, i)) * slides.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    const paintNav = () => {
      const i = cur();
      prev.hidden = i <= 0;
      next.hidden = i >= n - 1;
      dots?.querySelectorAll('i').forEach((dot, k) => dot.classList.toggle('on', k === i));
    };
    prev.addEventListener('click', () => go(cur() - 1));
    next.addEventListener('click', () => go(cur() + 1));
    slides.addEventListener('scroll', paintNav, { passive: true });
    paintNav();
    const credit = h('span', { class: 'credit' }, `사진·글 ${AUTHOR}`, h('img', { class: 'sign', src: './brand/sign-white.png', alt: '', width: '37', height: '22' }));
    const node = h('div', { class: 'gallery ov-wait' }, slides, backBtn('ov back'), ...(n > 1 ? [prev, next] : []), credit);

    // 사진 위 버튼이 나타나는 규칙(docs/design-guide.md 6장)
    let showTimer = 0;
    let settleTimer = 0;
    const show = () => {
      win.clearTimeout(showTimer);
      win.clearTimeout(fallback);
      node.classList.remove('ov-wait');
    };
    const showLater = (ms: number) => {
      win.clearTimeout(showTimer);
      showTimer = later(show, ms);
    };
    const hide = () => {
      win.clearTimeout(showTimer);
      win.clearTimeout(fallback);
      node.classList.add('ov-wait');
    };
    const fallback = later(show, 3500); // 사진이 늦게 떠도 3.5초 안에는 보임
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
    let playing = 0;
    let arrowUntil = 0;
    const byArrow = () => performance.now() < arrowUntil;
    const settled = () => {
      win.clearTimeout(settleTimer);
      if (!byArrow()) {
        node.classList.add('ov-quick');
        showLater(100);
      }
      if (cur() !== playing) playKb((playing = cur()));
    };
    slides.addEventListener(
      'scroll',
      () => {
        if (!byArrow()) hide();
        win.clearTimeout(settleTimer);
        settleTimer = later(settled, 120); // 'scrollend'를 모르는 브라우저용
      },
      { passive: true },
    );
    slides.addEventListener('scrollend', settled);
    const onArrow = () => {
      hide();
      node.classList.add('ov-quick');
      arrowUntil = performance.now() + 600;
      showLater(250);
    };
    prev.addEventListener('click', onArrow);
    next.addEventListener('click', onArrow);
    slides.addEventListener('click', show);
    node.addEventListener('focusin', (e) => e.target === slides && show());
    return { node, dots };
  }

  /** 올해 소식 찾아보기: 해는 누르는 순간 기준 */
  function newsAnchor(name: string, tn: TimingNotice, sceneId: string): HTMLElement {
    const first = newsLink(name, tn);
    const a = h('a', { class: 'when-link', href: first.url, target: '_blank', rel: 'noopener', text: first.label });
    a.addEventListener('click', () => {
      a.setAttribute('href', newsLink(name, tn, new Date()).url);
      d.track('news', { scene: sceneId });
    });
    return a;
  }

  function brunchLink(s: StoryScene): HTMLElement {
    const a = h('a', { class: 'btn line', href: s.brunchUrl, target: '_blank', rel: 'noopener', text: '브런치에서 전체 이야기 읽기' });
    a.addEventListener('click', () => d.track('brunch', { scene: s.id }));
    return a;
  }

  function storyDetail(s: StoryScene): HTMLElement[] {
    const state = seasonNow(s.best, d.today);
    // 꼬리표: 오늘 기준(10/4 결정). '작가가 다녀온 곳' 꼬리표는 두지 않음
    const badges = h(
      'span',
      { class: 'badges' },
      state === 'now' && h('span', { class: 'badge peak-b', text: '지금 좋아요' }),
      state === 'yearRound' && h('span', { class: 'badge', text: '일 년 내내' }),
      h('span', { class: 'badge', text: typeLabel(s) }),
    );
    const tn = s.best && !isYearRound(s.best) ? timingNotice(s.types) : null;
    const when = s.best
      ? h(
          'div',
          { class: 'when-box' },
          state === 'off' && h('p', { class: 'when-off', text: `${s.best.from}월부터 가기 좋아요` }),
          h('p', { class: 'when-row' }, h('span', { class: 'lbl', text: '추천 시기' }), h('b', { text: s.best.note }), s.review.best === 'draft' && draft()),
          s.best.tip && h('p', { class: 'when-tip' }, h('span', { class: 'lbl', text: '이럴 때 더 좋아요' }), h('span', { text: s.best.tip })),
          tn && h('p', { class: 'when-vary' }, infoIcon(), h('span', { text: tn.text })),
          tn && newsAnchor(s.name, tn, s.id),
        )
      : null;
    const recNote = h('p', { class: 'recnote', text: `사진은 작가가 ${visitedMonth(s.visited)}월에 다녀온 모습이에요.` });

    // ── 아래 붙박이 막대: 저장 · 공유 · 길찾기(티맵) (D28) ──
    const want = h('button', { class: 'dact', type: 'button' });
    const paintWant = () => {
      const on = d.saved.isWanted(s.id);
      want.setAttribute('aria-pressed', String(on));
      want.innerHTML = `${svg('M6 3h12v18l-6-4.5L6 21z', 24, on ? 'currentColor' : 'none')}<span>${on ? '저장됨' : '저장'}</span>`;
    };
    paintWant();
    want.addEventListener('click', () => {
      const on = d.saved.toggleWanted(s.id);
      d.track('save', { scene: s.id, on });
      paintWant();
      visitBox?.paint();
      if (d.afterSave?.(on)) return; // F5-AC6: 크롬·삼성 인터넷의 처음 저장은 홈 화면에 두기 판
      // F4-AC3: 저장하면 몇 초 동안 안내 줄 + [보기 ›](저장한 곳으로)
      if (on) d.toast("저장했어요 · '저장한 곳'에서 볼 수 있어요", { label: '보기 ›', run: () => (win.location.hash = '#/saved') });
      else d.toast('저장한 곳에서 뺐어요');
    });
    const share = h('button', { class: 'dact', type: 'button' });
    share.innerHTML = `${svg('M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6', 24)}<span>공유</span>`;
    /** 공유 창(없으면 주소 복사). where: detail(아래 막대) / stamp(도장 순간의 카톡으로 알리기, F4-AC9) */
    const doShare = async (where: 'detail' | 'stamp', title: string, text: string) => {
      const nav = win.navigator;
      const url = shareUrl(win.location, s.id); // 받은 사람이 열면 from=share로 셈(통계)
      try {
        if (nav.share) {
          d.track('share', { scene: s.id, where, how: 'share-sheet' });
          await nav.share({ title, text, url });
        } else {
          d.track('share', { scene: s.id, where, how: 'copy' });
          await nav.clipboard.writeText(url);
          d.toast('주소를 복사했어요');
        }
      } catch {
        /* 사용자가 취소 */
      }
    };
    share.addEventListener('click', () => void doShare('detail', `${s.name} · ${APP_NAME}`, s.oneLiner));
    visitBox = createVisitBox({
      win,
      scene: s,
      store: d.saved,
      todayDate: d.todayDate,
      track: d.track,
      share: (text) => void doShare('stamp', text, text),
      host: el,
      onChange: paintWant,
    });
    const { go, other } = d.navi.controls(s.dest, s.id);
    const bar = h('div', { class: 'dbar' }, want, share, go);

    const g = gallery(s);
    return [
      g.node,
      ...(g.dots ? [g.dots] : []),
      h(
        'div',
        { class: 'body' },
        h('section', { class: 'dsec', 'aria-label': '제목' }, badges, h('h2', { class: 'title', text: s.name }), h('p', { class: 'region', text: s.region }), h('p', { class: 'one' }, s.oneLiner, s.review.oneLiner === 'draft' && draft()), visitBox.slot),
        h('section', { class: 'dsec when-sec', 'aria-label': '추천 시기' }, recNote, when),
        h('section', { class: 'dsec', 'aria-label': '작가의 한마디' }, h('h3', { class: 'dlbl', text: '작가의 한마디' }), h('blockquote', { class: 'quote' }, h('p', { text: s.excerpt }), h('cite', { text: fmtDate(s.visited) }))),
        h('section', { class: 'dsec', 'aria-label': '브런치 전체 이야기' }, brunchLink(s)),
        // 작게 '다른 앱으로 길찾기'(10/4 결정). 아래 막대가 높아지지 않게, 누르는 곳 48px을 지키려고 본문 맨 아래에 둠
        other && h('div', { class: 'navi-row' }, other),
      ),
      bar,
    ];
  }

  /** F2-AC8: 준비 중 장면은 이름·다녀온 날·안내만 */
  function placeholderDetail(p: PlaceholderScene): HTMLElement[] {
    revealOverlay = null;
    return [
      h('div', { class: 'ph-top' }, backBtn('ph-back')),
      h(
        'div',
        { class: 'body' },
        h(
          'section',
          { class: 'dsec', 'aria-label': '제목' },
          h('span', { class: 'badges' }, h('span', { class: 'badge', text: '준비 중' })),
          h('h2', { class: 'title', text: p.name }),
          h('p', { class: 'region', text: `${fmtDate(p.visited)}에 다녀옴` }),
          h('p', { class: 'recnote ph-msg', text: '작가가 글을 다듬고 있어요. 브런치에 발행되면 여기에 이야기가 채워져요.' }),
        ),
      ),
    ];
  }

  function clearTimers(): void {
    timers.forEach((t) => win.clearTimeout(t));
    timers = [];
  }

  return {
    el,
    show(id) {
      const s = d.scenes.find((x) => x.id === id && !(x.kind === 'story' && x.hidden));
      if (!s) return false;
      clearTimers();
      visitBox?.close();
      visitBox = null;
      el.replaceChildren(...(s.kind === 'story' ? storyDetail(s) : placeholderDetail(s)));
      ignoreScrollUntil = performance.now() + 700;
      el.scrollTop = 0;
      el.dataset.season = seasonOf(visitedMonth(s.visited));
      d.navi.sheet.dataset.season = el.dataset.season;
      paintBrowserBar(win, el);
      el.setAttribute('aria-hidden', 'false');
      doc.body.style.overflow = 'hidden';
      el.classList.add('open');
      return true;
    },
    hide() {
      if (el.getAttribute('aria-hidden') === 'true') return;
      clearTimers();
      visitBox?.close();
      revealOverlay = null;
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
      delete d.navi.sheet.dataset.season; // 아래 화면(고른 달)의 색으로 돌아감
      paintBrowserBar(win, el.parentElement);
      doc.body.style.overflow = '';
    },
  };
}
