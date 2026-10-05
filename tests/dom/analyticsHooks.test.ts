// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppDeps, type AppHandle } from '../../src/app';
import type { EventData, Tracker } from '../../src/analytics';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore } from '../../src/storage/safeStorage';
import type { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';

/** 통계 사건이 버튼마다 맞게 나가는지 — docs/analytics.md 2장 '지금' 줄 */
const OCT = new Date('2026-10-03T03:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
let root: HTMLElement;
let log: [string, EventData | string | undefined][];
let opened: string[];
const tracker: Tracker = {
  load() {},
  pageview: (u) => log.push(['page', u]),
  track: (n, d) => log.push([n, d]),
};
const content = appData as ContentFile;
const story = content.scenes.find((s) => s.kind === 'story' && s.best && s.types.includes('danpung'))!;

let apps: AppHandle[] = [];
async function start(hash: string, o: Partial<AppDeps> = {}) {
  apps.forEach((a) => a.destroy()); // 앞에서 만든 앱이 화면 이동을 함께 세지 않게
  apps = [];
  window.history.replaceState(null, '', `/imamttae/${hash}`);
  const app = await startApp({ root, map: createListMap(), findMap: createListMap(), content, now: OCT, ua: PHONE, openUrl: (u) => opened.push(u), tracker, motion: false, ...o });
  apps.push(app);
  return app;
}
const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
const events = (name: string) => log.filter(([n]) => n === name).map(([, d]) => d);
const hashChange = () => window.dispatchEvent(new Event('hashchange'));
const memoryStore = () => {
  const m = new Map<string, unknown>();
  return { available: true, get: <T,>(k: string, d: T) => (m.has(k) ? (m.get(k) as T) : d), set: (k: string, v: unknown) => (m.set(k, v), true) };
};

afterEach(() => {
  apps.forEach((a) => a.destroy());
  apps = [];
});

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  log = [];
  opened = [];
});

describe('앱이 열릴 때', () => {
  it('app-open 한 번: mode·first_month·returning, 공유로 들어오면 from=share', async () => {
    await start('?from=share#/month/10', { store: memoryStore() });
    const e = events('app-open');
    expect(e).toHaveLength(1);
    expect(e[0]).toEqual({ mode: 'browser', from: 'share', first_month: '2026-10', returning: false });
  });

  it('화면 조회: 처음 한 번, 화면을 옮길 때마다 한 번(# 뒤까지)', async () => {
    await start('#/month/10', { store: memoryStore() });
    window.location.hash = '#/find/danpung';
    hashChange();
    expect(events('page')).toEqual(['/imamttae/#/month/10', '/imamttae/#/find/danpung']);
  });

  it('error: 장면 데이터를 못 불러옴(data-fail) / 지도를 못 불러옴(map-fail) / 저장이 막힘(storage-blocked)', async () => {
    await start('#/month/10', { content: null });
    expect(events('error')).toContainEqual({ kind: 'data-fail' });
    log = [];
    await start('#/month/10', { mapFailed: true });
    expect(events('error')).toContainEqual({ kind: 'map-fail' });
    log = [];
    const blocked = createSafeStore(() => {
      throw new Error('blocked');
    });
    await start('#/month/10', { store: blocked });
    expect(events('error')).toContainEqual({ kind: 'storage-blocked' });
    expect(events('app-open')[0]).toMatchObject({ first_month: 'none', returning: false });
  });
});

describe('scene-open: 어디서 열었나', () => {
  it('첫 화면 큰 카드 → photo-card, 작가가 다녀온 곳 줄 → visited-row', async () => {
    await start('#/month/10', { store: memoryStore() });
    q('.rail .big').click();
    hashChange();
    expect(events('scene-open').at(-1)).toMatchObject({ from: 'photo-card' });
    window.location.hash = '#/month/8';
    hashChange();
    q('.rec').click();
    hashChange();
    expect(events('scene-open').at(-1)).toMatchObject({ from: 'visited-row' });
  });

  it('지도 점 → map-pin, 풍경 찾기 목록 → find-list, 주소로 바로 → link', async () => {
    await start('#/month/8', { store: memoryStore() });
    q('[data-pin-id].listpin--record').click();
    hashChange();
    expect(events('scene-open').at(-1)).toMatchObject({ from: 'map-pin' });
    window.location.hash = '#/find/danpung';
    hashChange();
    q('.find-list .row').click();
    hashChange();
    expect(events('scene-open').at(-1)).toMatchObject({ from: 'find-list' });
    log = [];
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    expect(events('scene-open')).toEqual([{ scene: story.id, from: 'link' }]);
  });
});

describe('장면 상세의 버튼', () => {
  it('navi: 길찾기(티맵) → app=tmap·how=main·where=detail, 다른 앱으로 네이버지도 → how=other', async () => {
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    q('.detail .go').click();
    expect(events('navi').at(-1)).toEqual({ app: 'tmap', how: 'main', scene: story.id, where: 'detail' });
    q('.detail .navi-other').click();
    [...q('.navi-sheet').querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === '네이버지도')!.click();
    expect(events('navi').at(-1)).toEqual({ app: 'naver', how: 'other', scene: story.id, where: 'detail' });
  });

  it('navi-no-app: 티맵이 안 열려 "티맵 설치"를 누르면', async () => {
    vi.useFakeTimers();
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    q('.detail .go').click();
    vi.advanceTimersByTime(1600);
    [...q('.navi-sheet').querySelectorAll<HTMLElement>('a')].find((a) => a.textContent === '티맵 설치')!.click();
    expect(events('navi-no-app')).toEqual([{ app: 'tmap' }]);
    vi.useRealTimers();
  });

  it('share: 공유 창이 없으면 how=copy, 복사한 주소에는 ?from=share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    [...root.querySelectorAll<HTMLButtonElement>('.detail .dact')].find((b) => b.textContent?.includes('공유'))!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]![0]).toMatch(new RegExp(`\\?from=share#/scene/${story.id}$`));
    expect(events('share')).toEqual([{ scene: story.id, where: 'detail', how: 'copy' }]);
  });

  it('save: 저장하면 on=true, 다시 누르면 on=false', async () => {
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    const btn = () => root.querySelector<HTMLElement>('.detail .dact')!;
    btn().click();
    btn().click();
    expect(events('save')).toEqual([
      { scene: story.id, on: true },
      { scene: story.id, on: false },
    ]);
  });

  it('brunch: 브런치에서 전체 이야기 읽기 / news: 올해 소식 찾아보기(카드 시기 줄)', async () => {
    await start(`#/scene/${story.id}`, { store: memoryStore() });
    q('.detail .btn.line').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    q('.detail .pc-row.news').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(events('brunch')).toEqual([{ scene: story.id }]);
    expect(events('news')).toEqual([{ scene: story.id }]);
  });

  it('admission: 입장료·운영 시간 찾아보기(D4, #61)', async () => {
    const garden = content.scenes.find((s) => s.kind === 'story' && s.checkAdmission)!;
    await start(`#/scene/${garden.id}`, { store: memoryStore() });
    q('.detail .pc-row.admission').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(events('admission')).toEqual([{ scene: garden.id }]);
  });
});
