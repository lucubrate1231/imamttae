// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps, type AppHandle } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { createSafeStore } from '../../src/storage/safeStorage';
import { inWindow } from '../../src/domain/month';
import { isYearRound } from '../../src/domain/sceneTier';
import { createSavedStore, type SavedStore } from '../../src/storage/saved';
import type { ContentFile, StoryScene } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';

/** 저장한 곳 탭(F4) — docs/features/F4-올해-만난-풍경.md, design-guide 9장·10-5 */
const OCT = new Date('2026-10-03T03:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const content = appData as ContentFile;
const stories = content.scenes.filter((s): s is StoryScene => s.kind === 'story' && !s.hidden);
const pick = (f: (s: StoryScene) => boolean) => stories.find(f)!;
const timed = (s: StoryScene) => !!s.best && !isYearRound(s.best);
// 상태마다 한 곳씩(실제 데이터에서 규칙으로 고름)
const nowOct = pick((s) => timed(s) && inWindow(10, s.best!) && s.best!.to === 10);
const nowNov = pick((s) => timed(s) && inWindow(10, s.best!) && s.best!.to === 11);
const always = pick((s) => !!s.best && isYearRound(s.best));
const soon = pick((s) => timed(s) && s.best!.from === 11 && !inWindow(10, s.best!));
const later = pick((s) => timed(s) && s.best!.from === 3);
const noBest = pick((s) => !s.best);

const memory = () => {
  const m = new Map<string, string>();
  return createSafeStore(() => ({
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }));
};

let root: HTMLElement;
let opened: string[];
let apps: AppHandle[] = [];
let saved: SavedStore;
async function start(hash: string, o: Partial<AppDeps> = {}) {
  apps.forEach((a) => a.destroy());
  apps = [];
  window.location.hash = hash;
  const app = await startApp({ root, map: createListMap(), findMap: createListMap(), content, now: OCT, ua: PHONE, openUrl: (u) => opened.push(u), motion: false, saved, ...o });
  apps.push(app);
  return app;
}
const q = (sel: string) => root.querySelector<HTMLElement>(sel);
const all = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const hashChange = () => window.dispatchEvent(new Event('hashchange'));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  // 크롬의 처음 [저장] 판(F5-AC6)은 이미 본 것으로 — 여기서는 안내 줄을 봄(판은 a2hs.test.ts)
  localStorage.setItem('imamttae:a2hs', JSON.stringify({ sheetShown: true }));
  root = document.getElementById('app')!;
  opened = [];
  saved = createSavedStore(memory(), () => OCT);
});
afterEach(() => apps.forEach((a) => a.destroy()));

describe('저장한 곳 탭 열기', () => {
  it('F4-AC1: 아래 메뉴 "저장한 곳" → #/saved, 제목 "저장한 곳", 메뉴가 골라짐', async () => {
    await start('#/month/10');
    all('.tabs button').find((b) => b.textContent === '저장한 곳')!.click();
    expect(window.location.hash).toBe('#/saved');
    hashChange();
    expect(q('.saved')!.hidden).toBe(false);
    expect(q('main.home')!.hidden).toBe(true);
    expect(q('.saved h1')!.textContent).toBe('저장한 곳');
    expect(q('.tabs button[aria-current="page"]')!.textContent).toBe('저장한 곳');
  });

  it('F4-AC11: 처음(아무것도 없음) — 두 자리의 안내, [지금 풍경 보러 가기]는 첫 화면으로', async () => {
    await start('#/saved');
    expect(q('.sv-wish-empty')!.textContent).toContain("장면에서 '저장'을 누르면");
    expect(q('.sv-wish-empty')!.textContent).toContain('여기 모여요.');
    expect(q('.sv-visit-empty')!.textContent).toContain('다녀오신 뒤 장면에서 [다녀왔어요]를');
    q('.sv-wish-empty button')!.click();
    expect(window.location.hash).toBe('#/');
  });

  it('F4-AC15: 맨 아래 "이 휴대폰에만 저장돼요" 안내', async () => {
    await start('#/saved');
    expect(q('.sv-note')!.textContent).toBe('저장한 곳은 이 휴대폰에만 저장돼요. 로그인은 필요 없지만, 휴대폰을 바꾸거나 인터넷 사용 기록을 지우면 함께 지워져요.');
  });

  it('F4-AC16: 저장이 막힌 브라우저면 맨 위에 "이 브라우저에서는 저장되지 않아요."', async () => {
    saved = createSavedStore(createSafeStore(() => { throw new Error('blocked'); }), () => OCT);
    await start('#/saved');
    expect(q('.sv-warn')!.textContent).toBe('이 브라우저에서는 저장되지 않아요.');
  });
});

