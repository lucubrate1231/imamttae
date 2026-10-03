import { describe, expect, it } from 'vitest';
import { homeView, seasonOf } from '../../src/domain/home';
import { HOME_SCENES } from '../fixtures/homeScenes';

/** 첫 화면에 무엇을 어떤 순서로 보여 줄지 계산 — docs/features/F1-지금-볼-만한-곳.md */
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe('계절 (F1-AC12)', () => {
  it('3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seasonOf)).toEqual([
      'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    ]);
  });
});

describe('첫 화면 계산 homeView', () => {
  it('F1-AC3 제철 순서: 그달에 찍은 곳 → 찍은 달이 가까운 곳 → 가장 좋은 때가 곧 끝나는 곳 (같으면 최근에 다녀온 곳)', () => {
    const v = homeView(HOME_SCENES.scenes, 10);
    // 주전골·대승폭포: 10월에 찍음(차이 0), 둘 다 10월에 끝남 → 최근(2022) 먼저
    // 백무동(9월, 차이 1, 10월에 끝남=남은 달 1) · 내장산(11월, 차이 1, 남은 달 2) → 곧 끝나는 백무동 먼저
    expect(ids(v.peak)).toEqual(['s-jujeon', 's-jujeon-old', 's-baekmu', 's-naejang']);
  });

  it('F1-AC11 작가 부부가 다녀온 곳: 다녀온 달에만, 제철과 겹치지 않게. 숨긴 장면은 빼기', () => {
    const v = homeView(HOME_SCENES.scenes, 10);
    expect(ids(v.record)).toEqual(['s-sea']);
    expect(ids(homeView(HOME_SCENES.scenes, 11).record)).toEqual([]);
    expect([...ids(v.peak), ...ids(v.record)]).not.toContain('s-hidden');
  });

  it('F1-AC4 준비 중 장면: 그달에 다녀온 것만', () => {
    expect(ids(homeView(HOME_SCENES.scenes, 10).placeholders)).toEqual(['p-taejong']);
    expect(ids(homeView(HOME_SCENES.scenes, 11).placeholders)).toEqual([]);
  });

  it('F1-AC8 이야기가 없는 달은 비었다고 알리고, 가까운 달(앞뒤 같은 거리면 둘 다)의 제철 풍경을 보여 줌', () => {
    const v = homeView(HOME_SCENES.scenes, 2);
    expect(v.empty).toBe(true);
    expect(v.nearby.months).toEqual([1, 3]);
    expect(ids(v.nearby.peak)).toEqual(['s-sanggodae', 's-maehwa']);
    expect(homeView(HOME_SCENES.scenes, 10).empty).toBe(false);
  });

  it('12월~2월처럼 해를 넘는 기간도 맞게 셈 (F1-AC3)', () => {
    const winter = [
      ...HOME_SCENES.scenes,
    ];
    const v = homeView(
      [
        ...winter,
        { ...(HOME_SCENES.scenes[0] as object), id: 's-snow', name: '눈꽃', visited: '2022-12-20', types: ['seolgyeong'], best: { from: 12, to: 2, note: '12월~2월' } } as never,
      ],
      1,
    );
    expect(ids(v.peak)).toContain('s-snow');
  });
});

describe('카드 순서가 완전히 같을 때', () => {
  it('다녀온 날·추천 시기가 같으면 데이터에 적힌 순서(확정 시안 v2와 같게)', async () => {
    const { story } = await import('../fixtures/homeScenes');
    const same = { visited: '2020-10-20', best: { from: 10, to: 10, note: '10월 중순~하순' } };
    const scenes = [story('s-b', { name: '설악 대승폭포 단풍길', ...same }), story('s-a', { name: '남설악 주전골', ...same })];
    expect(homeView(scenes, 10).peak.map((s) => s.id)).toEqual(['s-b', 's-a']);
  });
});

describe('오늘 기준 제철 판단 seasonNow (F2 꼬리표, 10/4 결정)', () => {
  it('오늘이 추천 시기 안이면 now, 밖이면 off, 일 년 내내면 yearRound, 추천 시기가 없으면 none', async () => {
    const { seasonNow } = await import('../../src/domain/home');
    expect(seasonNow({ from: 10, to: 11 }, 10)).toBe('now');
    expect(seasonNow({ from: 12, to: 2 }, 1)).toBe('now'); // 해를 넘는 기간
    expect(seasonNow({ from: 1, to: 1 }, 10)).toBe('off');
    expect(seasonNow({ from: 1, to: 12 }, 5)).toBe('yearRound');
    expect(seasonNow(undefined, 5)).toBe('none');
  });
});
