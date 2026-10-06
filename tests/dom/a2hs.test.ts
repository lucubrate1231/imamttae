// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore, type SafeStore } from '../../src/storage/safeStorage';
import { createSavedStore, type SavedStore } from '../../src/storage/saved';
import type { EventData, EventName, Tracker } from '../../src/analytics';
import type { InstallEvent } from '../../src/pwa';
import { HOME_SCENES } from '../fixtures/homeScenes';

/**
 * 홈 화면에 두기(F5, D33) — design-guide 11장, 글자 10-6
 * 오늘 = 한국 날짜 2026년 10월 1일
 */
const OCT1 = new Date('2026-09-30T16:00:00Z');
const UA = {
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 KAKAOTALK/25.8.0',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 25.8.0',
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125 Mobile Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}

let root: HTMLElement;
let storage: Storage;
let store: SafeStore;
let saved: SavedStore;
let opened: string[];
let events: [EventName, EventData | undefined][];
let prompt: InstallEvent | null;
const tracker: Tracker = { load() {}, pageview() {}, track: (n, d) => void events.push([n, d]) };

function fakePrompt(outcome = 'accepted'): InstallEvent & { prompt: ReturnType<typeof vi.fn> } {
  return Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) });
}

async function start(ua: string, hash = '#/', o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({
    root,
    map: createListMap(),
    content: HOME_SCENES,
    now: OCT1,
    ua,
    openUrl: (u) => void opened.push(u),
    store,
    saved,
    tracker,
    motion: false,
    installPrompt: () => prompt,
    kakaoWaitMs: 0,
    ...o,
  });
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.trim() ?? '';
const btn = (scope: string, label: string) => [...root.querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === label);
const go = (hash: string) => {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
};
const saveIn = (id: string) => {
  go(`#/scene/${id}`);
  q<HTMLButtonElement>('.detail .dact[aria-pressed]')!.click();
};
const tick = () => new Promise((r) => setTimeout(r, 5));
const a2hsEvents = () => events.filter(([n]) => n === 'a2hs').map(([, d]) => d);

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, '', '/');
  window.location.hash = '';
  root = document.getElementById('app')!;
  storage = memoryStorage();
  store = createSafeStore(() => storage);
  saved = createSavedStore(store, () => OCT1);
  opened = [];
  events = [];
  prompt = null;
});
afterEach(() => {
  Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
});

