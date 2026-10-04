// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore, type SafeStore } from '../../src/storage/safeStorage';
import { createSavedStore, type SavedStore } from '../../src/storage/saved';
import type { EventData, EventName, Tracker } from '../../src/analytics';
import { HOME_SCENES } from '../fixtures/homeScenes';

/**
 * 제철 알림 카드(F4-AC10, D19) — design-guide 9-1, 글자 10-5
 * 오늘 = 한국 날짜 2026년 10월 1일. 10월이 추천 시기 안: 남설악 주전골(~10월) · 지리산 백무동 단풍(~10월) · 내장산 우화정(~11월)
 */
const OCT1 = new Date('2026-09-30T16:00:00Z');
const NOV1 = new Date('2026-10-31T16:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

let root: HTMLElement;
let storage: Storage;
let mem: SafeStore;
let saved: SavedStore;
let events: [EventName, EventData | undefined][];
const tracker: Tracker = { load() {}, pageview() {}, track: (n, d) => void events.push([n, d]) };

async function start(hash = '#/', o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({ root, map: createListMap(), content: HOME_SCENES, now: OCT1, ua: PHONE, openUrl: () => {}, saved, tracker, motion: false, ...o });
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.trim() ?? '';
const go = (hash: string) => {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
};
const alertEvents = () => events.filter(([n]) => n === 'alert-card').map(([, d]) => d);

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
  root = document.getElementById('app')!;
  storage = memoryStorage();
  mem = createSafeStore(() => storage);
  saved = createSavedStore(mem, () => OCT1);
  events = [];
});

describe('언제 뜨나', () => {
  it('저장한 곳이 없으면 첫 화면·저장한 곳 어디에도 없음', async () => {
    await start();
    expect(q('.acard')).toBeNull();
    go('#/saved');
    expect(q('.acard')).toBeNull();
  });

  it('저장한 곳이 일 년 내내 · 추천 시기 밖뿐이면 뜨지 않음', async () => {
    saved.toggleWanted('s-sea');
    saved.toggleWanted('s-maehwa');
    await start();
    expect(q('.acard')).toBeNull();
  });
});

describe('한 곳', () => {
  it('첫 화면 큰 제목 아래·달 띠 위: 사진 + "저장하신 내장산 우화정, / 지금 가기 좋아요" + [×]', async () => {
    saved.toggleWanted('s-naejang');
    await start();
    const card = q('main.home .acard')!;
    expect(card).not.toBeNull();
    const slot = card.parentElement!; // 카드 자리
    expect(slot.previousElementSibling!.matches('h1.ttl')).toBe(true);
    expect(slot.nextElementSibling!.matches('nav.months')).toBe(true);
    expect(card.querySelector('.ac-msg')!.textContent).toBe('저장하신 내장산 우화정, 지금 가기 좋아요');
    expect(card.querySelector('.ac-msg b')!.textContent).toBe('지금 가기 좋아요');
    expect(card.querySelector('.ac-sub')).toBeNull();
    expect(card.querySelector('img')).not.toBeNull();
    expect(card.querySelector('button[aria-label="알림 닫기"]')).not.toBeNull();
  });

  it('누르면 그 장면 상세가 열림 — 통계 alert-card(open)와 scene-open(from alert-card)', async () => {
    saved.toggleWanted('s-naejang');
    await start();
    q('.acard .ac-go')!.click();
    expect(window.location.hash).toBe('#/scene/s-naejang');
    window.dispatchEvent(new Event('hashchange'));
    expect(text('.detail .title')).toBe('내장산 우화정');
    expect(alertEvents()).toContainEqual({ action: 'open', where: 'home', count: 1 });
    expect(events).toContainEqual(['scene-open', { scene: 's-naejang', from: 'alert-card' }]);
  });

  it('카드가 처음 보일 때 통계 alert-card(show) 한 번', async () => {
    saved.toggleWanted('s-naejang');
    await start();
    go('#/month/3');
    go('#/');
    expect(alertEvents().filter((d) => d!.action === 'show')).toEqual([{ action: 'show', where: 'home', count: 1 }]);
  });
});

describe('여러 곳', () => {
  it('"저장하신 2곳이 / 지금 가기 좋아요" + "지리산 백무동 단풍 외 1곳"(먼저 끝나는 곳이 앞), 누르면 저장한 곳 탭', async () => {
    saved.toggleWanted('s-naejang');
    saved.toggleWanted('s-baekmu');
    saved.toggleWanted('s-maehwa');
    await start();
    expect(text('.acard .ac-msg')).toBe('저장하신 2곳이 지금 가기 좋아요');
    expect(text('.acard .ac-sub')).toBe('지리산 백무동 단풍 외 1곳');
    q('.acard .ac-go')!.click();
    expect(window.location.hash).toBe('#/saved');
    expect(alertEvents()).toContainEqual({ action: 'open', where: 'home', count: 2 });
  });

  it('저장한 곳 탭 맨 위(계절 바탕 머리 안)에도 같은 카드', async () => {
    saved.toggleWanted('s-naejang');
    saved.toggleWanted('s-baekmu');
    await start('#/saved');
    expect(q('.sv-head .acard')).not.toBeNull();
    expect(text('.sv-head .acard .ac-msg')).toBe('저장하신 2곳이 지금 가기 좋아요');
  });
});

describe('닫기 [×]', () => {
  it('닫으면 첫 화면·저장한 곳 모두에서 사라지고, 그달에는 새로고침해도 다시 뜨지 않음', async () => {
    saved.toggleWanted('s-naejang');
    const app = await start();
    q<HTMLButtonElement>('.acard button[aria-label="알림 닫기"]')!.click();
    expect(q('.acard')).toBeNull();
    expect(alertEvents()).toContainEqual({ action: 'close', where: 'home', count: 1 });
    go('#/saved');
    expect(q('.acard')).toBeNull();
    app.destroy();

    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    saved = createSavedStore(createSafeStore(() => storage), () => OCT1);
    await start();
    expect(q('.acard')).toBeNull();
  });

  it('다음 달이 되면 다시 뜸(내장산은 11월까지)', async () => {
    saved.toggleWanted('s-naejang');
    saved.closeAlert('2026-10');
    saved = createSavedStore(createSafeStore(() => storage), () => NOV1);
    await start('#/', { now: NOV1 });
    expect(text('.acard .ac-msg')).toBe('저장하신 내장산 우화정, 지금 가기 좋아요');
  });
});

it('상세에서 [저장]하고 첫 화면으로 돌아오면 카드가 생김', async () => {
  await start('#/scene/s-jujeon');
  q<HTMLButtonElement>('.detail .dact[aria-pressed]')!.click();
  go('#/');
  expect(text('.acard .ac-msg')).toBe('저장하신 남설악 주전골, 지금 가기 좋아요');
});
