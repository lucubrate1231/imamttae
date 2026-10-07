// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { HOME_SCENES, story } from '../fixtures/homeScenes';

/** 공유 문구(D58, 10/7 기획 — 마케팅 M2). 작가 이름은 앱 문구에 넣지 않음 */
const OCT = new Date('2026-09-30T16:00:00Z');
let root: HTMLElement;
let share: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  localStorage.clear();
  share = vi.fn(async (_d: ShareData) => {});
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
});
afterEach(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));

const noBest = story('s-nobest', { name: '군위 아미산 암릉', region: '경북 군위', visited: '2023-10-01' });
async function shareScene(id: string) {
  window.location.hash = `#/scene/${id}`;
  await startApp({ root, map: createListMap(), content: { ...HOME_SCENES, scenes: [...HOME_SCENES.scenes, noBest] }, now: OCT });
  [...root.querySelectorAll<HTMLButtonElement>('.detail .dact')].find((b) => b.textContent?.includes('공유'))!.click();
  await Promise.resolve();
  return share.mock.calls[0]![0] as ShareData;
}

describe('장면 [공유] 문장(마케팅 M11, 10/8 — 받는 날 철이 안 맞을 수 있어 추천 시기를 뺌)', () => {
  it('D58 ③(10/8 새벽 바꿈): \'{장면 이름}, "이맘때 풍경"에서 봤어요. 한번 보실래요? {주소}\' — 높임말, 주소는 한 칸 띄워 같은 글에(아이폰 카톡의 빈 줄을 없애려고 url은 따로 넘기지 않음)', async () => {
    const d = await shareScene('s-naejang');
    expect(d.text).toMatch(/^내장산 우화정, "이맘때 풍경"에서 봤어요\. 한번 보실래요\? https?:\/\/\S+\/s\/s-naejang\/\?from=share$/); // D63 장면 공유 페이지
    expect(d.url).toBeUndefined();
    expect(d.title).toBeUndefined();
    expect(d.text).not.toContain('\n');
  });
  it('추천 시기가 없는 장면도 같은 한 줄', async () => {
    expect((await shareScene('s-nobest')).text).toMatch(/^군위 아미산 암릉, "이맘때 풍경"에서 봤어요\. 한번 보실래요\? \S+\/s\/s-nobest\/\?from=share$/);
  });
});
