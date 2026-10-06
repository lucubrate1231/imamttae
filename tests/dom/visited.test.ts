// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore, type SafeStore } from '../../src/storage/safeStorage';
import { createSavedStore, type SavedStore } from '../../src/storage/saved';
import type { EventData, EventName, Tracker } from '../../src/analytics';
import { HOME_SCENES, story } from '../fixtures/homeScenes';
import type { ContentFile } from '../../shared/schema/content';

/**
 * 장면 상세의 [다녀왔어요](F4-AC4~AC6·AC9, design-guide 6-2, 글자 10-5)
 * 오늘 = 한국 날짜 2026년 10월 1일
 */
const OCT1 = new Date('2026-09-30T16:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const photo = (n: number) => ({ src: `https://t1.daumcdn.net/brunch/service/user/p${n}.jpg`, cap: '', w: 1200, h: 800 });
const CONTENT: ContentFile = {
  ...HOME_SCENES,
  scenes: [
    ...HOME_SCENES.scenes,
    story('s-v', {
      name: '남설악 주전골',
      region: '강원 양양',
      visited: '2022-10-15',
      types: ['danpung', 'gyegok'],
      best: { from: 10, to: 10, note: '10월 중순~하순' },
      photos: [photo(1)],
      dest: { name: '오색약수터주차장', lat: 38.0601, lng: 128.4398, kind: 'parking' },
    }),
  ],
};

function memory(): SafeStore {
  const m = new Map<string, string>();
  return createSafeStore(() => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  }) as Storage);
}

let root: HTMLElement;
let saved: SavedStore;
let events: [EventName, EventData | undefined][];
const tracker: Tracker = { load() {}, pageview() {}, track: (n, d) => void events.push([n, d]) };

async function start(hash = '#/scene/s-v', o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  const app = await startApp({ root, map: createListMap(), content: CONTENT, now: OCT1, ua: PHONE, openUrl: () => {}, saved, tracker, motion: false, ...o });
  return app;
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.trim() ?? '';
const btn = (scope: string, label: string) => [...root.querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === label);
const saveBtn = () => q<HTMLButtonElement>('.detail .dact[aria-pressed]')!;
const visitEvents = () => events.filter(([n]) => n === 'visited').map(([, d]) => d);

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
  root = document.getElementById('app')!;
  saved = createSavedStore(memory(), () => OCT1);
  events = [];
});

describe('F4-AC4: [다녀왔어요]는 저장한 장면에만', () => {
  it('저장하지 않은 장면에는 상자가 없음', async () => {
    await start();
    expect(q('.detail .vbox')).toBeNull();
  });

  it('저장한 장면은 제목 구역 안에 "저장된 곳이에요" + [다녀왔어요]', async () => {
    saved.toggleWanted('s-v');
    await start();
    const box = q('.detail .dsec[aria-label="제목"] .vbox')!;
    expect(box).not.toBeNull();
    expect(box.querySelector('.vbox-msg')!.textContent).toBe('저장된 곳이에요');
    expect(btn('.vbox', '다녀왔어요')).toBeTruthy();
  });

  it('상세에서 [저장]을 누르면 상자가 생기고, 다시 누르면 없어짐', async () => {
    await start();
    saveBtn().click();
    expect(text('.detail .vbox .vbox-msg')).toBe('저장된 곳이에요');
    saveBtn().click();
    expect(q('.detail .vbox')).toBeNull();
  });
});

