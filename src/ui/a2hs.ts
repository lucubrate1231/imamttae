/**
 * 홈 화면에 두기(F5, D33) — design-guide 11장, 글자 10-6
 * - 말은 그 브라우저가 쓰는 말에 맞춤(10/6 디자인 #101): 안드로이드·PC '앱으로 설치하기'(크롬 화면이 '앱 설치'), 아이폰 '홈 화면에 두기'
 * - 설치를 마치면(appinstalled) 안드로이드는 '앱 목록에 생겼어요' 판 한 번(갤럭시는 아이콘이 앱 목록에만 생길 수 있음), PC는 안내 줄
 * - 카톡 안: 첫 화면 맨 위 띠 '크롬(사파리)으로 열기' → 넘어가지 못하면 그림 안내
 * - 크롬·삼성 인터넷(설치 전): 처음 [저장] 직후 판 한 번(안내 줄 대신)
 * - 늘 있는 [홈 화면에 두기] 카드(첫 화면·저장한 곳 맨 아래): 설치 창 또는 브라우저별 그림 안내
 * - 홈 화면 아이콘으로 열면 모두 숨김(F5-AC5)
 * - 카톡 안에서 저장하면 주소에 장면 번호(carry)를 붙여 둬, 바깥 브라우저로 넘어가도 저장한 곳이 함께 감. 받는 쪽은 합치고 주소에서 지움
 * 기억하는 것(휴대폰 저장소 'a2hs'): 띠를 닫았나 · 처음 저장 판을 보였나 · 설치했나
 */
import type { Scene } from '../../shared/schema/content';
import type { EventData, EventName } from '../analytics';
import { chromeIntentUrl, kakaoExternalUrl, readCarry, safariUrl, withCarry, type A2hsEnv, type InstallEvent } from '../pwa';
import type { SafeStore } from '../storage/safeStorage';
import type { SavedStore } from '../storage/saved';
import { h } from './dom';

