// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore } from '../../src/storage/safeStorage';
import { createSavedStore } from '../../src/storage/saved';
import { HOME_SCENES, story } from '../fixtures/homeScenes';
import type { ContentFile } from '../../shared/schema/content';

/**
 * 화면마다 어느 달의 색을 쓰나(design-guide 3장 — PR #46·#48) + 작가 서명(6장)
 * 오늘 = 한국 날짜 2026년 10월 1일(가을)
 */
const OCT1 = new Date('2026-09-30T16:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const CONTENT: ContentFile = {
  ...HOME_SCENES,
  scenes: [...HOME_SCENES.scenes, story('s-boriam', { name: '남해 금산 보리암', visited: '2023-06-10', types: ['bada'], best: { from: 1, to: 12, note: '일 년 내내' } })],
};

let root: HTMLElement;
async function start(hash: string) {
  window.location.hash = hash;
  const m = new Map<string, string>();
  const saved = createSavedStore(createSafeStore(() => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: () => {}, clear: () => {}, key: () => null, length: 0 }) as Storage), () => OCT1);
  saved.toggleWanted('s-boriam');
  return startApp({ root, map: createListMap(), content: CONTENT, now: OCT1, ua: PHONE, openUrl: () => {}, saved, motion: false });
}
const go = (hash: string) => {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
};
const detail = () => root.querySelector<HTMLElement>('.detail')!;
const sheet = () => root.querySelector<HTMLElement>('.navi-sheet')!;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
  root = document.getElementById('app')!;
});

describe('작가 서명(design-guide 6장, PR #46)', () => {
  it('사진 위 크레딧의 서명 자리는 흰 손글씨 서명 그림(글자 "서명"이 아님)', async () => {
    await start('#/scene/s-naejang');
    const sign = root.querySelector<HTMLImageElement>('.detail .credit img.sign')!;
    expect(sign).not.toBeNull();
    expect(sign.getAttribute('src')).toBe('./brand/sign-white.png');
    expect(sign.getAttribute('alt')).toBe('');
    expect([sign.getAttribute('width'), sign.getAttribute('height')]).toEqual(['37', '22']);
    expect(root.querySelector('.detail .credit')!.textContent).toBe('사진·글 이상호');
  });
});

describe('장면 상세는 사진 찍은 달의 계절 색(PR #46)', () => {
  it('저장한 곳에서 6월 사진 보리암을 열면 여름 — 아래 탭은 가을 그대로', async () => {
    await start('#/saved');
    go('#/scene/s-boriam');
    expect(detail().dataset.season).toBe('summer');
    expect(root.dataset.season).toBe('autumn');
  });

  it('첫 화면에서 3월을 고르고 보리암을 열어도 여름, 닫으면 봄(고른 달) 그대로', async () => {
    await start('#/month/3');
    go('#/scene/s-boriam');
    expect(detail().dataset.season).toBe('summer');
    go('#/month/3');
    expect(root.dataset.season).toBe('spring');
  });

  it('내장산 우화정(11월 사진)은 어디서 열어도 가을', async () => {
    await start('#/month/4');
    go('#/scene/s-naejang');
    expect(detail().dataset.season).toBe('autumn');
  });

  it('상세 밖에 있는 길찾기 판도 상세를 연 동안은 사진 찍은 달의 색, 닫으면 아래 화면 색', async () => {
    await start('#/month/1');
    go('#/scene/s-boriam');
    expect(sheet().dataset.season).toBe('summer');
    go('#/month/1');
    expect(sheet().dataset.season).toBeUndefined();
  });
});

describe('풍경 찾기·저장한 곳은 첫 화면에서 고른 달의 색을 이어 감(PR #48)', () => {
  it('1월을 고른 뒤 풍경 찾기·저장한 곳으로 가면 겨울 — 풍경 찾기 글자는 오늘(10월) 기준 그대로', async () => {
    await start('#/month/1');
    go('#/find');
    expect(root.dataset.season).toBe('winter');
    expect(root.querySelector('.find')!.textContent).toContain('10월에 좋은 풍경');
    go('#/saved');
    expect(root.dataset.season).toBe('winter');
  });

  it('링크로 풍경 찾기에 바로 들어오면 이번 달(가을)', async () => {
    await start('#/find');
    expect(root.dataset.season).toBe('autumn');
  });
});