describe('F4-AC5: 도장 찍히는 순간', () => {
  async function stampNow() {
    saved.toggleWanted('s-v');
    await start();
    btn('.vbox', '다녀왔어요')!.click();
    return q('.stamp-moment')!;
  }

  it('도장 그림(대표 풍경, 큰 그림) · "○○에 다녀왔어요" · 다녀온 날(오늘) · 버튼 셋 · 안내', async () => {
    const m = await stampNow();
    expect(m).not.toBeNull();
    expect(m.getAttribute('role')).toBe('dialog');
    expect(m.getAttribute('aria-label')).toBe('도장을 찍었어요');
    expect(m.querySelector<HTMLImageElement>('.sm-stamp img')!.getAttribute('src')).toBe('./stamps/danpung-384.webp');
    expect(m.querySelector('.sm-ttl')!.textContent).toBe('남설악 주전골에 다녀왔어요');
    expect(m.querySelector('.sm-date')!.textContent).toBe('다녀온 날 10월 1일 (오늘)');
    expect(btn('.stamp-moment', '날짜 변경')).toBeTruthy();
    expect(btn('.stamp-moment', '카톡으로 알리기')).toBeTruthy();
    expect(btn('.stamp-moment', '확인')).toBeTruthy();
    expect(m.querySelector('.sm-note')!.textContent).toBe("'저장한 곳 › 다녀온 곳'에 모였어요");
  });

  it('누르는 순간 도장이 남음: 오늘 날짜, 가고 싶은 곳에서 빠짐, 통계 visited(mark)', async () => {
    await stampNow();
    expect(saved.visitOf('s-v', 2026)).toEqual({ sceneId: 's-v', date: '2026-10-01', name: '남설악 주전골', type: 'danpung' });
    expect(saved.isWanted('s-v')).toBe(false);
    expect(visitEvents()).toEqual([{ scene: 's-v', action: 'mark' }]);
  });

  it('[확인]하면 닫히고, 상자 자리에 작은 도장 + "10월 1일에 다녀왔어요" + [날짜 변경], [저장]은 빈 책갈피', async () => {
    await stampNow();
    btn('.stamp-moment', '확인')!.click();
    expect(q('.stamp-moment')).toBeNull();
    const box = q('.detail .vbox.done')!;
    expect(box.querySelector<HTMLImageElement>('img')!.getAttribute('src')).toBe('./stamps/danpung.webp');
    expect(box.querySelector('.vbox-msg')!.textContent).toBe('10월 1일에 다녀왔어요');
    expect(box.querySelector('.vbox-msg b')!.textContent).toBe('10월 1일');
    expect(btn('.vbox', '날짜 변경')).toBeTruthy();
    expect(saveBtn().getAttribute('aria-pressed')).toBe('false');
  });

  it('Esc로도 닫히고, 상세를 닫으면 함께 사라짐', async () => {
    await stampNow();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('.stamp-moment')).toBeNull();
    btn('.vbox', '날짜 변경')!.click();
    expect(q('.vsheet')).not.toBeNull();
    window.location.hash = '#/';
    window.dispatchEvent(new Event('hashchange'));
    expect(q('.vsheet')).toBeNull();
  });

  it('열리면 [확인]에 초점(읽기 프로그램이 카드 안에서 시작)', async () => {
    await stampNow();
    expect(document.activeElement?.textContent?.trim()).toBe('확인');
  });

  it('F4-AC9: [카톡으로 알리기]는 공유 창에 "○○에 다녀왔어요 — 이맘때 풍경"과 장면 링크, 통계 share(where=stamp)', async () => {
    const share = vi.fn(async (_d: ShareData) => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await stampNow();
    btn('.stamp-moment', '카톡으로 알리기')!.click();
    await Promise.resolve();
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0]![0] as unknown as ShareData;
    expect(arg.text).toBe('남설악 주전골에 다녀왔어요 — 이맘때 풍경');
    expect(arg.url).toMatch(/\?from=share#\/scene\/s-v$/);
    expect(events.filter(([n]) => n === 'share').map(([, d]) => d)).toEqual([{ scene: 's-v', where: 'stamp', how: 'share-sheet' }]);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('순간의 [날짜 변경] 창에는 "다녀온 기록 지우기"가 없고, 바꾸면 순간의 날짜도 바뀜', async () => {
    await stampNow();
    btn('.stamp-moment', '날짜 변경')!.click();
    expect(btn('.vsheet', '다녀온 기록 지우기')).toBeUndefined();
    const input = q<HTMLInputElement>('.vsheet input[type="date"]')!;
    input.value = '2026-09-27';
    input.dispatchEvent(new Event('change'));
    btn('.vsheet', '바꾸기')!.click();
    expect(q('.vsheet')).toBeNull();
    expect(text('.stamp-moment .sm-date')).toBe('다녀온 날 9월 27일');
  });
});

describe('F4-AC6: 다녀온 날 변경 · 다녀온 기록 지우기', () => {
  async function visitedDetail() {
    saved.toggleWanted('s-v');
    saved.markVisited({ id: 's-v', name: '남설악 주전골', types: ['danpung'] });
    await start();
    btn('.vbox', '날짜 변경')!.click();
    return q('.vsheet')!;
  }

  it('창: "다녀온 날 변경" · 장소 이름 · 날짜 칸(오늘보다 뒤는 못 고름) · [바꾸기] · "다녀온 기록 지우기"', async () => {
    const s = await visitedDetail();
    expect(s.getAttribute('role')).toBe('dialog');
    expect(s.querySelector('.vs-ttl')!.textContent).toBe('다녀온 날 변경');
    expect(s.querySelector('.vs-name')!.textContent).toBe('남설악 주전골');
    const input = s.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(input.value).toBe('2026-10-01');
    expect(input.max).toBe('2026-10-01');
    expect(s.querySelector('.vs-shown')!.textContent).toBe('2026년 10월 1일');
    expect(btn('.vsheet', '바꾸기')).toBeTruthy();
    expect(btn('.vsheet', '다녀온 기록 지우기')).toBeTruthy();
  });

  it('날짜를 고르면 칸 글자가 바뀌고, [바꾸기]로 저장 + 상자 날짜 + 통계 visited(change-date)', async () => {
    await visitedDetail();
    const input = q<HTMLInputElement>('.vsheet input[type="date"]')!;
    input.value = '2026-09-27';
    input.dispatchEvent(new Event('change'));
    expect(text('.vsheet .vs-shown')).toBe('2026년 9월 27일');
    btn('.vsheet', '바꾸기')!.click();
    expect(saved.visitOf('s-v', 2026)!.date).toBe('2026-09-27');
    expect(text('.detail .vbox .vbox-msg')).toBe('9월 27일에 다녀왔어요');
    expect(visitEvents()).toEqual([{ scene: 's-v', action: 'change-date' }]);
  });

  it('오늘보다 뒤의 날이면 바꾸지 않고 창에 남아 알려 줌', async () => {
    await visitedDetail();
    const input = q<HTMLInputElement>('.vsheet input[type="date"]')!;
    input.value = '2026-10-09';
    input.dispatchEvent(new Event('change'));
    btn('.vsheet', '바꾸기')!.click();
    expect(q('.vsheet')).not.toBeNull();
    expect(text('.vsheet .vs-err')).toBe('오늘보다 뒤의 날은 고를 수 없어요.');
    expect(saved.visitOf('s-v', 2026)!.date).toBe('2026-10-01');
    expect(visitEvents()).toEqual([]);
  });

  it('"다녀온 기록 지우기" → 한 번 더 묻고, [그대로 두기]면 그대로', async () => {
    await visitedDetail();
    btn('.vsheet', '다녀온 기록 지우기')!.click();
    expect(text('.vsheet .vs-ttl')).toBe('다녀온 기록을 지울까요?');
    expect(text('.vsheet .vs-desc')).toBe('도장도 함께 지워지고, 가고 싶은 곳으로 돌아가요.');
    btn('.vsheet', '그대로 두기')!.click();
    expect(q('.vsheet')).toBeNull();
    expect(saved.visitOf('s-v', 2026)).not.toBeNull();
  });

  it('[지우기]면 도장이 없어지고 가고 싶은 곳으로 돌아감 — 상자는 "저장된 곳이에요", [저장됨], 통계 visited(remove)', async () => {
    await visitedDetail();
    btn('.vsheet', '다녀온 기록 지우기')!.click();
    btn('.vsheet', '지우기')!.click();
    expect(q('.vsheet')).toBeNull();
    expect(saved.visitOf('s-v', 2026)).toBeNull();
    expect(saved.isWanted('s-v')).toBe(true);
    expect(text('.detail .vbox .vbox-msg')).toBe('저장된 곳이에요');
    expect(saveBtn().getAttribute('aria-pressed')).toBe('true');
    expect(visitEvents()).toEqual([{ scene: 's-v', action: 'remove' }]);
  });

  it('지난해 도장만 있으면 올해 상자는 없음(저장하지 않았으면) — 다시 다녀오면 새 도장', async () => {
    saved.markVisited({ id: 's-v', name: '남설악 주전골', types: ['danpung'] }, '2025-10-20');
    await start();
    expect(q('.detail .vbox')).toBeNull();
  });
});

describe('저장한 곳 탭과 이어짐', () => {
  it('도장을 찍고 저장한 곳으로 가면 다녀온 곳에 그 도장', async () => {
    saved.toggleWanted('s-v');
    await start();
    btn('.vbox', '다녀왔어요')!.click();
    btn('.stamp-moment', '확인')!.click();
    window.location.hash = '#/saved';
    window.dispatchEvent(new Event('hashchange'));
    expect(text('.saved .sv-stamp b')).toBe('남설악 주전골');
    expect(text('.saved .sv-visit-sub')).toContain('올해 다녀온 곳 1곳');
    expect(root.querySelectorAll('.saved .sv-wish')).toHaveLength(0);
  });
});