export interface A2hsDeps {
  win: Window;
  env: A2hsEnv;
  /** 안드로이드 휴대폰·태블릿인가(브라우저 이름표에 Android) — 크롬·삼성 인터넷 첫 방문 띠(D37)는 안드로이드에만 */
  android: boolean;
  /** 카톡이 아닌 앱 안 화면이면 어느 앱(그림 안내 설명에 씀, D45) */
  inApp?: 'band' | 'naver' | 'other' | null;
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
  | { kind: 'menu'; item: string; rows?: string[]; after?: string[]; icon?: 'plus' }
  /** 휴대폰 앱 목록: 앱 아이콘 네 칸 중 '이맘때'만 계절 색 테두리(설치 직후 판) */
  | { kind: 'apps' }
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
  // 크롬 메뉴의 말 '앱 설치'를 먼저(10/6 실기기 — 옛 순서의 반대)
  // 밴드·네이버 앱 등(D45 — 공통안, 설명은 앱 이름으로 바꿈: inAppDesc). 메뉴 자리·이름은 실기기 확인 뒤 앱별로
  'inapp-android': {
    title: '크롬이 열리지 않았나요?',
    desc: '이 앱의 메뉴로 열 수 있어요.',
    steps: [
      { t: ['화면 위나 아래의 ', { b: '[⋮]' }, ' 또는 ', { b: '[⋯]' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'tr', sym: '⋮' } },
      { t: ["'", { b: '다른 브라우저로 열기' }, "'를 누르세요"], sub: "'기본 브라우저로 열기'나 'Safari로 열기'로 보일 수도 있어요.", pic: { kind: 'menu', item: '다른 브라우저로 열기', rows: ['링크 복사'], after: ['공유하기'] } },
    ],
  },
  'inapp-ios': {
    title: '사파리가 열리지 않았나요?',
    desc: '이 앱의 메뉴로 열 수 있어요.',
    steps: [
      { t: ['화면 위나 아래의 ', { b: '[⋮]' }, ' 또는 ', { b: '[⋯]' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'tr', sym: '⋯' } },
      { t: ["'", { b: '다른 브라우저로 열기' }, "'를 누르세요"], sub: "'기본 브라우저로 열기'나 'Safari로 열기'로 보일 수도 있어요.", pic: { kind: 'menu', item: '다른 브라우저로 열기', rows: ['링크 복사'], after: ['공유하기'] } },
    ],
  },
  chrome: {
    title: '앱으로 설치하는 방법',
    desc: '크롬 메뉴로 할 수 있어요.',
    steps: [
      { t: ['오른쪽 위 ', { b: '[⋮]' }, ' 버튼을 누르세요'], pic: { kind: 'key', at: 'tr', sym: '⋮' } },
      { t: ["'", { b: '앱 설치' }, "'를 누르세요"], sub: "'홈 화면에 추가'로 보일 수도 있어요.", pic: { kind: 'menu', item: '앱 설치', rows: ['페이지에서 찾기'], after: ['데스크톱 사이트'] } },
      { t: ["'", { b: '설치' }, "'를 누르세요"], pic: { kind: 'dialog', label: '설치' } },
    ],
  },
  samsung: {
    title: '앱으로 설치하는 방법', // 10/6 제목만 — 메뉴 순서는 실기기 확인 뒤
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
    box.append(...p.rows.map((r) => h('span', { class: 'a2-row', text: r })), hit, ...(p.after ?? []).map((r) => h('span', { class: 'a2-row', text: r })));
  } else if (p.kind === 'apps') {
    const me = h('span', { class: 'a2-app a2-hit' }, h('img', { src: ICON, alt: '', width: '18', height: '18' }));
    box.append(h('span', { class: 'a2-app' }), h('span', { class: 'a2-app' }), me, h('span', { class: 'a2-app' }));
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
  // 앱 안 화면(카톡·밴드·네이버 등, D33·D45): 설치할 수 없고 저장이 앱 안에 갇혀 바깥 브라우저로 넘김
  const kakao = env === 'kakao-android' || env === 'kakao-ios' || env === 'inapp-android' || env === 'inapp-ios';
  /** 앱 안 그림 안내의 설명(디자인 #107): 밴드·네이버 앱은 앱 이름, 그 밖은 '이 앱' */
  const inAppDesc = { band: '밴드 메뉴로 열 수 있어요.', naver: '네이버 앱 메뉴로 열 수 있어요.', other: '이 앱의 메뉴로 열 수 있어요.' }[d.inApp ?? 'other'];
  // 카톡 안 띠: 안드로이드는 크롬, 아이폰은 사파리('으로'/'로'가 달라 통째로 둠)
  /**
   * 띠 확인용 주소 ?band=show(10/5 사용자): 닫은 적이 있어도, 카톡이 아니어도 띠를 보여 줌. 닫음 표시는 건드리지 않음.
   * 카톡이 아니면 아이폰 사파리는 아이폰 카톡 띠, 그 밖은 안드로이드 카톡 띠로 흉내 냄
   */
  const previewParam = new URLSearchParams(win.location.search).get('band'); // 'show' | 'chrome'(아이폰에서 안드로이드 띠 흉내)
  const bandPreview = previewParam === 'show';
  /** D37: 안드로이드 크롬·삼성 인터넷(설치 전)은 첫 방문부터 '홈 화면에 두기' 띠 */
  const installCapable = (env === 'chrome' || env === 'samsung') && d.android;
  const bandEnv: 'kakao-android' | 'kakao-ios' | 'inapp-android' | 'inapp-ios' = kakao ? (env as 'kakao-android' | 'kakao-ios' | 'inapp-android' | 'inapp-ios') : env === 'ios-safari' ? 'kakao-ios' : 'kakao-android';
  const bandIos = bandEnv === 'kakao-ios' || bandEnv === 'inapp-ios';
  const via = bandIos ? '사파리로' : '크롬으로';
  /** 카드·저장 판 버튼 이름: 아이폰은 사파리 메뉴 말 '홈 화면에 두기', 안드로이드·PC는 크롬 말에 맞춰 '앱으로 설치하기'(10/6) */
  const addWord = env === 'ios-safari' || env === 'kakao-ios' ? '홈 화면에 두기' : '앱으로 설치하기';

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

  /** 그림 안내 단계(번호 · 글 · 보충 · 작은 그림) */
  function stepList(steps: Step[]): HTMLElement {
    return h(
        'ol',
        { class: 'a2-steps' },
        ...steps.map((st, i) =>
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
      );
  }

  function guide(which: A2hsEnv = env): void {
    if (which === 'standalone') return;
    const base = GUIDES[which];
    const g = which === 'inapp-android' || which === 'inapp-ios' ? { ...base, desc: inAppDesc } : base;
    const ok = h('button', { type: 'button', class: 'btn line a2-done', text: '알겠어요' });
    const s = sheet(g.title, [h('h2', { class: 'a2-gttl', text: g.title }), h('p', { class: 'a2-desc', text: g.desc }), stepList(g.steps), ok]);
    ok.addEventListener('click', () => s.close());
    track('guide');
  }

  /**
   * 설치 직후 판(안드로이드, 디자인 #101 · F5-AC8): 갤럭시는 설치해도 홈 화면에 아이콘이 안 생길 수 있어(앱 목록에만)
   * '홈 화면에 두었어요'라고 단정하지 않고, 앱 목록에 생겼다고 말한 뒤 홈 화면에 꺼내는 법을 알려 줌. 다른 판은 닫고 띄움
   */
  function installedSheet(): void {
    const ok = h('p', { class: 'a2-ok' });
    ok.innerHTML = `${CHECK}<span>설치됐어요</span>`;
    const done = h('button', { type: 'button', class: 'btn line a2-done', text: '알겠어요' });
    const s = sheet('설치됐어요', [
      h('img', { class: 'a2-icon', src: ICON, alt: '', width: '64', height: '64' }),
      ok,
      h('h2', { class: 'a2-ttl' }, h('span', { class: 'nowrap', text: '휴대폰 앱 목록에' }), ' ', h('span', { class: 'nowrap', text: "'이맘때'가 생겼어요" })),
      h('p', { class: 'a2-if', text: '홈 화면에 아이콘이 없으면' }),
      stepList([
        { t: ["앱 목록에서 '", { b: '이맘때' }, "'를 길게 누르세요"], sub: '앱 목록은 홈 화면을 위로 밀면 나와요. 위젯 목록에는 없어요.', pic: { kind: 'apps' } },
        // 길게 누르면 뜨는 메뉴 이름은 휴대폰마다 다를 수 있어 실기기로 맞춤
        { t: ["'", { b: '홈 화면에 추가' }, "'를 누르세요"], pic: { kind: 'menu', item: '홈 화면에 추가', rows: ['선택'], after: ['앱 정보'] } },
      ]),
      done,
    ]);
    done.addEventListener('click', () => s.close());
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
    if (d.android) installedSheet();
    else d.toast("'이맘때'를 앱으로 설치했어요"); // PC 크롬(아이폰은 설치 끝 신호가 없음)
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
      { type: 'button', class: 'kb-go', 'aria-label': '앱으로 설치하기 안내' },
      h('img', { class: 'kb-ic', src: ICON, alt: '', width: '32', height: '32' }),
      h(
        'span',
        { class: 'kb-txt' },
        h('span', { class: 'kb-l1' }, h('span', { class: 'nowrap', text: '앱으로 설치하면' }), ' ', h('span', { class: 'nowrap', text: '바로 열 수 있어요' })),
        h('b', { class: 'kb-l2', text: '앱으로 설치하기 ›' }),
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
      // 안드로이드 앱 안은 크롬을 콕 집는 주소, 카톡 아이폰은 카톡 바깥 브라우저 주소, 다른 앱 아이폰은 사파리 주소(iOS 17부터)
      d.openUrl(env === 'kakao-android' || env === 'inapp-android' ? chromeIntentUrl(target) : env === 'inapp-ios' ? safariUrl(target) : kakaoExternalUrl(target));
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
      const b = h('button', { class: 'home-add', type: 'button' }, img, h('span', {}, h('b', { text: addWord }), h('span', { text: '앱처럼 바로 열려요.' })));
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
      const add = h('button', { type: 'button', class: 'btn fill', text: addWord });
      const later = h('button', { type: 'button', class: 'a2-later', text: '괜찮아요' });
      const s = sheet('저장했어요', [
        h('img', { class: 'a2-icon', src: ICON, alt: '', width: '64', height: '64' }),
        ok,
        h('h2', { class: 'a2-ttl' }, h('span', { class: 'nowrap', text: '앱으로 설치하면' }), ' ', h('span', { class: 'nowrap', text: '저장한 곳을 바로 열 수 있어요' })),
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
