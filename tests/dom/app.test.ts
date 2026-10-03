// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp } from '../../src/app';
import { createListMap } from '../../src/map/listMap';

describe('앱 뼈대', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '';
  });

  it('앱 이름과 달 12개가 보이고, 한국 날짜 기준 이번 달이 선택된다', async () => {
    const root = document.getElementById('app')!;
    await startApp({ root, map: createListMap(), pins: [], now: new Date('2026-09-30T16:00:00Z') });
    expect(root.querySelector('h1')?.textContent).toBe('이맘때 자연');
    const chips = root.querySelectorAll('.mchip');
    expect(chips).toHaveLength(12);
    const on = root.querySelectorAll('.mchip[aria-pressed="true"]');
    expect(on).toHaveLength(1);
    expect(on[0]?.textContent).toBe('10월');
  });

  it('#/month/12 주소로 열면 12월이 선택된다', async () => {
    window.location.hash = '#/month/12';
    const root = document.getElementById('app')!;
    await startApp({ root, map: createListMap(), pins: [], now: new Date('2026-10-03T00:00:00Z') });
    expect(root.querySelector('.mchip[aria-pressed="true"]')?.textContent).toBe('12월');
  });

  it('핀이 없으면 안내 문구', async () => {
    const root = document.getElementById('app')!;
    await startApp({ root, map: createListMap(), pins: [], now: new Date('2026-10-03T00:00:00Z') });
    expect(root.querySelector('.empty')?.textContent).toContain('10월 명장면');
  });

  it('지도를 못 불러왔으면 목록으로 보여 준다고 알린다', async () => {
    const root = document.getElementById('app')!;
    await startApp({ root, map: createListMap(), pins: [], fallbackReason: 'x' });
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('목록으로');
  });
});
