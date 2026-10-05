/**
 * 홈 화면에 두기(F5, D33) — design-guide 11장, 글자 10-6
 * - 카톡 안: 첫 화면 맨 위 띠 '크롬(사파리)으로 열기' → 넘어가지 못하면 그림 안내
 * - 크롬·삼성 인터넷(설치 전): 처음 [저장] 직후 판 한 번(안내 줄 대신)
 * - 늘 있는 [홈 화면에 두기] 카드(첫 화면·저장한 곳 맨 아래): 설치 창 또는 브라우저별 그림 안내
 * - 홈 화면 아이콘으로 열면 모두 숨김(F5-AC5)
 * - 카톡 안에서 저장하면 주소에 장면 번호(carry)를 붙여 둬, 바깥 브라우저로 넘어가도 저장한 곳이 함께 감. 받는 쪽은 합치고 주소에서 지움
 * 기억하는 것(휴대폰 저장소 'a2hs'): 띠를 닫았나 · 처음 저장 판을 보였나 · 설치했나
 */
import type { Scene } from '../../shared/schema/content';
import type { EventData, EventName } from '../analytics';
import { chromeIntentUrl, kakaoExternalUrl, readCarry, withCarry, type A2hsEnv, type InstallEvent } from '../pwa';
import type { SafeStore } from '../storage/safeStorage';
import type { SavedStore } from '../storage/saved';
import { h } from './dom';

export interface A2hsDeps {
  win: Window;
  env: A2hsEnv;
  /** 안드로이드 휴대폰·태블릿인가(브라우저 이름표에 Android) — 크롬·삼성 인터넷 첫 방문 띠(D37)는 안드로이드에만 */
  android: boolean;
  scenes: readonly Scene[];
  store: SafeStore;
  saved: SavedStore;
  /** 덮개·판을 붙일 곳 */
  host: HTMLElement;
  /** 지금 준비된 크롬 설치 창(없으면 null) */
  installPrompt(): InstallEvent | null;
  /** 바깥 주소 열기(카톡 → 브라우저) */
  openUrl(url: string): void;
  /** 띠를 누른 뒤 이만큼 지나도 이 화면이면 그림 안내(기본 2초) */
  waitMs: number;
  toast(msg: string): void;
  track(name: EventName, data?: EventData): void;
}

export interface A2hs {
  /** 첫 화면 맨 위 띠(카톡 안, 닫지 않았을 때만) */
  band: HTMLElement | null;
  /** [홈 화면에 두기] 카드(홈 화면 아이콘으로 열면 숨김) */
  card(): HTMLElement;
  /** 장면 상세에서 [저장]·빼기 뒤. 판을 띄웠으면 true(그때는 안내 줄을 띄우지 않음) */
  afterSave(on: boolean): boolean;
  destroy(): void;
}

type Flags = { bandClosed?: boolean; sheetShown?: boolean; installed?: boolean; promptDismissed?: boolean };
const KEY = 'a2hs';
const ICON = './brand/icon-192.png';

/** 글 조각: 문자열 또는 굵게(누를 것) */
/** 글 조각: 문자열 · 굵게(누를 것) · 글 안의 버튼 모양 열쇠(장식, 읽지 않음) */
type Seg = string | { b: string } | { key: 'share' };
type Pic =
  | { kind: 'key'; at: 'tr' | 'br'; sym: string }
  /** rows가 있으면 실제 메뉴 순서대로 그리고, 누를 줄(item) 오른쪽에 아이콘 */
  | { kind: 'menu'; item: string; rows?: string[]; icon?: 'plus' }
  /** 버튼 모양 하나만(자리 없이) — 아이폰 공유 버튼처럼 자리가 판마다 다를 때(디자인 #62) */
  | { kind: 'icon'; sym: 'share' }
  | { kind: 'dialog'; label: string; toggle?: boolean };
interface Step {
  t: Seg[];
  sub?: string;
  pic: Pic;
}
interface Guide {
  title: string;
  desc: string;
  steps: Step[];
}