describe('F5-AC4: 카톡 안 첫 화면 맨 위 띠', () => {
  it('안드로이드: 머리 바로 위에 "크롬으로 열면 앱처럼 쓸 수 있어요 / 크롬으로 열기 ›" — 첫 화면에만', async () => {
    await start(UA.kakaoAndroid);
    const band = q('main.home .kband')!;
    expect(band).not.toBeNull();
    expect(band.nextElementSibling!.matches('.eyebrow')).toBe(true);
    expect(text('.kband .kb-l1')).toBe('크롬으로 열면 앱처럼 쓸 수 있어요');
    expect(text('.kband .kb-l2')).toBe('크롬으로 열기 ›');
    // 디자인 #64: 띠 맨 앞에 앱 아이콘(32px, 장식), 글 두 줄은 한 덩어리
    const icon = q<HTMLImageElement>('.kband .kb-go img.kb-ic')!;
    expect(icon.getAttribute('src')).toBe('./brand/icon-192.png');
    expect(icon.getAttribute('alt')).toBe('');
    expect([icon.getAttribute('width'), icon.getAttribute('height')]).toEqual(['32', '32']);
    expect(q('.kband .kb-go')!.firstElementChild).toBe(icon);
    expect(q('.kband .kb-txt .kb-l1')).not.toBeNull();
    expect(q('.kband .kb-go')!.getAttribute('aria-label')).toBe('크롬으로 열기 안내');
    expect(q('.kband .kb-x')!.getAttribute('aria-label')).toBe('안내 닫기');
    expect(root.querySelectorAll('.kband')).toHaveLength(1);
  });

  it('아이폰: "사파리로 열면 … / 사파리로 열기 ›"', async () => {
    await start(UA.kakaoIos);
    expect(text('.kband .kb-l1')).toBe('사파리로 열면 앱처럼 쓸 수 있어요');
    expect(text('.kband .kb-l2')).toBe('사파리로 열기 ›');
  });

  it('안드로이드에서 띠를 누르면 크롬 intent 주소(저장한 장면 번호를 붙임), 넘어가지 못하면 "크롬이 열리지 않았나요?"', async () => {
    saved.toggleWanted('s-naejang');
    await start(UA.kakaoAndroid);
    q('.kband .kb-go')!.click();
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^intent:\/\/[^#]+carry=s-naejang[^#]*#Intent;scheme=https;package=com\.android\.chrome;/);
    await tick();
    const s = q('.a2sheet')!;
    expect(s.getAttribute('role')).toBe('dialog');
    expect(s.getAttribute('aria-label')).toBe('크롬이 열리지 않았나요?');
    expect(text('.a2sheet .a2-desc')).toBe('카카오톡 메뉴로 열 수 있어요.');
    expect(root.querySelectorAll('.a2sheet .a2-step')).toHaveLength(2);
    expect(text('.a2sheet .a2-step:nth-child(1) .a2-txt')).toContain("화면 오른쪽 [⋮] 버튼을 누르세요");
    btn('.a2sheet', '알겠어요')!.click();
    expect(q('.a2sheet')).toBeNull();
    expect(a2hsEvents()).toEqual([{ action: 'band', env: 'kakao-android' }, { action: 'guide', env: 'kakao-android' }]);
  });

  it('아이폰에서 띠를 누르면 카톡 바깥 브라우저 주소(사파리)', async () => {
    await start(UA.kakaoIos);
    q('.kband .kb-go')!.click();
    expect(opened[0]).toMatch(/^kakaotalk:\/\/web\/openExternal\?url=https?%3A/);
    await tick();
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('사파리가 열리지 않았나요?');
  });

  it('✕로 닫으면 이 브라우저에서는 다시 띄우지 않음(새로 열어도)', async () => {
    const app = await start(UA.kakaoAndroid);
    q('.kband .kb-x')!.click();
    expect(q('.kband')).toBeNull();
    app.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    await start(UA.kakaoAndroid);
    expect(q('.kband')).toBeNull();
  });

  it('카톡 안에서 [홈 화면에 두기] 카드를 눌러도 같은 안내', async () => {
    await start(UA.kakaoAndroid);
    q('main.home .home-add')!.click();
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('크롬이 열리지 않았나요?');
  });

  it('카톡 안에서 저장하면 지금 주소에 장면 번호를 붙여 둠(카톡 메뉴로 넘어가도 함께 가게) — 안내 줄은 그대로', async () => {
    await start(UA.kakaoAndroid);
    saveIn('s-naejang');
    expect(window.location.search).toBe('?carry=s-naejang');
    expect(text('.toast')).toContain('저장했어요');
    q<HTMLButtonElement>('.detail .dact[aria-pressed]')!.click(); // 다시 눌러 뺌
    expect(window.location.search).toBe('');
  });

  it('크롬 쪽에서 받은 장면 번호는 저장한 곳에 합치고 주소에서 지움', async () => {
    window.history.replaceState(null, '', '/?carry=s-naejang,s-baekmu,%3Cx%3E');
    await start(UA.chrome);
    expect(saved.wanted().sort()).toEqual(['s-baekmu', 's-naejang']);
    expect(window.location.search).toBe('');
  });
});

describe('띠 확인용 주소 ?band=show(10/5 사용자 — 닫은 뒤에도 띠를 다시 보려고)', () => {
  it('카톡 안에서 띠를 닫았어도 ?band=show로 열면 다시 보이고, 닫음 표시는 그대로', async () => {
    storage.setItem('imamttae:a2hs', JSON.stringify({ bandClosed: true }));
    window.history.replaceState(null, '', '/?band=show');
    await start(UA.kakaoAndroid);
    expect(text('.kband .kb-l1')).toBe('크롬으로 열면 앱처럼 쓸 수 있어요');
    expect(JSON.parse(storage.getItem('imamttae:a2hs')!).bandClosed).toBe(true);
  });

  it('?band=show 없이 열면 닫은 띠는 그대로 숨음', async () => {
    storage.setItem('imamttae:a2hs', JSON.stringify({ bandClosed: true }));
    await start(UA.kakaoAndroid);
    expect(q('.kband')).toBeNull();
  });

  it('카톡이 아닌 브라우저에서도 ?band=show면 띠 모양을 보여 줌 — 아이폰은 사파리, 그 밖은 크롬', async () => {
    window.history.replaceState(null, '', '/?band=show');
    await start(UA.safari);
    expect(text('.kband .kb-l1')).toBe('사파리로 열면 앱처럼 쓸 수 있어요');
  });

  it('카톡이 아닌 곳(PC)에서 띠를 누르면 넘어가지 않고 "크롬이 열리지 않았나요?" 안내를 바로 보여 줌', async () => {
    window.history.replaceState(null, '', '/?band=show');
    await start(UA.pc);
    q('.kband .kb-go')!.click();
    expect(opened).toEqual([]);
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('크롬이 열리지 않았나요?');
  });
});

describe('D37(디자인 #72·#101): 안드로이드 크롬·삼성 인터넷도 첫 방문부터 "앱으로 설치하기" 띠', () => {
  it('안드로이드 크롬 첫 화면 맨 위: "앱으로 설치하면 바로 열 수 있어요 / 앱으로 설치하기 ›"(10/6 — 크롬 말 \'앱 설치\'에 맞춤), 모양은 카톡 띠와 같음', async () => {
    await start(UA.chrome);
    const band = q('main.home > .kband')!;
    expect(band).not.toBeNull();
    expect(band.nextElementSibling!.matches('.eyebrow')).toBe(true);
    expect(text('.kband .kb-l1')).toBe('앱으로 설치하면 바로 열 수 있어요');
    expect(text('.kband .kb-l2')).toBe('앱으로 설치하기 ›');
    expect(q('.kband .kb-go')!.getAttribute('aria-label')).toBe('앱으로 설치하기 안내');
    expect(q('.kband img.kb-ic')).not.toBeNull();
  });

  it('삼성 인터넷도 같은 띠, PC 크롬·아이폰 사파리에는 없음', async () => {
    const app = await start(UA.samsung);
    expect(text('.kband .kb-l2')).toBe('앱으로 설치하기 ›');
    app.destroy();
    for (const ua of [UA.pc, UA.safari]) {
      document.body.innerHTML = '<div id="app"></div>';
      root = document.getElementById('app')!;
      const a = await start(ua);
      expect(q('.kband')).toBeNull();
      a.destroy();
    }
  });

  it('띠를 누르면 설치 창(준비돼 있으면), 없으면 그 브라우저 그림 안내 — 띠는 그대로 남음', async () => {
    const p = fakePrompt('accepted');
    prompt = p;
    await start(UA.chrome);
    q('.kband .kb-go')!.click();
    expect(p.prompt).toHaveBeenCalledTimes(1);
    expect(q('.kband')).not.toBeNull();
    prompt = null;
    q('.kband .kb-go')!.click();
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('앱으로 설치하는 방법');
    btn('.a2sheet', '알겠어요')!.click();
    expect(q('.kband')).not.toBeNull(); // 그림 안내 [알겠어요]로는 닫히지 않음
    expect(a2hsEvents()).toContainEqual({ action: 'band', env: 'chrome' });
  });

  it('설치 창에서 [취소]해도 띠는 남고, 그 뒤 처음 [저장]에는 판을 띄우지 않음(한 번 거절한 사람에게 다시 묻지 않음)', async () => {
    prompt = fakePrompt('dismissed');
    await start(UA.chrome);
    q('.kband .kb-go')!.click();
    await tick();
    expect(q('.kband')).not.toBeNull();
    expect(JSON.parse(storage.getItem('imamttae:a2hs')!).promptDismissed).toBe(true);
    saveIn('s-naejang');
    expect(q('.a2sheet')).toBeNull();
    expect(text('.toast')).toContain('저장했어요');
  });

  it('✕로 닫으면 다시 안 뜨고, 그 뒤 처음 [저장]에도 판을 띄우지 않음', async () => {
    const app = await start(UA.chrome);
    q('.kband .kb-x')!.click();
    expect(q('.kband')).toBeNull();
    saveIn('s-naejang');
    expect(q('.a2sheet')).toBeNull();
    app.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    await start(UA.chrome);
    expect(q('.kband')).toBeNull();
  });

  it('설치를 마치면 띠가 사라지고, 다음에 열어도 없음', async () => {
    const app = await start(UA.chrome);
    window.dispatchEvent(new Event('appinstalled'));
    expect(q('.kband')).toBeNull();
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('설치됐어요'); // 설치 직후 판(아래 F5-AC8)
    app.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    await start(UA.chrome);
    expect(q('.kband')).toBeNull();
  });

  it('확인용 주소: ?band=show는 닫은 새 띠도 보여 주고, ?band=chrome은 아이폰에서도 새 띠를 흉내(누르면 크롬 그림 안내)', async () => {
    storage.setItem('imamttae:a2hs', JSON.stringify({ bandClosed: true }));
    window.history.replaceState(null, '', '/?band=show');
    const app = await start(UA.chrome);
    expect(text('.kband .kb-l2')).toBe('앱으로 설치하기 ›');
    app.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    window.history.replaceState(null, '', '/?band=chrome');
    await start(UA.safari);
    expect(text('.kband .kb-l2')).toBe('앱으로 설치하기 ›');
    q('.kband .kb-go')!.click();
    expect(text('.a2sheet .a2-desc')).toBe('크롬 메뉴로 할 수 있어요.');
  });
});

describe('F5-AC6: 크롬·삼성 인터넷에서 처음 [저장] 직후 한 번', () => {
  it('크롬: 안내 줄 대신 판 — 앱 아이콘 · 저장했어요 · 문장 · [앱으로 설치하기] · [괜찮아요]', async () => {
    await start(UA.chrome);
    saveIn('s-naejang');
    const s = q('.a2sheet')!;
    expect(s.getAttribute('aria-label')).toBe('저장했어요');
    expect(s.querySelector<HTMLImageElement>('img.a2-icon')!.getAttribute('src')).toBe('./brand/icon-192.png');
    expect(text('.a2sheet .a2-ok')).toBe('저장했어요');
    expect(text('.a2sheet .a2-ttl')).toBe('앱으로 설치하면 저장한 곳을 바로 열 수 있어요');
    expect(btn('.a2sheet', '앱으로 설치하기')).toBeTruthy();
    expect(btn('.a2sheet', '괜찮아요')).toBeTruthy();
    expect(q('.toast.on')).toBeNull();
    btn('.a2sheet', '괜찮아요')!.click();
    expect(q('.a2sheet')).toBeNull();
    saveIn('s-baekmu'); // 두 번째는 안내 줄
    expect(q('.a2sheet')).toBeNull();
    expect(text('.toast')).toContain('저장했어요');
  });

  it('[앱으로 설치하기]: 크롬 설치 창이 준비돼 있으면 그 창, 설치하면 설치 직후 판', async () => {
    const p = fakePrompt();
    prompt = p;
    await start(UA.chrome);
    saveIn('s-naejang');
    btn('.a2sheet', '앱으로 설치하기')!.click();
    expect(p.prompt).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('appinstalled'));
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('설치됐어요');
    expect(a2hsEvents()).toContainEqual({ action: 'installed', env: 'chrome' });
  });

  it('[앱으로 설치하기]: 설치 창이 없으면 크롬 그림 안내(세 단계) — ② \'앱 설치\' 먼저, \'홈 화면에 추가\'는 보충(10/6)', async () => {
    await start(UA.chrome);
    saveIn('s-naejang');
    btn('.a2sheet', '앱으로 설치하기')!.click();
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('앱으로 설치하는 방법');
    expect(text('.a2sheet .a2-gttl')).toBe('앱으로 설치하는 방법');
    expect(text('.a2sheet .a2-desc')).toBe('크롬 메뉴로 할 수 있어요.');
    const steps = [...root.querySelectorAll('.a2sheet .a2-step')];
    expect(steps).toHaveLength(3);
    expect(steps[1]!.querySelector('.a2-txt')!.textContent).toBe("'앱 설치'를 누르세요");
    expect(steps[1]!.querySelector('.a2-sub')!.textContent).toBe("'홈 화면에 추가'로 보일 수도 있어요.");
    expect([...steps[1]!.querySelectorAll('.a2-pic .a2-row')].map((r) => r.textContent)).toEqual(['페이지에서 찾기', '앱 설치', '데스크톱 사이트']);
    expect(steps[1]!.querySelector('.a2-pic .a2-row.a2-hit')!.textContent).toBe('앱 설치');
  });

  it('삼성 인터넷도 처음 저장 직후 판, 버튼은 삼성 인터넷 그림 안내', async () => {
    await start(UA.samsung);
    saveIn('s-naejang');
    btn('.a2sheet', '앱으로 설치하기')!.click();
    expect(text('.a2sheet .a2-gttl')).toBe('앱으로 설치하는 방법');
    expect(text('.a2sheet .a2-desc')).toBe('삼성 인터넷 메뉴로 할 수 있어요.');
  });

  it('아이폰 사파리에서는 판을 띄우지 않음(안내 줄), 카드는 사파리 그림 안내', async () => {
    await start(UA.safari);
    saveIn('s-naejang');
    expect(q('.a2sheet')).toBeNull();
    expect(text('.toast')).toContain('저장했어요');
    go('#/');
    q('main.home .home-add')!.click();
    expect(text('.a2sheet .a2-gttl')).toBe('홈 화면에 두는 방법'); // 아이폰은 그대로
    expect(text('.a2sheet .a2-desc')).toBe('사파리 공유 버튼으로 할 수 있어요.');
    // 디자인 #62: 공유 버튼은 자리 대신 모양으로(아이폰 판·배치마다 자리가 달라서)
    const steps = [...root.querySelectorAll('.a2sheet .a2-step')];
    expect(steps).toHaveLength(3);
    const s1 = steps[0]!;
    expect(s1.querySelector('.a2-txt')!.textContent).toBe("'공유' 버튼을 누르세요");
    expect(s1.querySelector('.a2-txt .a2-key svg')).not.toBeNull(); // 글 안의 공유 모양 열쇠(장식)
    expect(s1.querySelector('.a2-txt .a2-key')!.getAttribute('aria-hidden')).toBe('true');
    expect(s1.querySelector('.a2-sub')!.textContent).toBe('안 보이면 주소창 옆 [⋯] 버튼을 먼저 누르세요.');
    expect(s1.querySelector('.a2-pic.icon svg')).not.toBeNull(); // 그림은 공유 모양 하나만
    expect(s1.querySelector('.a2-pic .a2-bar')).toBeNull();
    expect([...steps[1]!.querySelectorAll('.a2-pic .a2-row')].map((r) => r.textContent)).toEqual(['북마크에 추가', '페이지에서 찾기', '홈 화면에 추가']);
    expect(steps[1]!.querySelector('.a2-pic .a2-row.a2-hit svg')).not.toBeNull(); // '홈 화면에 추가' 줄의 ⊕ 네모
    expect(steps[2]!.querySelector('.a2-sub')!.textContent).toBe("'웹 앱으로 열기'가 보이면 켠 채로 두세요.");
    expect(steps[2]!.querySelector('.a2-pic .a2-switch')).not.toBeNull();
  });

  it('덮개를 눌러 닫아도 다시 띄우지 않음(새로 열어도)', async () => {
    const app = await start(UA.chrome);
    saveIn('s-naejang');
    q('.a2scrim')!.click();
    expect(q('.a2sheet')).toBeNull();
    app.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    await start(UA.chrome);
    saveIn('s-baekmu');
    expect(q('.a2sheet')).toBeNull();
  });
});

