// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMeParam, createUmamiTracker, firstMonth, launchMode, shareUrl, siteIdFor } from '../../src/analytics';
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

describe('웹사이트 ID 고르기', () => {
  const ids = { alpha: 'A-ID', preview: 'P-ID' };
  it('주소가 /imamttae/next/ 로 시작하면 미리보기 ID, 아니면 알파 ID', () => {
    expect(siteIdFor('/imamttae/next/', ids)).toBe('P-ID');
    expect(siteIdFor('/imamttae/next/index.html', ids)).toBe('P-ID');
    expect(siteIdFor('/imamttae/', ids)).toBe('A-ID');
  });
  it('ID가 비어 있으면 빈 값(아무것도 안 보냄)', () => {
    expect(siteIdFor('/imamttae/', { alpha: '', preview: '' })).toBe('');
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
  it('장면 주소에 ?from=share 만 붙이고, utm_*·me 같은 꼬리표는 뺌', () => {
    const loc = new URL('https://lucubrate1231.github.io/imamttae/next/?utm_source=band&me=off&map=fake#/month/10');
    expect(shareUrl(loc, 's-005-biryong')).toBe('https://lucubrate1231.github.io/imamttae/next/?from=share#/scene/s-005-biryong');
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
    const t = createUmamiTracker(window, { siteId: '', attach });
    t.pageview('/imamttae/#/find');
    t.track('navi', { app: 'tmap' });
    t.load();
    expect(script).toBeNull();
  });

  it('ID가 있으면 늦게(defer) 스크립트를 붙임: github.io에서만, 자동 화면 조회는 끔', () => {
    const t = createUmamiTracker(window, { siteId: 'P-ID', attach });
    t.load();
    const s = script!;
    expect(s.src).toBe('https://cloud.umami.is/script.js');
    expect(s.defer).toBe(true);
    expect(s.getAttribute('data-website-id')).toBe('P-ID');
    expect(s.getAttribute('data-domains')).toBe('lucubrate1231.github.io');
    expect(s.getAttribute('data-auto-track')).toBe('false');
  });

  it('스크립트가 오기 전 사건은 줄 세웠다가, 오면 순서대로 보냄(app-open이 사라지지 않게)', () => {
    const sent: unknown[][] = [];
    const t = createUmamiTracker(window, { siteId: 'P-ID', attach });
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
    const t = createUmamiTracker(window, { siteId: 'P-ID', attach });
    t.load();
    t.track('app-open', {});
    script!.dispatchEvent(new Event('error'));
    expect(() => t.track('navi', {})).not.toThrow();
  });
});
