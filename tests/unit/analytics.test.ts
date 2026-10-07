// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyCohortParam, applyMeParam, createUmamiTracker, firstMonth, launchMode, shareUrl, SITE_ID, tagFor } from '../../src/analytics';
import { createSafeStore } from '../../src/storage/safeStorage';

/** 사용 통계(Umami) — docs/analytics.md, 기획 측정 계획 7장 */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const blocked: Storage = {
  length: 0,
  clear() { throw new Error('blocked'); },
  getItem() { throw new Error('blocked'); },
  key() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

describe('웹사이트 ID와 꼬리표(무료 계정은 사이트 1개 — 10/4 사용자)', () => {
  it('베타·미리보기가 ID 하나를 같이 씀', () => {
    expect(SITE_ID).toBe('84ee01a2-a3bf-43cc-aec5-9368dcd23fa7');
  });
  it('주소가 /next/ 로 시작하면 꼬리표 preview, 아니면 beta(D45) — 새 주소 imamttae.site(D64)와 옛 /imamttae/ 둘 다', () => {
    expect(tagFor('/next/')).toBe('preview');
    expect(tagFor('/next/index.html')).toBe('preview');
    expect(tagFor('/')).toBe('beta');
    expect(tagFor('/s/s-1/')).toBe('beta');
    expect(tagFor('/imamttae/next/')).toBe('preview');
    expect(tagFor('/imamttae/')).toBe('beta');
    expect(tagFor('/nextday/')).toBe('beta');
  });
});

describe('초대 묶음(?in=): 1차(지인)·2차(밴드 등)를 나눠 봄(D45)', () => {
  const mem = () => {
    const m = new Map<string, unknown>();
    return { get: <T,>(k: string, d: T) => (m.has(k) ? (m.get(k) as T) : d), set: (k: string, v: unknown) => (m.set(k, v), true), del: (k: string) => void m.delete(k), m };
  };
  const at = (url: string) => {
    window.history.replaceState(null, '', url);
    return window;
  };
  it('?in=band → 이 휴대폰에 기억하고 주소에서 지움(다시 공유돼도 섞이지 않게)', () => {
    const store = mem();
    expect(applyCohortParam(at('/imamttae/?in=band#/month/10'), store as never)).toBe('band');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/month/10');
    expect(applyCohortParam(at('/imamttae/'), store as never)).toBe('band'); // 다음에 열어도
  });
  it('처음 들어온 묶음을 지킴(나중에 다른 초대 주소로 들어와도 바꾸지 않음)', () => {
    const store = mem();
    applyCohortParam(at('/imamttae/?in=friends'), store as never);
    expect(applyCohortParam(at('/imamttae/?in=band'), store as never)).toBe('friends');
  });
  it('모양이 이상한 값은 무시(영문 소문자·숫자·- 20자까지)', () => {
    const store = mem();
    expect(applyCohortParam(at('/imamttae/?in=<b>'), store as never)).toBeNull();
    expect(applyCohortParam(at('/imamttae/?in=' + 'a'.repeat(21)), store as never)).toBeNull();
  });
  it('초대 주소가 아니면 없음', () => {
    expect(applyCohortParam(at('/imamttae/'), mem() as never)).toBeNull();
  });
});

describe('열린 방식(mode)', () => {
  const win = (ua: string, standalone = false) =>
    ({ navigator: { userAgent: ua, standalone }, matchMedia: (q: string) => ({ matches: standalone && q.includes('standalone') }) }) as unknown as Window;
  it('홈 화면 앱 / 카카오톡 안 / 그 밖 브라우저', () => {
    expect(launchMode(win('Mozilla/5.0 (iPhone) Safari', true))).toBe('home-screen');
    expect(launchMode(win('Mozilla/5.0 (Linux; Android 14) KAKAOTALK 10.8.1'))).toBe('kakao-inapp');
    expect(launchMode(win('Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile'))).toBe('browser');
  });
});

describe('처음 연 달(D27)', () => {
  it('처음이면 이번 달(한국 날짜)을 적고 returning=false, 다음 달에 열면 returning=true', () => {
    const store = createSafeStore(() => memoryStorage());
    expect(firstMonth(store, new Date('2026-10-31T16:00:00Z'))).toEqual({ first_month: '2026-11', returning: false, blocked: false });
    expect(firstMonth(store, new Date('2026-11-20T00:00:00Z'))).toEqual({ first_month: '2026-11', returning: false, blocked: false });
    expect(firstMonth(store, new Date('2026-12-01T00:00:00Z'))).toEqual({ first_month: '2026-11', returning: true, blocked: false });
  });
  it('저장이 막히면 first_month=none, returning=false, blocked=true', () => {
    expect(firstMonth(createSafeStore(() => blocked), new Date('2026-10-04T00:00:00Z'))).toEqual({ first_month: 'none', returning: false, blocked: true });
  });
});

describe('공유 주소', () => {
  it('D63: 장면 공유 페이지 주소(s/<번호>/)에 ?from=share 만 붙이고, utm_*·me 같은 꼬리표는 뺌', () => {
    const loc = new URL('https://lucubrate1231.github.io/imamttae/next/?utm_source=band&me=off&map=fake#/month/10');
    expect(shareUrl(loc, 's-005-biryong')).toBe('https://lucubrate1231.github.io/imamttae/next/s/s-005-biryong/?from=share');
    expect(shareUrl(new URL('https://lucubrate1231.github.io/imamttae/index.html#/scene/a'), 's-1')).toBe('https://lucubrate1231.github.io/imamttae/s/s-1/?from=share');
  });
});

describe('우리 식구 빼기(?me=off / ?me=on)', () => {
  beforeEach(() => {
    window.localStorage.removeItem('umami.disabled');
    window.history.replaceState(null, '', '/imamttae/');
  });
  it('?me=off 면 umami.disabled를 넣고 알리며, 주소에서 me를 지움(# 뒤는 그대로)', () => {
    window.history.replaceState(null, '', '/imamttae/?me=off&from=share#/month/10');
    const said: string[] = [];
    applyMeParam(window, (m) => said.push(m));
    expect(window.localStorage.getItem('umami.disabled')).toBe('1');
    expect(said).toEqual(['이 브라우저는 통계에서 빠졌어요']);
    expect(window.location.search).toBe('?from=share');
    expect(window.location.hash).toBe('#/month/10');
  });
  it('?me=on 이면 다시 넣음', () => {
    window.localStorage.setItem('umami.disabled', '1');
    window.history.replaceState(null, '', '/imamttae/?me=on');
    const said: string[] = [];
    applyMeParam(window, (m) => said.push(m));
    expect(window.localStorage.getItem('umami.disabled')).toBeNull();
    expect(said).toEqual(['이 브라우저는 다시 통계에 들어가요']);
    expect(window.location.search).toBe('');
  });
  it('me가 없으면 아무것도 안 함', () => {
    const said: string[] = [];
    applyMeParam(window, (m) => said.push(m));
    expect(said).toEqual([]);
  });
});

describe('Umami 추적기', () => {
  // 시험 환경이 실제로 스크립트를 내려받지 않게, 붙이는 동작을 잡아 둠
  let script: HTMLScriptElement | null = null;
  const attach = (s: HTMLScriptElement) => (script = s);
  beforeEach(() => {
    script = null;
    delete (window as unknown as { umami?: unknown }).umami;
  });

  it('웹사이트 ID가 없으면 스크립트를 부르지 않고, 무엇을 불러도 조용함', () => {
    const t = createUmamiTracker(window, { siteId: '', tag: 'preview', host: 'lucubrate1231.github.io', attach });
    t.pageview('/imamttae/#/find');
    t.track('navi', { app: 'tmap' });
    t.load();
    expect(script).toBeNull();
  });

  it('github.io가 아닌 곳(내 컴퓨터·화면 테스트)에서는 ID가 있어도 스크립트를 부르지 않음', () => {
    const t2 = createUmamiTracker(window, { siteId: 'P-ID', tag: 'alpha', host: 'localhost', attach });
    t2.load();
    expect(script).toBeNull();
  });

  it('ID가 있으면 늦게(defer) 스크립트를 붙임: 앱 주소(imamttae.site · 옛 github.io)에서만, 자동 화면 조회는 끔', () => {
    const t = createUmamiTracker(window, { siteId: 'P-ID', tag: 'preview', host: 'lucubrate1231.github.io', attach });
    t.load();
    const s = script!;
    expect(s.src).toBe('https://cloud.umami.is/script.js');
    expect(s.defer).toBe(true);
    expect(s.getAttribute('data-website-id')).toBe('P-ID');
    expect(s.getAttribute('data-domains')).toBe('imamttae.site,lucubrate1231.github.io');
    expect(s.getAttribute('data-auto-track')).toBe('false');
    expect(s.getAttribute('data-tag')).toBe('preview');
  });

  it('D64: 새 주소 imamttae.site에서도 스크립트를 붙이고, 다른 주소(내 컴퓨터 등)에서는 붙이지 않음', () => {
    for (const [host, on] of [['imamttae.site', true], ['www.imamttae.site', false], ['localhost', false]] as const) {
      script = null;
      createUmamiTracker(window, { siteId: 'P-ID', tag: 'beta', host, attach }).load();
      expect(script !== null, host).toBe(on);
    }
  });

  it('스크립트가 오기 전 사건은 줄 세웠다가, 오면 순서대로 보냄(app-open이 사라지지 않게)', () => {
    const sent: unknown[][] = [];
    const t = createUmamiTracker(window, { siteId: 'P-ID', tag: 'preview', host: 'lucubrate1231.github.io', attach });
    t.load();
    t.pageview('/imamttae/#/month/10');
    t.track('app-open', { mode: 'browser' });
    (window as unknown as { umami: unknown }).umami = { track: (...a: unknown[]) => sent.push(a) };
    script!.dispatchEvent(new Event('load'));
    t.track('navi', { app: 'tmap' });
    expect(sent.map((a) => (typeof a[0] === 'function' ? (a[0] as (p: object) => { url: string })({}).url : a[0]))).toEqual(['/imamttae/#/month/10', 'app-open', 'navi']);
    expect(sent[1]![1]).toEqual({ mode: 'browser' });
  });

  it('스크립트를 못 불러오면(광고 차단 등) 줄을 비우고 앱은 그대로', () => {
    const t = createUmamiTracker(window, { siteId: 'P-ID', tag: 'preview', host: 'lucubrate1231.github.io', attach });
    t.load();
    t.track('app-open', {});
    script!.dispatchEvent(new Event('error'));
    expect(() => t.track('navi', {})).not.toThrow();
  });
});