describe('F5-AC5·11-5: 카드와 홈 화면 아이콘으로 연 경우', () => {
  it('카드: 앱 아이콘 + 안드로이드·PC "앱으로 설치하기 / 앱처럼 바로 열려요."(10/6) — 첫 화면 맨 아래와 저장한 곳 맨 아래', async () => {
    await start(UA.chrome);
    const card = q('main.home .home-add')!;
    expect(card.querySelector<HTMLImageElement>('img')!.getAttribute('src')).toBe('./brand/icon-192.png');
    expect(card.textContent).toBe('앱으로 설치하기앱처럼 바로 열려요.');
    go('#/saved');
    expect(q('.saved .home-add')!.textContent).toBe('앱으로 설치하기앱처럼 바로 열려요.');
  });

  it('카드 이름은 브라우저 말에 맞춤: 아이폰(사파리·카톡) "홈 화면에 두기", 안드로이드(크롬·삼성 인터넷·카톡)·PC "앱으로 설치하기"', async () => {
    const cases: [string, string][] = [
      [UA.safari, '홈 화면에 두기'],
      [UA.kakaoIos, '홈 화면에 두기'],
      [UA.samsung, '앱으로 설치하기'],
      [UA.kakaoAndroid, '앱으로 설치하기'],
      [UA.pc, '앱으로 설치하기'],
    ];
    for (const [ua, name] of cases) {
      document.body.innerHTML = '<div id="app"></div>';
      root = document.getElementById('app')!;
      const a = await start(ua);
      expect(q('main.home .home-add b')!.textContent).toBe(name);
      a.destroy();
    }
  });

  it('홈 화면 아이콘으로 열면 띠·판·카드가 모두 없음', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    await start(UA.kakaoAndroid);
    expect(q('.kband')).toBeNull();
    expect(q<HTMLElement>('main.home .home-add')!.hidden).toBe(true);
    saveIn('s-naejang');
    expect(q('.a2sheet')).toBeNull();
    go('#/saved');
    expect(q<HTMLElement>('.saved .home-add')!.hidden).toBe(true);
  });

  it('그림 안내 판은 Esc로 닫히고, 열리면 판에 초점', async () => {
    await start(UA.safari);
    q('main.home .home-add')!.click();
    expect(document.activeElement).toBe(q('.a2sheet'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('.a2sheet')).toBeNull();
  });
});

