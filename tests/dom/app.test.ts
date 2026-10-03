// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { HOME_SCENES } from '../fixtures/homeScenes';

/** 첫 화면(기능 ①) — docs/features/F1-지금-볼-만한-곳.md, 확정 시안 v2 */
const OCT = new Date('2026-09-30T16:00:00Z'); // 한국 시간 10월 1일 01시
let root: HTMLElement;

async function start(o: Partial<AppDeps> = {}) {
  return startApp({ root, map: createListMap(), content: HOME_SCENES, now: OCT, ...o });
}
const text = (sel: string) => root.querySelector(sel)?.textContent ?? '';
const all = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const hashChange = () => window.dispatchEvent(new Event('hashchange'));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  window.location.hash = '';
  root = document.getElementById('app')!;
});

describe('머리와 달 띠', () => {
  it('F1-AC1·AC2: 달 12개, 한국 날짜 기준 이번 달이 골라져 있고 큰 제목이 그 달', async () => {
    await start();
    expect(all('.mchip')).toHaveLength(12);
    expect(all('.mchip[aria-pressed="true"]').map((c) => c.textContent)).toEqual(['10월']);
    expect(text('.eyebrow')).toBe('이상호 작가의 추천');
    expect(text('h1.ttl')).toBe('10월에 만나는 풍경');
  });

  it('F1-AC9: 달을 누르면 주소가 #/month/11 이 되고, 그 주소대로 화면이 바뀜', async () => {
    await start();
    all('.mchip')[10]!.click();
    expect(window.location.hash).toBe('#/month/11');
    hashChange();
    expect(text('h1.ttl')).toBe('11월에 만나는 풍경');
    expect(all('.mchip[aria-pressed="true"]').map((c) => c.textContent)).toEqual(['11월']);
  });

  it('F1-AC12: 고른 달의 계절을 표시(가을 → 겨울), 휴대폰 위쪽 띠 색도 계절 바탕색', async () => {
    await start();
    expect(root.dataset.season).toBe('autumn');
    window.location.hash = '#/month/1';
    hashChange();
    expect(root.dataset.season).toBe('winter');
  });

  it('F1-AC13: 스크롤하면 나오는 작은 제목 막대도 같은 달', async () => {
    window.location.hash = '#/month/1';
    await start();
    expect(text('.mini-ttl')).toBe('1월에 만나는 풍경');
  });
});

describe('제철 카드와 작가 부부가 다녀온 곳', () => {
  it('F1-AC3: 제철 카드가 정한 순서대로, 카드에는 이름·지역·추천 시기', async () => {
    await start();
    const cards = all('.rail .big:not(.ph)');
    expect(cards.map((c) => c.querySelector('.cap b')?.textContent)).toEqual(['남설악 주전골', '설악 대승폭포 단풍길', '지리산 백무동 단풍', '내장산 우화정']);
    expect(cards[0]!.querySelector('.best strong')?.textContent).toBe('10월 중순~하순');
  });

  it('F1-AC4: 그달에 다녀온 준비 중 장면은 카드 띠 맨 뒤에, 사진 없이 이름과 다녀온 날', async () => {
    await start();
    const last = all('.rail .big').at(-1)!;
    expect(last.classList.contains('ph')).toBe(true);
    expect(last.textContent).toContain('부산 태종대');
    expect(last.textContent).toContain('2023년 10월 26일');
    expect(last.textContent).toContain('준비 중');
    expect(last.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-pin-id="p-taejong"]')?.className).toContain('placeholder');
  });

  it('F1-AC11: 작가 부부가 다녀온 곳은 제철 카드 아래 작은 목록, 없는 달에는 숨김', async () => {
    await start();
    expect(text('.records h2')).toBe('10월, 작가 부부가 다녀온 곳');
    expect(all('.rec').map((r) => r.querySelector('b')?.textContent)).toEqual(['동해 추암 촛대바위']);
    window.location.hash = '#/month/11';
    hashChange();
    expect(root.querySelector<HTMLElement>('.records')!.hidden).toBe(true);
  });

  it('F1-AC7: 카드나 목록 줄을 누르면 장면 상세 주소(#/scene/…)', async () => {
    await start();
    all('.rail .big')[0]!.click();
    expect(window.location.hash).toBe('#/scene/s-jujeon');
    all('.rec')[0]!.click();
    expect(window.location.hash).toBe('#/scene/s-sea');
  });

  it('F1-AC8: 이야기가 없는 달은 안내와 함께 가까운 달의 풍경', async () => {
    window.location.hash = '#/month/2';
    await start();
    expect(text('.empty-month')).toContain('2월은 아직 이야기가 없어요');
    expect(all('.rail .big').map((c) => c.querySelector('.cap b')?.textContent)).toEqual(['발왕산 상고대', '광양 매화마을']);
  });
});

describe('작은 지도', () => {
  it('F1-AC6: 지도에서 제철 장소를 누르면 그 장소가 골라짐(이름표), 다녀온 곳을 누르면 상세로', async () => {
    await start();
    const pin = (id: string) => root.querySelector<HTMLElement>(`[data-pin-id="${id}"]`)!;
    expect(pin('s-jujeon').getAttribute('aria-current')).toBe('true'); // 처음에는 첫 카드
    pin('s-baekmu').click();
    expect(pin('s-baekmu').getAttribute('aria-current')).toBe('true');
    expect(pin('s-jujeon').getAttribute('aria-current')).toBeNull();
    pin('s-sea').click();
    expect(window.location.hash).toBe('#/scene/s-sea');
  });

  it('F1-AC10: 지도를 못 불러오면 "지도를 불러오지 못했어요", 카드는 그대로', async () => {
    await start({ mapFailed: true });
    expect(text('.mapfail')).toBe('지도를 불러오지 못했어요.');
    expect(all('.rail .big').length).toBeGreaterThan(0);
  });

  it('지도 범례는 "제철 풍경 · 작가 부부 방문"', async () => {
    await start();
    expect(all('.legend span').map((s) => s.textContent)).toEqual(['제철 풍경', '작가 부부 방문']);
  });
});

describe('아래 메뉴와 실패할 때', () => {
  it('아직 없는 화면(내 수첩·홈 화면에 두기)은 누르면 "곧 열려요"', async () => {
    await start();
    const tab = all('.tabs button').find((b) => b.textContent === '내 수첩')!;
    tab.click();
    expect(text('.toast')).toBe('곧 열려요');
    expect(all('.tabs button').map((b) => b.textContent)).toEqual(['지금 풍경', '풍경 찾기', '내 수첩']);
  });

  it('C-4: 장면 데이터를 못 불러오면 쉬운 말로 알림', async () => {
    await start({ content: null });
    expect(root.textContent).toContain('장면을 불러오지 못했어요');
  });
});