describe('가고 싶은 곳(F4-AC2)', () => {
  beforeEach(() => {
    for (const s of [later, noBest, soon, always, nowNov, nowOct]) saved.toggleWanted(s.id);
    saved.toggleWanted('s-hidden-or-gone');
  });

  it('지금 가기 좋은 순: 지금(먼저 끝나는 곳) → 일 년 내내 → 곧 → 그 밖 → 추천 시기 없음 → 볼 수 없음', async () => {
    await start('#/saved');
    const names = all('.sv-wish .sv-name').map((e) => e.textContent);
    expect(names).toEqual([nowOct.name, nowNov.name, always.name, soon.name, later.name, noBest.name, '']);
  });

  it('줄마다 상태 한 줄: "지금 좋아요 · 10월까지" / "언제나 좋아요" / "곧 · 11월부터" / "3월부터" / 없음', async () => {
    await start('#/saved');
    const stat = all('.sv-wish').map((w) => w.querySelector('.sv-stat')?.textContent ?? null);
    expect(stat.slice(0, 6)).toEqual(['지금 좋아요 · 10월까지', '지금 좋아요 · 11월까지', '언제나 좋아요', '곧 · 11월부터', '3월부터', null]);
    expect(all('.sv-wish')[0]!.querySelector('.dot.now')).not.toBeNull();
    expect(all('.sv-wish')[3]!.querySelector('.dot.soon')).not.toBeNull();
  });

  it('F4-AC12: 볼 수 없는 곳은 회색 칸 + "지금은 볼 수 없는 곳이에요" + 빼기만', async () => {
    await start('#/saved');
    const gone = all('.sv-wish').at(-1)!;
    expect(gone.textContent).toContain('지금은 볼 수 없는 곳이에요');
    expect(gone.querySelector('.sv-go')).toBeNull();
    expect(gone.querySelector('.sv-del')).not.toBeNull();
  });

  it('줄을 누르면 장면 상세, [길찾기]는 티맵(좌표), [빼기]는 목록에서 빠지고 알림', async () => {
    await start('#/saved');
    all('.sv-wish')[0]!.querySelector<HTMLElement>('.sv-wtop')!.click();
    expect(window.location.hash).toBe(`#/scene/${nowOct.id}`);
    window.location.hash = '#/saved';
    hashChange();
    all('.sv-wish')[0]!.querySelector<HTMLElement>('.sv-go')!.click();
    expect(new URL(opened[0]!).protocol).toBe('tmap:');
    all('.sv-wish')[0]!.querySelector<HTMLElement>('.sv-del')!.click();
    expect(all('.sv-wish .sv-name').map((e) => e.textContent)).not.toContain(nowOct.name);
    expect(q('.toast')!.textContent).toBe('저장한 곳에서 뺐어요');
    expect(saved.isWanted(nowOct.id)).toBe(false);
  });
});

describe('다녀온 곳 = 도장 모음(F4-AC7·AC13)', () => {
  it('올해 도장은 펼쳐 3열: 도장 그림(대표 풍경)·장소 이름·다녀온 날, 지난해는 "2025년 · N곳"으로 접힘', async () => {
    saved.markVisited(nowOct, '2026-10-01');
    saved.markVisited(always, '2026-07-07');
    saved.markVisited(later, '2025-03-15');
    await start('#/saved');
    expect(q('.sv-visit-sub')!.textContent).toBe('올해 다녀온 곳 2곳 · 도장을 누르면 그곳 이야기를 다시 볼 수 있어요.');
    const stamps = all('.sv-stamps:not([hidden]) .sv-stamp');
    expect(stamps.map((s) => s.querySelector('b')!.textContent)).toEqual([nowOct.name, always.name]);
    expect(stamps.map((s) => s.querySelector('.sv-date')!.textContent)).toEqual(['10월 1일', '7월 7일']);
    expect(stamps[0]!.querySelector('img')!.getAttribute('src')).toBe(`./stamps/${nowOct.types[0]}.webp`);
    const fold = q('.sv-fold')!;
    expect(fold.textContent).toBe('2025년 · 1곳');
    fold.click();
    expect(all('.sv-stamps:not([hidden]) .sv-stamp').map((s) => s.querySelector('b')!.textContent)).toContain(later.name);
  });

  it('새해 첫날: 올해 도장이 없으면 "올해는 아직 다녀온 곳이 없어요." + 지난해 묶음', async () => {
    saved.markVisited(later, '2025-03-15');
    await start('#/saved');
    expect(q('.sv-visit-sub')!.textContent).toBe('올해는 아직 다녀온 곳이 없어요.');
    expect(q('.sv-fold')!.textContent).toBe('2025년 · 1곳');
  });

  it('도장을 누르면 장면 상세, 볼 수 없는 곳의 도장은 "지금은 볼 수 없는 곳이에요"', async () => {
    saved.markVisited(nowOct, '2026-10-01');
    saved.markVisited({ id: 's-gone', name: '없어진 곳', types: ['danpung'] }, '2026-09-01');
    await start('#/saved');
    const stamps = all('.sv-stamps:not([hidden]) .sv-stamp');
    stamps.find((s) => s.textContent!.includes(nowOct.name))!.click();
    expect(window.location.hash).toBe(`#/scene/${nowOct.id}`);
    window.location.hash = '#/saved';
    hashChange();
    all('.sv-stamps:not([hidden]) .sv-stamp').find((s) => s.textContent!.includes('없어진 곳'))!.click();
    expect(q('.toast')!.textContent).toBe('지금은 볼 수 없는 곳이에요');
  });
});

describe('장면 상세의 [저장] 뒤 안내 줄(F4-AC3)', () => {
  it('"저장했어요 · \'저장한 곳\'에서 볼 수 있어요" 옆 [보기 ›]를 누르면 저장한 곳', async () => {
    await start(`#/scene/${nowOct.id}`);
    q('.detail .dact')!.click();
    expect(q('.toast')!.textContent).toContain("저장했어요 · '저장한 곳'에서 볼 수 있어요");
    q('.toast .toast-go')!.click();
    expect(window.location.hash).toBe('#/saved');
  });
});