describe('F5-AC8(디자인 #101, 10/6): 설치를 마친 직후', () => {
  it('안드로이드 크롬: 판 한 번 — 앱 아이콘 · 설치됐어요 · "휴대폰 앱 목록에 \'이맘때\'가 생겼어요" · 홈 화면에 꺼내는 두 단계 · [알겠어요]', async () => {
    await start(UA.chrome);
    window.dispatchEvent(new Event('appinstalled'));
    const s = q('.a2sheet')!;
    expect(s.getAttribute('aria-label')).toBe('설치됐어요');
    expect(s.querySelector('img.a2-icon')).not.toBeNull();
    expect(text('.a2sheet .a2-ok')).toBe('설치됐어요');
    expect(text('.a2sheet .a2-ttl')).toBe("휴대폰 앱 목록에 '이맘때'가 생겼어요");
    expect(text('.a2sheet .a2-if')).toBe('홈 화면에 아이콘이 없으면');
    const steps = [...root.querySelectorAll('.a2sheet .a2-step')];
    expect(steps).toHaveLength(2);
    expect(steps[0]!.querySelector('.a2-txt')!.textContent).toBe("앱 목록에서 '이맘때'를 길게 누르세요");
    expect(steps[0]!.querySelector('.a2-sub')!.textContent).toBe('앱 목록은 홈 화면을 위로 밀면 나와요. 위젯 목록에는 없어요.');
    expect(steps[0]!.querySelectorAll('.a2-pic.apps .a2-app')).toHaveLength(4); // 앱 아이콘 네 칸
    expect(steps[0]!.querySelectorAll('.a2-pic.apps .a2-app.a2-hit')).toHaveLength(1); // '이맘때'만 테두리
    expect(steps[1]!.querySelector('.a2-txt')!.textContent).toBe("'홈 화면에 추가'를 누르세요");
    expect([...steps[1]!.querySelectorAll('.a2-pic .a2-row')].map((r) => r.textContent)).toEqual(['선택', '홈 화면에 추가', '앱 정보']);
    expect(q('.toast.on')).toBeNull();
    expect(a2hsEvents()).toContainEqual({ action: 'installed', env: 'chrome' });
    btn('.a2sheet', '알겠어요')!.click();
    expect(q('.a2sheet')).toBeNull();
  });

  it('다른 판(저장 직후 판)이 열려 있으면 닫고 띄움', async () => {
    await start(UA.chrome);
    saveIn('s-naejang');
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('저장했어요');
    window.dispatchEvent(new Event('appinstalled'));
    expect(root.querySelectorAll('.a2sheet')).toHaveLength(1);
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('설치됐어요');
  });

  it('삼성 인터넷도 같은 판', async () => {
    await start(UA.samsung);
    window.dispatchEvent(new Event('appinstalled'));
    expect(q('.a2sheet')!.getAttribute('aria-label')).toBe('설치됐어요');
  });

  it('PC 크롬: 판 대신 안내 줄 "\'이맘때\'를 앱으로 설치했어요"', async () => {
    await start(UA.pc);
    window.dispatchEvent(new Event('appinstalled'));
    expect(q('.a2sheet')).toBeNull();
    expect(text('.toast')).toBe("'이맘때'를 앱으로 설치했어요");
  });
});