const GUIDES: Record<Exclude<A2hsEnv, 'standalone'>, Guide> = {
  'kakao-android': {
    title: '크롬이 열리지 않았나요?',
    desc: '카카오톡 메뉴로 열 수 있어요.',
    steps: [
      { t: ['화면 오른쪽 ', { b: '[⋮]' }, ' 버튼을 누르세요'], sub: '오른쪽 아래에 있어요.', pic: { kind: 'key', at: 'br', sym: '⋮' } },
      { t: ["'", { b: '다른 브라우저로 열기' }, "'를 누르세요"], sub: '크롬이 아닌 브라우저가 열려도 괜찮아요.', pic: { kind: 'menu', item: '다른 브라우저로 열기' } },
    ],
  },
  'kakao-ios': {
    title: '사파리가 열리지 않았나요?',
    desc: '카카오톡 공유 버튼으로 열 수 있어요.',
    steps: [
      { t: ['화면 오른쪽 아래 ', { b: '공유' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'br', sym: '⇧' } },
      { t: ["'", { b: 'Safari' }, "'를 고르세요"], pic: { kind: 'menu', item: 'Safari' } },
    ],
  },
  chrome: {
    title: '홈 화면에 두는 방법',
    desc: '크롬 메뉴로 할 수 있어요.',
    steps: [
      { t: ['오른쪽 위 ', { b: '[⋮]' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'tr', sym: '⋮' } },
      { t: ["'", { b: '홈 화면에 추가' }, "'를 누르세요"], sub: "'앱 설치'로 보일 수도 있어요.", pic: { kind: 'menu', item: '홈 화면에 추가' } },
      { t: ["'", { b: '설치' }, "'를 누르세요"], pic: { kind: 'dialog', label: '설치' } },
    ],
  },
  samsung: {
    title: '홈 화면에 두는 방법',
    desc: '삼성 인터넷 메뉴로 할 수 있어요.',
    steps: [
      { t: ['오른쪽 아래 ', { b: '[≡]' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'br', sym: '≡' } },
      { t: ["'", { b: '현재 페이지 추가' }, "'를 누르세요"], pic: { kind: 'menu', item: '현재 페이지 추가' } },
      { t: ["'", { b: '홈 화면' }, "'을 누르세요"], pic: { kind: 'dialog', label: '홈 화면' } },
    ],
  },
  // 아이폰 사파리는 판·배치마다 공유 버튼 자리가 달라(iOS 18 아래 막대, iOS 26 '간결'은 [⋯] 안, '아래'·'위'는 막대에 바로) 자리 대신 모양으로 안내(디자인 #62)
  'ios-safari': {
    title: '홈 화면에 두는 방법',
    desc: '사파리 공유 버튼으로 할 수 있어요.',
    steps: [
      { t: [{ key: 'share' }, { b: "'공유'" }, ' 버튼을 누르세요'], sub: '안 보이면 주소창 옆 [⋯] 버튼을 먼저 누르세요.', pic: { kind: 'icon', sym: 'share' } },
      { t: ["아래로 내려 '", { b: '홈 화면에 추가' }, "'를 누르세요"], pic: { kind: 'menu', item: '홈 화면에 추가', rows: ['북마크에 추가', '페이지에서 찾기'], icon: 'plus' } },
      { t: ["오른쪽 위 '", { b: '추가' }, "'를 누르세요"], sub: "'웹 앱으로 열기'가 보이면 켠 채로 두세요.", pic: { kind: 'dialog', label: '추가', toggle: true } },
    ],
  },
};

const CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>`;
const CLOSE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/** 작은 그림(장식): 휴대폰 화면 한 칸 안에 누를 곳만 흰 바탕 + 계절 색 테두리 */
/** 장면 상세 아래 막대 [공유]와 같은 모양(네모 위로 화살표) */
const SHARE = (size: number) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>`;
/** 아이폰 공유 화면 '홈 화면에 추가' 줄의 ⊕ 네모 */
const PLUS_SQ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`;
const svgSpan = (cls: string, svg: string) => {
  const s = h('span', { class: cls, 'aria-hidden': 'true' });
  s.innerHTML = svg;
  return s;
};

function pic(p: Pic): HTMLElement {
  const box = h('span', { class: `a2-pic ${p.kind}`, 'aria-hidden': 'true' });
  if (p.kind === 'key') {
    box.classList.add(p.at);
    box.append(h('span', { class: 'a2-bar' }), h('span', { class: 'a2-hit', text: p.sym }));
  } else if (p.kind === 'icon') {
    box.append(svgSpan('a2-hit a2-sym', SHARE(18)));
  } else if (p.kind === 'menu' && p.rows) {
    const hit = h('span', { class: 'a2-row a2-hit', text: p.item });
    if (p.icon === 'plus') hit.append(svgSpan('a2-row-ic', PLUS_SQ));
    box.classList.add('rows');
    box.append(...p.rows.map((r) => h('span', { class: 'a2-row', text: r })), hit);
  } else if (p.kind === 'menu') {
    box.append(h('span', { class: 'a2-line' }), h('span', { class: 'a2-hit', text: p.item }), h('span', { class: 'a2-line' }));
  } else {
    box.append(h('span', { class: 'a2-line short' }), h('span', { class: 'a2-hit', text: p.label }));
    if (p.toggle) box.append(h('span', { class: 'a2-switch' }));
  }
  return box;
}

export function createA2hs(d: A2hsDeps): A2hs {
  const { win, env } = d;
  const doc = win.document;
  const flags = () => d.store.get<Flags>(KEY, {});
  const setFlag = (f: Flags) => d.store.set(KEY, { ...flags(), ...f });
  const track = (action: string) => d.track('a2hs', { action, env });
  const kakao = env === 'kakao-android' || env === 'kakao-ios';
  // 카톡 안 띠: 안드로이드는 크롬, 아이폰은 사파리('으로'/'로'가 달라 통째로 둠)
  /**
   * 띠 확인용 주소 ?band=show(10/5 사용자): 닫은 적이 있어도, 카톡이 아니어도 띠를 보여 줌. 닫음 표시는 건드리지 않음.
   * 카톡이 아니면 아이폰 사파리는 아이폰 카톡 띠, 그 밖은 안드로이드 카톡 띠로 흉내 냄
   */
  const previewParam = new URLSearchParams(win.location.search).get('band'); // 'show' | 'chrome'(아이폰에서 안드로이드 띠 흉내)
  const bandPreview = previewParam === 'show';
  /** D37: 안드로이드 크롬·삼성 인터넷(설치 전)은 첫 방문부터 '홈 화면에 두기' 띠 */
  const installCapable = (env === 'chrome' || env === 'samsung') && d.android;
  const bandEnv: 'kakao-android' | 'kakao-ios' = kakao ? env : env === 'ios-safari' ? 'kakao-ios' : 'kakao-android';
  const via = bandEnv === 'kakao-ios' ? '사파리로' : '크롬으로';

  // ── 넘겨받은 장면 번호(카톡 → 브라우저): 합치고 주소에서 지움 ──
  const known = new Set(d.scenes.map((s) => s.id));
  if (!kakao) {
    const ids = readCarry(win.location.search).filter((id) => known.has(id));
    for (const id of ids) if (!d.saved.isWanted(id) && !d.saved.visitOf(id)) d.saved.toggleWanted(id);
    const clean = withCarry(win.location.href, []);
    if (clean !== win.location.href) win.history.replaceState(win.history.state, '', clean);
  }
  /** 카톡 안: 지금 주소에 저장한 장면 번호를 붙여 둠(카톡 메뉴로 넘어가도 함께 가게) */
  const syncCarry = () => {
    const next = withCarry(win.location.href, d.saved.wanted());
    if (next !== win.location.href) win.history.replaceState(win.history.state, '', next);
  };
  if (kakao) syncCarry();

  // ── 판(덮개 + 아래에서 올라옴) ──
  let open: { close(): void } | null = null;
  function sheet(label: string, kids: HTMLElement[], onClose?: () => void): { close(): void } {
    open?.close();
    const back = doc.activeElement as HTMLElement | null;
    const panel = h('div', { class: 'a2sheet vsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' }, h('span', { class: 'vs-handle', 'aria-hidden': 'true' }), ...kids);
    const scrim = h('div', { class: 'a2scrim vscrim bottom' }, panel);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && item.close();
    const item = {
      close() {
        if (open !== item) return;
        open = null;
        scrim.remove();
        doc.removeEventListener('keydown', onKey);
        onClose?.();
        if (back?.isConnected) back.focus();
      },
    };
    scrim.addEventListener('click', (e) => e.target === scrim && item.close());
    doc.addEventListener('keydown', onKey);
    d.host.append(scrim);
    open = item;
    panel.focus();
    return item;
  }

  function guide(which: A2hsEnv = env): void {
    if (which === 'standalone') return;
    const g = GUIDES[which];
    const ok = h('button', { type: 'button', class: 'btn line a2-done', text: '알겠어요' });
    const s = sheet(g.title, [
      h('h2', { class: 'a2-gttl', text: g.title }),
      h('p', { class: 'a2-desc', text: g.desc }),
      h(
        'ol',
        { class: 'a2-steps' },
        ...g.steps.map((st, i) =>
          h(
            'li',
            { class: 'a2-step' },
            h('span', { class: 'a2-num', 'aria-hidden': 'true' }, String(i + 1)),
            h('span', { class: 'sr', text: `${i + 1}단계 ` }),
            h(
              'span',
              { class: 'a2-body' },
              h('span', { class: 'a2-txt' }, ...st.t.map((x) => (typeof x === 'string' ? x : 'b' in x ? h('b', { text: x.b }) : svgSpan('a2-key', SHARE(16))))),
              st.sub ? h('span', { class: 'a2-sub', text: st.sub }) : null,
            ),
            pic(st.pic),
          ),
        ),
      ),
      ok,
    ]);
    ok.addEventListener('click', () => s.close());
    track('guide');
  }

  /** [홈 화면에 두기]: 카톡 → 넘어가기 안내 · 설치 창이 있으면 그 창 · 아니면 그 브라우저 그림 안내 */
  async function install(): Promise<void> {
    const p = env === 'chrome' || env === 'samsung' ? d.installPrompt() : null;
    if (!p) return guide();
    open?.close();
    track('prompt');
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      track(`prompt-${outcome}`);
      if (outcome === 'dismissed') setFlag({ promptDismissed: true }); // 띠는 그대로, 저장 직후 판은 다시 묻지 않음(D37)
    } catch {
      guide();
    }
  }

  const onInstalled = () => {
    setFlag({ installed: true });
    band?.remove(); // 설치를 마치면 띠가 사라짐(D37)
    track('installed');
    d.toast("홈 화면에 '이맘때'를 두었어요");
  };
  win.addEventListener('appinstalled', onInstalled);

  // ── 맨 위 띠(11-2): 카톡 안 '크롬(사파리)으로 열기' · 안드로이드 크롬·삼성 인터넷 '홈 화면에 두기'(D37) ──
  const f0 = flags();
  const bandKind: 'open' | 'install' | null =
    previewParam === 'chrome'
      ? 'install'
      : bandPreview
        ? installCapable
          ? 'install'
          : 'open'
        : kakao && !f0.bandClosed
          ? 'open'
          : installCapable && !f0.bandClosed && !f0.installed
            ? 'install'
            : null;
  let band: HTMLElement | null = null;
  if (bandKind === 'install') {
    const go = h(
      'button',
      { type: 'button', class: 'kb-go', 'aria-label': '홈 화면에 두기 안내' },
      h('img', { class: 'kb-ic', src: ICON, alt: '', width: '32', height: '32' }),
      h(
        'span',
        { class: 'kb-txt' },
        h('span', { class: 'kb-l1' }, h('span', { class: 'nowrap', text: '홈 화면에 두면' }), ' ', h('span', { class: 'nowrap', text: '앱처럼 쓸 수 있어요' })),
        h('b', { class: 'kb-l2', text: '홈 화면에 두기 ›' }),
      ),
    );
    const x = h('button', { type: 'button', class: 'kb-x', 'aria-label': '안내 닫기' });
    x.innerHTML = CLOSE;
    const el = h('div', { class: 'kband' }, go, x);
    // 누르면 맨 아래 카드와 같음(설치 창 또는 그림 안내). 띠는 ✕로만 닫힘
    go.addEventListener('click', () => {
      track('band');
      if (!installCapable) return guide('chrome'); // ?band=chrome으로 아이폰에서 흉내 낸 띠
      void install();
    });
    x.addEventListener('click', () => {
      setFlag({ bandClosed: true });
      track('band-close');
      el.remove();
    });
    band = el;
  } else if (bandKind === 'open') {
    const go = h(
      'button',
      { type: 'button', class: 'kb-go', 'aria-label': `${via} 열기 안내` },
      // 앱 아이콘(장식) — '앱처럼'이 무엇인지 바로 보이게(디자인 #64)
      h('img', { class: 'kb-ic', src: ICON, alt: '', width: '32', height: '32' }),
      h(
        'span',
        { class: 'kb-txt' },
        h('span', { class: 'kb-l1' }, h('span', { class: 'nowrap', text: `${via} 열면` }), ' ', h('span', { class: 'nowrap', text: '앱처럼 쓸 수 있어요' })),
        h('b', { class: 'kb-l2', text: `${via} 열기 ›` }),
      ),
    );
    const x = h('button', { type: 'button', class: 'kb-x', 'aria-label': '안내 닫기' });
    x.innerHTML = CLOSE;
    const el = h('div', { class: 'kband' }, go, x);
    go.addEventListener('click', () => {
      track('band');
      if (!kakao) return guide(bandEnv); // 확인용 주소로 카톡 밖에서 본 띠: 넘어갈 곳이 없으니 안내만
      const target = withCarry(win.location.href, d.saved.wanted());
      d.openUrl(env === 'kakao-android' ? chromeIntentUrl(target) : kakaoExternalUrl(target));
      win.setTimeout(() => doc.visibilityState === 'visible' && guide(), d.waitMs);
    });
    x.addEventListener('click', () => {
      setFlag({ bandClosed: true });
      track('band-close');
      el.remove();
    });
    band = el;
  }

  return {
    band,
    card() {
      const img = h('img', { class: 'ic', src: ICON, alt: '', width: '48', height: '48' });
      const b = h('button', { class: 'home-add', type: 'button' }, img, h('span', {}, h('b', { text: '홈 화면에 두기' }), h('span', { text: '앱처럼 바로 열려요.' })));
      b.hidden = env === 'standalone';
      b.addEventListener('click', () => {
        track('card');
        void install();
      });
      return b;
    },
    afterSave(on) {
      if (kakao) {
        syncCarry();
        return false;
      }
      if (!on || (env !== 'chrome' && env !== 'samsung')) return false;
      const f = flags();
      // 한 번 거절한 사람(띠 ✕, 설치 창 취소)에게는 다시 묻지 않음(D37)
      if (f.sheetShown || f.installed || f.bandClosed || f.promptDismissed) return false;
      setFlag({ sheetShown: true }); // 한 번만(닫는 방법과 상관없이)
      const ok = h('p', { class: 'a2-ok' });
      ok.innerHTML = `${CHECK}<span>저장했어요</span>`;
      const add = h('button', { type: 'button', class: 'btn fill', text: '홈 화면에 두기' });
      const later = h('button', { type: 'button', class: 'a2-later', text: '괜찮아요' });
      const s = sheet('저장했어요', [
        h('img', { class: 'a2-icon', src: ICON, alt: '', width: '64', height: '64' }),
        ok,
        h('h2', { class: 'a2-ttl' }, h('span', { class: 'nowrap', text: '홈 화면에 두면' }), ' ', h('span', { class: 'nowrap', text: '저장한 곳을 바로 열 수 있어요' })),
        add,
        later,
      ]);
      track('save-sheet');
      add.addEventListener('click', () => {
        track('save-sheet-add');
        void install();
      });
      later.addEventListener('click', () => s.close());
      return true;
    },
    destroy() {
      open?.close();
      win.removeEventListener('appinstalled', onInstalled);
    },
  };
}
